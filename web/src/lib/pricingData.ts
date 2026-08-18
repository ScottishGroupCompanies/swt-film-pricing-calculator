// SWT Film Pricing Calculator — Data
// Source: ScottishPricing-10.9 7-31-2026 (V-10.9)

export const PRICING_GROUPS: Record<number, number> = {
  1: 16.2019, 2: 17.2834, 3: 18.3649, 4: 20.4558, 5: 23.5664,
  6: 26.9139, 7: 29.252, 8: 34.5256, 9: 41.097, 10: 47.3594,
};

// Available roll widths — Zoho spreadsheet supports up to 144" (not capped at 72")
export const ROLL_WIDTHS = [36, 48, 60, 72, 84, 96, 108, 120, 144];
export const MIN_PRICE = 250;
export const MIN_DIM_DEFAULT = 8;
export const DEFAULT_FEE_PCT = 4; // 4% fee (editable per job)

// V-10.9: Flat commission rate per user (no more tiered table)
// Plus 5% on over/under (difference between charged-to-client and calculated price)
export const OVER_UNDER_RATE = 0.05;

export interface User {
  id: string;
  name: string;
  loc: string;
  glassRate: number | null;
  filmRate: number | null; // flat commission rate on film sale total
}

export const USERS: User[] = [
  { id: "dana",  name: "Dana",  loc: "Colorado",  glassRate: 0,    filmRate: 0.07 },
  { id: "amy",   name: "Amy",   loc: "Texas",     glassRate: 0,    filmRate: 0.05 },
  { id: "blake", name: "Blake", loc: "KS/MO",     glassRate: null, filmRate: 0.15 },
  { id: "katie", name: "Katie", loc: "Arizona",   glassRate: null, filmRate: 0 },
  { id: "mike",  name: "Mike",  loc: "Tennessee", glassRate: null, filmRate: 0 },
];

export interface Film {
  name: string;
  psf: number | null;
  pg: number | null;
  brand: string;
}

