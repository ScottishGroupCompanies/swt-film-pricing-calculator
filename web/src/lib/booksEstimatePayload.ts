// Shape of one Zoho Books estimate line.
//
// Catalog items in this org are stocked with unit "sf". Books copies that
// unit onto the line when the request omits it, so a quantity of 1 renders
// as "1 sf". An empty unit overrides the item default.
//
// Discount fields are intentionally absent. `discount`, `discount_type`,
// and `is_discount_before_tax` (and per-line discount) are what tell Books
// to render a Discount column. Price reductions are already included in the
// line rates by planEstimateLines.

export interface BooksLineInput {
  itemId: string;
  name: string;
  description: string;
  rate: number;
  quantity: number;
}

export function booksLineItemBody(line: BooksLineInput): {
  item_id: string;
  name: string;
  description: string;
  rate: number;
  quantity: number;
  unit: string;
} {
  return {
    item_id: line.itemId,
    name: line.name,
    description: line.description,
    rate: line.rate,
    quantity: line.quantity,
    unit: "",
  };
}
