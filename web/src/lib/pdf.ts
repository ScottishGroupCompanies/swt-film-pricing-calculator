/**
 * PDF generation from HTML — used to render the branded estimate document
 * before attaching it to Zoho as a file.
 *
 * Uses puppeteer-core + @sparticuz/chromium so it works both locally
 * (falls back to a system Chrome install) and on Vercel serverless
 * (uses the bundled chromium binary compiled for AWS Lambda/Vercel).
 */

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "fs";

function findLocalChrome(): string | null {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const path of candidates) {
    try {
      if (fs.existsSync(path)) return path;
    } catch {
      // ignore — not present on this platform
    }
  }
  return null;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const isLocalDev = !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;
  const localChrome = isLocalDev ? findLocalChrome() : null;

  const browser = await puppeteer.launch({
    args: localChrome ? [] : chromium.args,
    executablePath: localChrome || (await chromium.executablePath()),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfUint8 = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
