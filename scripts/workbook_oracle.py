#!/usr/bin/env python3
"""Evaluate Film Pricing formulas from the workbook.

Reads a JSON request on stdin and writes the values the workbook formulas
produce. Uses the `formulas` package so the numbers come from those
formulas, not from a second copy of the pricing rules.

The Film Pricing sheet's column T is not the same on every row. Quote
lines are written on rows 26–41, which is the formula this app follows.
A request may also ask for the same single line on row 16.
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

import formulas
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "data" / "ScottishPricing-26_12-Accounts.xlsm"
CHECK = "✓"
CROSS = "✗"


def slim_workbook(path: Path) -> None:
    book = openpyxl.load_workbook(WORKBOOK, keep_vba=False)
    for name in list(book.sheetnames):
        if name not in ("Film Pricing", "Preferences"):
            del book[name]
    for name in list(book.defined_names):
        text = book.defined_names[name].attr_text or ""
        upper = text.upper()
        if text.startswith("#") or "OFFSET" in upper or "INDIRECT" in upper or "TABLE" in upper:
            del book.defined_names[name]
    sheet = book["Film Pricing"]
    for row in sheet.iter_rows():
        for cell in row:
            if not isinstance(cell.value, str) or not cell.value.startswith("="):
                continue
            formula = cell.value.replace("Price_Group[]", "Preferences!$D$46:$F$56")
            # Width and Height are column names. Excel uses the cell on this
            # row (implicit intersection). Expand that so every row prices
            # its own window when more than one row is filled in.
            formula = re.sub(r"\bWidth\b", f"G{cell.row}", formula)
            formula = re.sub(r"\bHeight\b", f"H{cell.row}", formula)
            cell.value = formula
    for name in ("Width", "Height"):
        if name in book.defined_names:
            del book.defined_names[name]
    book.save(path)


def scalar(value):
    if hasattr(value, "reshape"):
        flat = value.reshape(-1)
        value = flat[0] if len(flat) else None
    if hasattr(value, "item"):
        try:
            value = value.item()
        except Exception:
            pass
    if isinstance(value, float) and value != value:  # NaN
        return None
    if isinstance(value, (int, float, str)) or value is None:
        return value
    return str(value)


class Oracle:
    def __init__(self) -> None:
        temporary = tempfile.NamedTemporaryFile(prefix="swt-oracle-", suffix=".xlsx", delete=False)
        temporary.close()
        self.path = Path(temporary.name)
        slim_workbook(self.path)
        self.model = formulas.ExcelModel().loads(str(self.path)).finish()
        self.book = self.path.name

    def key(self, addr: str) -> str:
        return f"'[{self.book}]FILM PRICING'!{addr}"

    def read(self, solution, addr: str):
        return scalar(solution[self.key(addr)].value)

    def calculate(self, inputs: dict):
        return self.model.calculate(inputs)

    def blank_rows(self) -> dict:
        inputs = {}
        for row in range(16, 42):
            inputs[self.key(f"F{row}")] = ""
            inputs[self.key(f"G{row}")] = 0
            inputs[self.key(f"H{row}")] = 0
            inputs[self.key(f"I{row}")] = 0
        inputs[self.key("J43")] = 0
        inputs[self.key("I44")] = 0
        inputs[self.key("K46")] = 0
        inputs[self.key("I47")] = CHECK
        inputs[self.key("I48")] = CROSS
        return inputs

    def place(self, inputs: dict, row: int, line: dict) -> None:
        inputs[self.key(f"F{row}")] = line.get("film") or ""
        inputs[self.key(f"G{row}")] = line.get("width") or 0
        inputs[self.key(f"H{row}")] = line.get("height") or 0
        inputs[self.key(f"I{row}")] = line.get("qty") or 0

    def apply_job(self, inputs: dict, job: dict) -> None:
        inputs[self.key("J43")] = job.get("removalSqFt") or 0
        inputs[self.key("I44")] = job.get("frenchPanes") or 0
        inputs[self.key("K46")] = job.get("attachment") or 0
        inputs[self.key("I47")] = CHECK if job.get("bulkEnabled", True) else CROSS
        inputs[self.key("I48")] = CHECK if job.get("cBond") else CROSS

    def quote_payload(self, solution, lines: list[dict]) -> dict:
        priced = []
        for index, line in enumerate(lines):
            row = 26 + index
            if not line.get("qty"):
                continue
            priced.append({
                "chargedSqFt": self.read(solution, f"J{row}"),
                "lineTotal": self.read(solution, f"K{row}"),
                "group": self.read(solution, f"M{row}"),
            })
        bulk_cell = self.read(solution, "K47")
        bulk = 0.0 if bulk_cell in (None, "") else float(bulk_cell)
        return {
            "lines": priced,
            "windowTotal": self.read(solution, "K42"),
            "filmTotal": self.read(solution, "K45"),
            "highestGroup": self.read(solution, "M46"),
            "bulkDiscount": abs(bulk) if bulk < 0 else bulk,
            "bulkCell": bulk,
            "fee": self.read(solution, "K50"),
            "total": self.read(solution, "K51"),
        }

    def run(self, request: dict) -> dict:
        saved = None
        if request.get("savedExample"):
            solution = self.calculate(self.blank_rows() | {
                self.key("F16"): "Affinity 15 ",
                self.key("G16"): 25,
                self.key("H16"): 30,
                self.key("I16"): 1,
            })
            saved = {
                "chargedSqFt": self.read(solution, "J16"),
                "lineTotal": self.read(solution, "K16"),
                "group": self.read(solution, "M16"),
                "filmTotal": self.read(solution, "K45"),
                "total": self.read(solution, "K51"),
            }

        quotes = []
        for job in request.get("quotes", []):
            inputs = self.blank_rows()
            for index, line in enumerate(job.get("lines", [])):
                self.place(inputs, 26 + index, line)
            self.apply_job(inputs, job)
            solution = self.calculate(inputs)
            quotes.append(self.quote_payload(solution, job.get("lines", [])))

        row_compare = None
        compare = request.get("rowCompare")
        if compare:
            sides = {}
            for row in (16, 26):
                inputs = self.blank_rows()
                self.place(inputs, row, compare)
                self.apply_job(inputs, {"bulkEnabled": True})
                solution = self.calculate(inputs)
                sides[f"row{row}"] = {
                    "chargedSqFt": self.read(solution, f"J{row}"),
                    "lineTotal": self.read(solution, f"K{row}"),
                    "t": self.read(solution, f"T{row}"),
                }
            row_compare = sides

        return {"quotes": quotes, "rowCompare": row_compare, "savedExample": saved}


def main() -> None:
    request = json.load(sys.stdin)
    oracle = Oracle()
    json.dump(oracle.run(request), sys.stdout)


if __name__ == "__main__":
    main()