export const FILMS: Film[] = [
  // Vista
  { name: "V 33 SR CDF - Neutral", psf: 1.5, pg: 2, brand: "Vista" },
  { name: "V 45 SR CDF - Neutral", psf: 1.5, pg: 2, brand: "Vista" },
  { name: "V 58 SR CDF - Neutral", psf: 1.5, pg: 2, brand: "Vista" },
  { name: "V 33 BR SR CDF - Neutral", psf: 1.52, pg: 2, brand: "Vista" },
  { name: "V 14 SR CDF - Dual Reflective", psf: 1.52, pg: 2, brand: "Vista" },
  { name: "V 18 SR CDF - Dual Reflective", psf: 1.52, pg: 2, brand: "Vista" },
  { name: "V 28 SR CDF - Dual Reflective", psf: 1.52, pg: 2, brand: "Vista" },
  { name: "V 28 SR PS8 - Safety - Dual Reflective", psf: 2.17, pg: 3, brand: "Vista" },
  { name: "V 38 SR CDF - Dual Reflective", psf: 1.52, pg: 2, brand: "Vista" },
  { name: "V 38 SR PS8 - Safety - Dual Reflective", psf: 2.17, pg: 3, brand: "Vista" },
  { name: "V 48 SR CDF - Dual Reflective", psf: 1.52, pg: 2, brand: "Vista" },
  { name: "VE 35 SR CDF - Low-E", psf: 1.48, pg: 1, brand: "Vista" },
  { name: "VE 50 SR CDF - Low-E", psf: 1.48, pg: 1, brand: "Vista" },
  { name: "VS 60 SR CDF - Spectrally Selective", psf: 5.47, pg: 7, brand: "Vista" },
  { name: "VS 61 SR CDF - Spectrally Selective", psf: 1.7, pg: 2, brand: "Vista" },
  { name: "VS 70 SR CDF - Spectrally Selective", psf: 5.47, pg: 7, brand: "Vista" },
  { name: "Ceramic 35 SR PS", psf: 2.87, pg: 4, brand: "Vista" },
  { name: "Ceramic 45 SR PS", psf: 2.87, pg: 4, brand: "Vista" },
  { name: "Ceramic 55 SR PS", psf: 2.87, pg: 4, brand: "Vista" },
  { name: "Ceramic 65 SR PS", psf: 2.87, pg: 4, brand: "Vista" },
  // 3M
  { name: "AERINA", psf: 4.76, pg: 6, brand: "3M" },
  { name: "Affinity 15", psf: 1.7, pg: 2, brand: "3M" },
  { name: "Affinity 30", psf: 1.7, pg: 2, brand: "3M" },
  { name: "ALTAIR", psf: 2.22, pg: 3, brand: "3M" },
  { name: "Anti Graffiti 4 (AG-4)", psf: 1.57, pg: 2, brand: "3M" },
  { name: "Anti Graffiti 6 (AG-6)", psf: 1.94, pg: 2, brand: "3M" },
  { name: "ARPA - BLACK VERTICAL", psf: 3.97, pg: 5, brand: "3M" },
  { name: "ARPA CRYSTAL", psf: 3.97, pg: 5, brand: "3M" },
  { name: "ARPA - VERTICAL", psf: 3.97, pg: 5, brand: "3M" },
  { name: "ASTRAL SILVER-PRISM", psf: 4.73, pg: 6, brand: "3M" },
  { name: "AURA 9 - DOT", psf: 4.73, pg: 6, brand: "3M" },
  { name: "BLACK BLOCKOUT MATTE FILM", psf: 1.71, pg: 2, brand: "3M" },
  { name: "BLACK ELECTROCUT FILM", psf: 1.54, pg: 2, brand: "3M" },
  { name: "CEILO - DOT", psf: 4.73, pg: 6, brand: "3M" },
  { name: "Ceramic 35 (CA35)", psf: 2.8, pg: 4, brand: "3M" },
  { name: "Ceramic 45 (CA45)", psf: 2.8, pg: 4, brand: "3M" },
  { name: "Ceramic 60 (CA60)", psf: 2.8, pg: 4, brand: "3M" },
  { name: "Ceramic 80 (CA80)", psf: 2.8, pg: 4, brand: "3M" },
  { name: "CHAMONIX", psf: 2.57, pg: 4, brand: "3M" },
  { name: "CLOUD", psf: 5.66, pg: 7, brand: "3M" },
  { name: "DIAMOND", psf: 5.66, pg: 7, brand: "3M" },
  { name: "DICHROIC FILM WITH ADHESIVE (DEP-A) BLAZE", psf: 9.16, pg: 9, brand: "3M" },
  { name: "DICHROIC FILM WITH ADHESIVE (DEP-A) CHILL", psf: 9.19, pg: 9, brand: "3M" },
  { name: "DIFFUSER FILM WHITE", psf: 1.61, pg: 2, brand: "3M" },
  { name: "DUSTED CRYSTAL", psf: 2.5, pg: 4, brand: "3M" },
  { name: "DUSTED CRYSTAL NON LOGO", psf: 2.5, pg: 4, brand: "3M" },
  { name: "ESSEN", psf: 2.57, pg: 4, brand: "3M" },
  { name: "Exterior Prestige 20 - PRX 20", psf: 5.63, pg: 6, brand: "3M" },
  { name: "Exterior Prestige 40 - PRX 40", psf: 5.63, pg: 7, brand: "3M" },
  { name: "Exterior Prestige 70 - PRX70", psf: 5.63, pg: 7, brand: "3M" },
  { name: "Exterior Prestige 90 - PRX90", psf: 4.48, pg: 6, brand: "3M" },
  { name: "Fasara Emboss", psf: 2.86, pg: 4, brand: "3M" },
  { name: "Fasara Fabric Patterns", psf: 2.57, pg: 4, brand: "3M" },
  { name: "Fasara Gradient Patterns (Cloud Narrow)", psf: 3.64, pg: 5, brand: "3M" },
  { name: "Fasara Gradient Patterns (Light Gray)", psf: 3.64, pg: 5, brand: "3M" },
  { name: "Fasara Gradient Patterns (Blue Gray)", psf: 3.64, pg: 5, brand: "3M" },
  { name: "Fasara Gradient Patterns (Dark Gray)", psf: 3.64, pg: 5, brand: "3M" },
  { name: "Fasara Gradient Silky Patterns Illumina Silky S", psf: 7.09, pg: 8, brand: "3M" },
  { name: "Fasara Gradient Silky Patterns Illumina Sliky W", psf: 9.48, pg: 9, brand: "3M" },
  { name: "FINE - VERTICAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "FINE CRYSTAL", psf: 2.57, pg: 4, brand: "3M" },
  { name: "FROSTED BLUE MIST CRYSTAL", psf: 2.5, pg: 4, brand: "3M" },
  { name: "FROSTED CRYSTAL", psf: 2.5, pg: 4, brand: "3M" },
  { name: "FROSTED GOLD CRYSTAL", psf: 2.5, pg: 4, brand: "3M" },
  { name: "FROSTED MINT CRYSTAL", psf: 2.33, pg: 3, brand: "3M" },
  { name: "FROSTED ROSE CRYSTAL", psf: 2.5, pg: 4, brand: "3M" },
  { name: "FROSTED VIOLET SKY", psf: 2.5, pg: 4, brand: "3M" },
  { name: "GLACE", psf: 2.17, pg: 3, brand: "3M" },
  { name: "ILLUMINA", psf: 4.76, pg: 6, brand: "3M" },
  { name: "ILLUMINA BLACK", psf: 4.72, pg: 6, brand: "3M" },
  { name: "ILLUMINA GLACE", psf: 4.76, pg: 6, brand: "3M" },
  { name: "ILLUMINA P (FOR PLASTIC)", psf: 4.91, pg: 6, brand: "3M" },
  { name: "ILLUMINA SILVER", psf: 4.76, pg: 6, brand: "3M" },
  { name: "KANON - DOT", psf: 3.97, pg: 5, brand: "3M" },
  { name: "KENUN", psf: 2.23, pg: 3, brand: "3M" },
  { name: "LATTICE - HORIZONTAL", psf: 4.37, pg: 6, brand: "3M" },
  { name: "LATTICE GLACE - BORDER HORIZONTAL", psf: 4.37, pg: 6, brand: "3M" },
  { name: "LAUSANNE", psf: 2.17, pg: 3, brand: "3M" },
  { name: "LE 20 - Sun Control Film", psf: 2.81, pg: 4, brand: "3M" },
  { name: "LE 35 - Sun Control Film", psf: 2.48, pg: 3, brand: "3M" },
  { name: "LEISE - HORIZONTAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "LINEN", psf: 2.23, pg: 3, brand: "3M" },
  { name: "LINEN CRYSTAL", psf: 2.23, pg: 3, brand: "3M" },
  { name: "LONTANO", psf: 5.66, pg: 7, brand: "3M" },
  { name: "LUCE", psf: 2.57, pg: 4, brand: "3M" },
  { name: "LUNA 6-DOT", psf: 4.73, pg: 6, brand: "3M" },
  { name: "LUNA 9 - DOT", psf: 4.73, pg: 6, brand: "3M" },
  { name: "MARE", psf: 4.81, pg: 6, brand: "3M" },
  { name: "MAT CRYSTAL 1", psf: 2.57, pg: 4, brand: "3M" },
  { name: "MAT CRYSTAL CRX2 - EXTERIOR", psf: 4.65, pg: 6, brand: "3M" },
  { name: "MILANO - MILKY WHITE", psf: 1.91, pg: 2, brand: "3M" },
  { name: "MILKY CRYSTAL", psf: 2.57, pg: 4, brand: "3M" },
  { name: "Neutral 20 (RE20NEARL) - Sun Control Film", psf: 2.52, pg: 4, brand: "3M" },
  { name: "Neutral 35 (RE35NEARL) - Sun Control Film", psf: 2.4, pg: 3, brand: "3M" },
  { name: "Neutral 35 Exterior", psf: 3.11, pg: 5, brand: "3M" },
  { name: "Neutral 50 (RE50NEARL) - Sun Control Film", psf: 2.34, pg: 3, brand: "3M" },
  { name: "Neutral 70 (RE70NEARL) - Sun Control Film", psf: 2.32, pg: 3, brand: "3M" },
  { name: "Night Vision 15 (NV-15) - Sun Control Film", psf: 2.67, pg: 4, brand: "3M" },
  { name: "Night Vision 25 (NV-25) - Sun Control Film", psf: 2.67, pg: 4, brand: "3M" },
  { name: "Night Vision 35 (NV-35) - Sun Control Film", psf: 2.67, pg: 4, brand: "3M" },
  { name: "NOKTO - HORIZONTAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "OPAQUE BLACK", psf: 4.82, pg: 6, brand: "3M" },
  { name: "OPAQUE WHITE", psf: 2.57, pg: 4, brand: "3M" },
  { name: "OSLO", psf: 2.57, pg: 4, brand: "3M" },
  { name: "OSLO - P FOR PLASTIC", psf: 2.23, pg: 3, brand: "3M" },
  { name: "PARACELL - HORIZONTAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "PIXELLA - HORIZONTAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "Prestige 20", psf: 5.03, pg: 7, brand: "3M" },
  { name: "Prestige 40", psf: 5.03, pg: 7, brand: "3M" },
  { name: "Prestige 50", psf: 5.03, pg: 7, brand: "3M" },
  { name: "Prestige 60", psf: 5.59, pg: 7, brand: "3M" },
  { name: "Prestige 70", psf: 5.59, pg: 7, brand: "3M" },
  { name: "PRISM NOIR- PRISM", psf: 4.73, pg: 6, brand: "3M" },
  { name: "PRISM SILVER - PRISM", psf: 4.73, pg: 6, brand: "3M" },
  { name: "Privacy Matte", psf: 1.02, pg: 1, brand: "3M" },
  { name: "Privacy Mirror", psf: 2.05, pg: 3, brand: "3M" },
  { name: "RADIUS", psf: 4.42, pg: 6, brand: "3M" },
  { name: "RIKYU", psf: 2.23, pg: 3, brand: "3M" },
  { name: "ROBE", psf: 4.91, pg: 6, brand: "3M" },
  { name: "S40 Exterior (SH4CLARXL) - Safety/Security", psf: 2.29, pg: 3, brand: "3M" },
  { name: "S70 Exterior (SH7CLARXL)  - Safety/Security", psf: 2.65, pg: 4, brand: "3M" },
  { name: "SABRINA", psf: 5.67, pg: 7, brand: "3M" },
  { name: "Safety Neutral 35 - Safety/Security", psf: 2.93, pg: 4, brand: "3M" },
  { name: "Safety S2400", psf: 17, pg: 9, brand: "3M" },
  { name: "Safety S140 (SH14CLARL) - Safety/Security", psf: 4.74, pg: 6, brand: "3M" },
  { name: "Safety S40 (SH4CLARL) - Safety/Security", psf: 1.44, pg: 1, brand: "3M" },
  { name: "Safety S70 (SH7CLARL) - Safety/Security", psf: 1.69, pg: 2, brand: "3M" },
  { name: "Safety S80 (SH8CLARL) - Safety/Security", psf: 1.69, pg: 2, brand: "3M" },
  { name: "Safety Silver 20 - Safety/Security", psf: 2.65, pg: 4, brand: "3M" },
  { name: "SAFU", psf: 2.23, pg: 3, brand: "3M" },
  { name: "SAGANO", psf: 2.23, pg: 3, brand: "3M" },
  { name: "SAN MARINO - MILKY MILKY", psf: 1.91, pg: 2, brand: "3M" },
  { name: "SAN MARINO - MILKY MILKY Light Gray/dark/Gray Blue", psf: 3.64, pg: 5, brand: "3M" },
  { name: "SCOTCHCAL CLEAR VIEW GRAPHIC", psf: 1.81, pg: 2, brand: "3M" },
  { name: "SEATTLE - FINE", psf: 4.73, pg: 6, brand: "3M" },
  { name: "SEATTLE - VERTICAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "SHIZUKU-DOT", psf: 4.73, pg: 6, brand: "3M" },
  { name: "SHUTIE - BLACK VERTICAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "SHUTIE - VERTICAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "SILVER 1", psf: 5.67, pg: 7, brand: "3M" },
  { name: "Silver 15 Exterior (RE15SIARXL)", psf: 2.75, pg: 4, brand: "3M" },
  { name: "Silver 35 (RE35SIARL)  - Sun Control Film", psf: 1.83, pg: 2, brand: "3M" },
  { name: "Silver P-18 (P18ARL) - Sun Control Film", psf: 2.01, pg: 3, brand: "3M" },
  { name: "SLAT - HORIZONTAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "SLAT GLACE - BORDER HORIZONTAL", psf: 4.73, pg: 6, brand: "3M" },
  { name: "TSURUGI", psf: 5.67, pg: 7, brand: "3M" },
  { name: "Ultra Night Vision S25 (S25NVAR400) - Safety/Security", psf: 4.25, pg: 6, brand: "3M" },
  { name: "Ultra Prestige 50", psf: 6.37, pg: 8, brand: "3M" },
  { name: "Ultra Prestige 70", psf: 6.37, pg: 8, brand: "3M" },
  { name: "Ultra S800 - Safety/Security", psf: 4.5, pg: 6, brand: "3M" },
  { name: "VEGA", psf: 2.23, pg: 3, brand: "3M" },
  { name: "VENETIAN", psf: 5.81, pg: 7, brand: "3M" },
  { name: "VISTA - DOT", psf: 4.73, pg: 6, brand: "3M" },
  { name: "WHITE BLOCKOUT MATTE FILM", psf: 1.41, pg: 1, brand: "3M" },
  { name: "WHITE ELECTROCUT FILM", psf: 1.55, pg: 2, brand: "3M" },
  { name: "WHITEBOARD FILM - POST IT FLEX WRITE SURFACE", psf: 4.47, pg: 6, brand: "3M" },
  { name: "WHITEBOARD FILM - GLASS", psf: 5.14, pg: 7, brand: "3M" },
  { name: "YAMATO", psf: 2.23, pg: 3, brand: "3M" },
  // Huper
  { name: "CLEAR CERAMIC KLAR 85", psf: 4.65, pg: 6, brand: "Huper" },
  { name: "CLEAR CERAMIC 70", psf: 7.268, pg: 8, brand: "Huper" },
  { name: "X3 CERAMIC 30", psf: 4.025, pg: 6, brand: "Huper" },
  { name: "X3 CERAMIC 40", psf: 4.025, pg: 6, brand: "Huper" },
  { name: "X3 CERAMIC 50", psf: 2.5645, pg: 4, brand: "Huper" },
  { name: "X3 CERAMIC 60", psf: 2.5645, pg: 4, brand: "Huper" },
  { name: "SINGLE LAYER CERAMIC 35", psf: 2.4035, pg: 3, brand: "Huper" },
  { name: "SINGLE LAYER CERAMIC 45", psf: 2.4035, pg: 3, brand: "Huper" },
  { name: "DARK CERAMIC 20", psf: 4.6, pg: 6, brand: "Huper" },
  { name: "SECH", psf: 6.7505, pg: 8, brand: "Huper" },
  { name: "DREI", psf: 8.211, pg: 9, brand: "Huper" },
  { name: "THERM X 30", psf: 3.1625, pg: 5, brand: "Huper" },
  { name: "THERM X 70", psf: 3.1625, pg: 5, brand: "Huper" },
  { name: "DUAL REFLECTIVE FUSION HF10", psf: 1.4605, pg: 1, brand: "Huper" },
  { name: "DUAL REFLECTIVE FUSION HF20", psf: 1.4605, pg: 1, brand: "Huper" },
  { name: "DUAL REFLECTIVE FUSION HF28", psf: 1.4605, pg: 1, brand: "Huper" },
  { name: "TRADITIONAL SILVER TSL 18", psf: 1.311, pg: 1, brand: "Huper" },
  { name: "TRADITIONAL SILVER TSL 30", psf: 1.311, pg: 1, brand: "Huper" },
  { name: "TRADITIONAL BRONZE TSL 25", psf: 1.84, pg: 2, brand: "Huper" },
  { name: "TRADITIONAL BRONZE TSL 40", psf: 1.84, pg: 2, brand: "Huper" },
  { name: "DECORATIVE FROST", psf: 1.012, pg: 1, brand: "Huper" },
  { name: "DECORATIVE MATT BLACK", psf: 1.219, pg: 1, brand: "Huper" },
  { name: "DECORATIVE DUSTED CRYSTAL", psf: 2.5875, pg: 4, brand: "Huper" },
  { name: "DECORATIV WHITE OUT", psf: 1.219, pg: 1, brand: "Huper" },
  { name: "SECURITY 4 MIL", psf: 1.4375, pg: 1, brand: "Huper" },
  { name: "SECURITY 8 MIL", psf: 2.1735, pg: 3, brand: "Huper" },
  { name: "SECURITY 14 MIL", psf: 3.174, pg: 5, brand: "Huper" },
  { name: "SECURITY SHIELD 35 NEUTRAL 8 MIL", psf: 3.174, pg: 5, brand: "Huper" },
  // Llumar
  { name: "RN 07G SR CDF- Reflective", psf: 1.02, pg: 1, brand: "Llumar" },
  { name: "R 15 G SR CDF- Reflective", psf: 1.16, pg: 1, brand: "Llumar" },
  { name: "R 15 B SR CDF - Reflective", psf: 1.16, pg: 1, brand: "Llumar" },
  { name: "R 15 Gold SR PS - Reflective", psf: 1.6, pg: 2, brand: "Llumar" },
  { name: "R 15 Blue SR PS - Reflective", psf: 1.6, pg: 2, brand: "Llumar" },
  { name: "R 20 SR CDF- Reflective", psf: 0.93, pg: 1, brand: "Llumar" },
  { name: "R 35 SR CDF- Reflective", psf: 0.93, pg: 1, brand: "Llumar" },
  { name: "R 50 SR - CDF - Reflective", psf: 0.93, pg: 1, brand: "Llumar" },
  { name: "DR 5 SR CDF - Dual Reflective", psf: 1.04, pg: 1, brand: "Llumar" },
  { name: "DR 15 SR CDF - Dual Reflective", psf: 1.04, pg: 1, brand: "Llumar" },
  { name: "DR 15 SR PS5  - Safety Security Solar", psf: 2.14, pg: 3, brand: "Llumar" },
  { name: "DR 25 SR PS5  - Safety Security Solar", psf: 2.14, pg: 3, brand: "Llumar" },
  { name: "DR 25 SR PS9  - Safety Security Solar", psf: 2.81, pg: 4, brand: "Llumar" },
  { name: "DR 25 SR CDF - Dual Reflective", psf: 1.04, pg: 1, brand: "Llumar" },
  { name: "DR 35 SR CDF - Dual Reflective", psf: 1.04, pg: 1, brand: "Llumar" },
  { name: "SunTek DRDS 15", psf: 1.28, pg: 1, brand: "Llumar" },
  { name: "SunTek DRDS 25", psf: 1.25, pg: 1, brand: "Llumar" },
  { name: "SunTek DRDS 35", psf: 1.25, pg: 1, brand: "Llumar" },
  { name: "N1020 SR CDF - Neutral", psf: 1.2, pg: 1, brand: "Llumar" },
  { name: "N1050 SR CDF - Neutral", psf: 1.2, pg: 1, brand: "Llumar" },
  { name: "N1065 SR CDF - Neutral", psf: 1.2, pg: 1, brand: "Llumar" },
  { name: "N1020B SR CDF - Neutral", psf: 1.27, pg: 1, brand: "Llumar" },
  { name: "N1035B SR CDF - Neutral", psf: 1.27, pg: 1, brand: "Llumar" },
  { name: "E 1220 SR CDF - Low-E", psf: 1.3335, pg: 1, brand: "Llumar" },
  { name: "DL 05G SR CDF - Deluxe", psf: 1.58, pg: 2, brand: "Llumar" },
  { name: "DL 15B SR CDF - Deluxe", psf: 1.36, pg: 1, brand: "Llumar" },
  { name: "DL 15G SR CDF - Deluxe", psf: 1.36, pg: 1, brand: "Llumar" },
  { name: "DL 30 GN SR PS - Deluxe", psf: 1.6, pg: 2, brand: "Llumar" },
  { name: "SCL SR PS2 - Safety/Security", psf: 0.96, pg: 1, brand: "Llumar" },
  { name: "SCL SR PS4 - Safety/Security", psf: 1.01, pg: 1, brand: "Llumar" },
  { name: "SCL SR PS7 - Safety/Security", psf: 1.29, pg: 1, brand: "Llumar" },
  { name: "SCL SR PS8 - Safety/Security", psf: 1.51, pg: 2, brand: "Llumar" },
  { name: "SCL SR PS13 - Safety/Security", psf: 3.86, pg: 5, brand: "Llumar" },
  { name: "R 20 SR PS5 - Safety/Security", psf: 1.72, pg: 2, brand: "Llumar" },
  { name: "R 20 SR PS9 - Safety/Security", psf: 2.24, pg: 3, brand: "Llumar" },
  { name: "N1020 SR PS4 - Safety/Security", psf: 1.62, pg: 2, brand: "Llumar" },
  { name: "N1020 SR PS8 - Safety/Security", psf: 2.01, pg: 3, brand: "Llumar" },
  { name: "N1040 SR PS4 - Safety/Security", psf: 1.62, pg: 2, brand: "Llumar" },
  { name: "N1040 - SR PS8 - Safety/Security", psf: 2.01, pg: 3, brand: "Llumar" },
  { name: "N1050 SR PS4 - Safety/Security", psf: 1.62, pg: 2, brand: "Llumar" },
  { name: "N1050  SR PS8 - Safety/Security", psf: 2.01, pg: 3, brand: "Llumar" },
  { name: "NUV 65 SR PS4 - Safety/Security", psf: 2.03, pg: 3, brand: "Llumar" },
  { name: "RHE 20 ER HPR - Exterior", psf: 1.94, pg: 2, brand: "Llumar" },
  { name: "RHE 35 ER HPR - Exterior", psf: 1.94, pg: 2, brand: "Llumar" },
  { name: "RHE 50 ER HPR - Exterior", psf: 1.94, pg: 2, brand: "Llumar" },
  { name: "NHE 20 ER HPR - Exterior", psf: 2.55, pg: 4, brand: "Llumar" },
  { name: "NHE 35 ER HPR - Exterior", psf: 2.55, pg: 4, brand: "Llumar" },
  { name: "THE 80 BLER HPR - Exterior", psf: 3.31, pg: 5, brand: "Llumar" },
  { name: "SHE CL ER PS4 - Exterior", psf: 2.65, pg: 4, brand: "Llumar" },
  { name: "SHE CL ER PS7 - Exterior", psf: 3.05, pg: 5, brand: "Llumar" },
  { name: "GCL SR PS4 - Graffiti", psf: 0.88, pg: 1, brand: "Llumar" },
  { name: "GCL SR PS6 - Graffiti", psf: 1.15, pg: 1, brand: "Llumar" },
  { name: "Frost (NRM PS2) - Elegant Frost", psf: 0.83, pg: 1, brand: "Llumar" },
  { name: "Mist (NRM80 PS2) - Elegant Frost", psf: 0.94, pg: 1, brand: "Llumar" },
  { name: "Glacier (NRM55 PS4) - Elegant Frost", psf: 0.94, pg: 1, brand: "Llumar" },
  { name: "Bronze (NRMB PS2) - Elegant Frost", psf: 0.94, pg: 1, brand: "Llumar" },
  { name: "Silver (RMS PS2) - Elegant Frost", psf: 1.81, pg: 2, brand: "Llumar" },
  { name: "Satin Crystal (NRMV SC HPR) - Elegant Frost", psf: 1.4, pg: 1, brand: "Llumar" },
  { name: "Brushed Crystal (NRMV BC HPR) - Elegant Frost", psf: 1.4, pg: 1, brand: "Llumar" },
  { name: "Satin Crystal Clear - Elegant Frost", psf: 1.4, pg: 1, brand: "Llumar" },
  { name: "Sandblast - Elegant Frost", psf: 1.4, pg: 1, brand: "Llumar" },
  { name: "Frosted Glass - Elegant Frost", psf: 1.4, pg: 1, brand: "Llumar" },
  { name: "Etched Frost (NRMV60F PS3) - Elegant Frost", psf: 1.81, pg: 2, brand: "Llumar" },
  { name: "Dusted Crystal (NRMV80DC PS3) - Elegant Frost", psf: 1.81, pg: 2, brand: "Llumar" },
  { name: "Dusted Frost - Elegant Frost", psf: 1.81, pg: 2, brand: "Llumar" },
  { name: "Acid Etch - Elegant Frost", psf: 1.785, pg: 2, brand: "Llumar" },
  { name: "Silver Shimmer - Elegant Frost", psf: 1.785, pg: 2, brand: "Llumar" },
  { name: "Silver Sparkle - Elegant Frost", psf: 1.81, pg: 2, brand: "Llumar" },
  { name: "Dusted Crystal Poly - Elegant Frost", psf: 2.23, pg: 3, brand: "Llumar" },
  { name: "Crackled Glass (NRMV CG HPR) 28X75 - Elegant Frost", psf: 2.88, pg: 4, brand: "Llumar" },
  { name: "Dot Matrix Gradient", psf: 2.23, pg: 3, brand: "Llumar" },
  { name: "Mini Dot Matrix Gradient", psf: 2.23, pg: 3, brand: "Llumar" },
  { name: "Mirror Mini Dot Mtrx Gradient", psf: 2.23, pg: 3, brand: "Llumar" },
  { name: "Grass Blad Gradient", psf: 2.058, pg: 3, brand: "Llumar" },
  { name: "Blizzard Gradient", psf: 3.885, pg: 5, brand: "Llumar" },
  { name: "Static Gradient", psf: 4.24, pg: 6, brand: "Llumar" },
  { name: "Blinds Gradient", psf: 3.885, pg: 5, brand: "Llumar" },
  { name: "Banded Fog Gradient", psf: 4.24, pg: null, brand: "Llumar" },
  { name: "Temporary Black Out - Distinctive Specialties", psf: 0.8925, pg: 1, brand: "Llumar" },
  { name: "Temporary White Out - Distinctive Specialties", psf: 0.8925, pg: 1, brand: "Llumar" },
  { name: "Black (NRMM PS2) - Distinctive Specialties", psf: 0.945, pg: 1, brand: "Llumar" },
  { name: "White (NRMW PS3) - Distinctive Specialties", psf: 0.945, pg: 1, brand: "Llumar" },
  { name: "DECO RED SR HPR - Distinctive Specialties", psf: 1.89, pg: 2, brand: "Llumar" },
  { name: "DECO YELLOW SR HPR - Distinctive Specialties", psf: 1.89, pg: 2, brand: "Llumar" },
  { name: "DECO BLUE SR HPR - Distinctive Specialties", psf: 1.89, pg: 2, brand: "Llumar" },
  { name: "DECO GREEN SR HPR - Distinctive Specialties", psf: 1.89, pg: 2, brand: "Llumar" },
  { name: "White Light Diffuser - Distinctive Specialties", psf: 1.89, pg: 2, brand: "Llumar" },
  { name: "100% White Out - Distinctive Specialties", psf: 1.89, pg: 2, brand: "Llumar" },
  { name: "Stripes (NRM FS SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Matte Stripes (NRM MFS SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Thin lines (NRM FTL SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Bands (NRM FB SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Squares (NRM FSQ SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Matte Squares (NRM MSQ SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Small Dots (NRM FSD SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Matte Small Dots (NRM MFSD SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Mini Dots (NRM FMD SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Rice Paper (NRM FRP SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Fiberglass (NRM FIBG SR HPR) - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Small Etched Stripes - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Medium Etched Stripes - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Etched Squares - Graphic Patterns", psf: 1.47, pg: 1, brand: "Llumar" },
  { name: "Frosted Sparkle - Graphic Patterns", psf: 2.23, pg: 3, brand: "Llumar" },
  { name: "Pinstripes - Graphic Patterns", psf: 2.94, pg: 4, brand: "Llumar" },
  { name: "Privacy Stripes - Graphic Patterns", psf: 2.94, pg: 4, brand: "Llumar" },
  { name: "Barcode - Graphic Patterns", psf: 2.94, pg: 4, brand: "Llumar" },
  { name: "Mini Blinds - Graphic Patterns", psf: 2.94, pg: 4, brand: "Llumar" },
  { name: "White Wood Grain - Graphic Patterns", psf: 2.94, pg: 4, brand: "Llumar" },
  { name: "Metro - Graphic Patterns", psf: 2.94, pg: 4, brand: "Llumar" },
  { name: "Custom / Other", psf: null, pg: null, brand: "Llumar" },
];

export const BRANDS = ["Vista", "3M", "Huper", "Llumar"];

export const BRAND_COLORS: Record<string, string> = {
  Vista: "#1e40af",
  "3M": "#dc2626",
  Huper: "#15803d",
  LLumar: "#7e22ce",
};

// ─── HELPERS ──────────────────────────────────────────────────────────

export const fmt$ = (n: number | null | undefined): string =>
  n == null ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtSF = (n: number | null | undefined): string =>
  n == null ? "—" : n.toFixed(2) + " SF";

export function getRoll(w: number): number {
  for (const r of ROLL_WIDTHS) {
    if (w <= r) return r;
  }
  return ROLL_WIDTHS[ROLL_WIDTHS.length - 1];
}

// V-10.9: Commission is a flat rate per user, not tiered by pricing group.
export function getCommRate(user: User | null): number | null {
  if (!user) return null;
  return user.filmRate;
}

export interface RowData {
  id: number;
  desc: string;
  w: string;
  h: string;
  qty: string;
  film: Film | null;
  pgOverride: number | null;
  lineTotalOverride: string; // manual override for the auto-calculated line total (empty = use calculated value)
}

export interface RowCalc {
  w: number;
  h: number;
  qty: number;
  rollW: number;
  actualSF: number;
  chargedSF: number;
  wastageSF: number;
  pg: number | null;
  psf: number | null;
  lineTotal: number | null;
  calculatedLineTotal: number | null; // the auto-calculated value, kept even when overridden (for reference/reset)
  isOverridden: boolean;
}

export function calcRowGeometry(row: RowData, minD: number): Omit<RowCalc, "pg" | "psf" | "lineTotal" | "calculatedLineTotal" | "isOverridden"> | null {
  if (!row.w || !row.h || !row.qty) return null;
  const w = Math.max(parseFloat(row.w), minD);
  const h = Math.max(parseFloat(row.h), minD);
  const qty = parseInt(row.qty) || 1;

  // "Best Cut" logic (matches Zoho spreadsheet) — three possible cuts, pick cheapest:
  // (A) Roll runs along the width; film unrolled the height+1" direction.
  // (B) Roll runs along the height; film unrolled the width+1" direction.
  // (C) Nest multiple qty side-by-side across one roll width (only when
  //     qty × (width+1) still fits within a single roll ≤72"), unrolled
  //     the height+1" direction — this is the whole line's total SF, not
  //     a per-unit SF, since qty is already combined into one roll run.
  const rollA = getRoll(w + 1);
  const totalSF_A = qty * (rollA * (h + 1)) / 144;

  const rollB = getRoll(h + 1);
  const totalSF_B = qty * (rollB * (w + 1)) / 144;

  const options: { total: number; rollW: number }[] = [
    { total: totalSF_A, rollW: rollA },
    { total: totalSF_B, rollW: rollB },
  ];

  const nestedWidth = qty * (w + 1);
  if (nestedWidth <= 72) {
    const rollC = getRoll(nestedWidth);
    const totalSF_C = (rollC * (h + 1)) / 144;
    options.push({ total: totalSF_C, rollW: rollC });
  }

  const best = options.reduce((min, o) => (o.total < min.total ? o : min));

  const actualSF = (w * h * qty) / 144;
  const chargedSF = best.total;
  return { w, h, qty, rollW: best.rollW, actualSF, chargedSF, wastageSF: chargedSF - actualSF };
}

let _rid = 0;
export const newRow = (): RowData => ({ id: ++_rid, desc: "", w: "", h: "", qty: "1", film: null, pgOverride: null, lineTotalOverride: "" });

export const initials = (n: string): string =>
  n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);
