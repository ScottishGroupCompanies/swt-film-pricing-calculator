/**
 * City / state / ZIP parsing for Zoho CRM and Zoho Books.
 *
 * Reps type this freehand ("centennial co 80112", "Centennial, Colorado
 * 80112", sometimes with the street glued on). A parser that only accepts
 * "City, ST ZIP" leaves Books state and ZIP blank, and Zoho's estimate
 * template then prints the literal word "null".
 */

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

const STATE_ABBRS = new Set(Object.values(STATE_NAME_TO_ABBR));

/** Drop nullish values and the literal words "null" / "undefined". */
export function sanitizeAddressPart(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/\b(null|undefined)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseCity(city: string): string {
  if (!city || city !== city.toLowerCase()) return city;
  return city.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

function abbrForState(token: string): string {
  const t = token.trim();
  if (!t) return "";
  const full = STATE_NAME_TO_ABBR[t.toLowerCase()];
  if (full) return full;
  if (/^[A-Za-z]{2}$/.test(t) && STATE_ABBRS.has(t.toUpperCase())) return t.toUpperCase();
  return "";
}

function splitCityState(rest: string): { city: string; state: string } {
  const comma = rest.lastIndexOf(",");
  if (comma !== -1) {
    const left = rest.slice(0, comma).trim();
    const right = rest.slice(comma + 1).trim();
    const rightState = abbrForState(right);
    if (rightState) return { city: left, state: rightState };
    // "7075 S Alton Way, centennial co" — city and state are both on the right.
    const fromRight = splitCityState(right.replace(/,/g, " ").replace(/\s+/g, " ").trim());
    if (fromRight.state) return fromRight;
    return splitCityState(rest.replace(/,/g, " ").replace(/\s+/g, " ").trim());
  }

  const lower = rest.toLowerCase();
  let matched: string | null = null;
  for (const name of Object.keys(STATE_NAME_TO_ABBR)) {
    const boundaryOk = lower.length === name.length || lower[lower.length - name.length - 1] === " ";
    if (lower.endsWith(name) && boundaryOk && (!matched || name.length > matched.length)) {
      matched = name;
    }
  }
  if (matched) {
    return {
      city: rest.slice(0, rest.length - matched.length).trim(),
      state: STATE_NAME_TO_ABBR[matched],
    };
  }

  const abbrev = rest.match(/^(.*?)[\s,]+([A-Za-z]{2})$/);
  if (abbrev) {
    const state = abbrForState(abbrev[2]);
    if (state) return { city: abbrev[1].replace(/,\s*$/, "").trim(), state };
  }
  return { city: rest.trim(), state: "" };
}

/**
 * Parse a free-typed "City, State ZIP" string. Tolerates a missing comma,
 * a full state name, a lowercase abbreviation, and ZIP glued to the state
 * ("co80112"). Never returns the literal word "null".
 */
export function parseCityStateZip(csz?: string | null): { city: string; state: string; zip: string } {
  if (csz == null) return { city: "", state: "", zip: "" };
  const trimmed = sanitizeAddressPart(csz).replace(/\s*,\s*/g, ", ").replace(/^[,\s]+|[,\s]+$/g, "");
  if (!trimmed) return { city: "", state: "", zip: "" };

  const zipMatch = trimmed.match(/(\d{5}(?:-\d{4})?)\s*$/);
  const zip = zipMatch ? zipMatch[1] : "";
  const withoutZip = (zipMatch ? trimmed.slice(0, zipMatch.index) : trimmed).replace(/[,\s]+$/g, "").trim();
  if (!withoutZip) return { city: "", state: "", zip };

  const { city, state } = splitCityState(withoutZip);
  return {
    city: titleCaseCity(sanitizeAddressPart(city)),
    state: sanitizeAddressPart(state),
    zip: sanitizeAddressPart(zip),
  };
}

/** "Centennial, CO 80112" — omits any part that is missing. Never includes "null". */
export function formatCityStateZip(parts: { city?: unknown; state?: unknown; zip?: unknown }): string {
  const city = sanitizeAddressPart(parts.city);
  const state = sanitizeAddressPart(parts.state);
  const zip = sanitizeAddressPart(parts.zip);
  const stateZip = [state, zip].filter(Boolean).join(" ");
  if (city && stateZip) return `${city}, ${stateZip}`;
  return city || stateZip;
}

/** Street on the first line, city/state/ZIP on the second. Never includes "null". */
export function formatInstallationAddress(input: {
  street?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
}): string {
  const street = sanitizeAddressPart(input.street);
  const csz = formatCityStateZip(input);
  return [street, csz].filter(Boolean).join("\n");
}

/**
 * Zoho Books billing/shipping address. Sends both `state` and `state_code`
 * (Books shows the code in the UI) and omits empty parts so a missing ZIP
 * is blank rather than the string "null".
 */
export function toBooksAddress(parts: {
  address?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
}): Record<string, string> | undefined {
  const address = sanitizeAddressPart(parts.address);
  const city = sanitizeAddressPart(parts.city);
  const state = sanitizeAddressPart(parts.state);
  const zip = sanitizeAddressPart(parts.zip);
  if (!address && !city && !state && !zip) return undefined;
  const out: Record<string, string> = {};
  if (address) out.address = address;
  if (city) out.city = city;
  if (state) {
    out.state = state;
    if (/^[A-Z]{2}$/.test(state)) out.state_code = state;
  }
  if (zip) out.zip = zip;
  if (city || state || zip) out.country = "U.S.A";
  return out;
}
