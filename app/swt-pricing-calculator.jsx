import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ─── DATA ──────────────────────────────────────────────────────────────────────

const PRICING_GROUPS = {
  1:15.73,2:16.78,3:17.83,4:19.86,5:22.88,6:26.13,7:23.40,8:33.52,9:39.90,10:45.98
};
const ROLL_WIDTHS = [36,48,60,72];
const MIN_PRICE = 250;
const COMM_TIERS = [0,500,1000,1500,2000,2500,3000,4000,5000,7500,10000,20000,50000];
const COMM_RATES = {
  1:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  2:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  3:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  4:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  5:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  6:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  7:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  8:[0,null,null,null,null,0.02,0.04,0.06,0.07,0.08,0.09,0.10],
  9:[0,null,null,null,null,0.02,0.04,0.06,0.07,0.08,0.09,0.10],
  10:[0,null,null,null,null,0.02,0.04,0.06,0.07,0.08,0.09,0.10]
};
const DESIGNERS = [
  {id:"barb",name:"Barb",loc:"Colorado",glassRate:0.20},
  {id:"shannon",name:"Shannon",loc:"Texas",glassRate:0.15},
  {id:"leigh",name:"Leigh",loc:"KS/MO",glassRate:0.10},
  {id:"amy",name:"Amy",loc:"Utah",glassRate:0.05},
  {id:"brooke",name:"Brooke",loc:"Arizona",glassRate:0.05},
  {id:"vince",name:"Vince",loc:"Tennessee",glassRate:null},
  {id:"martin",name:"Martin",loc:"Georgia",glassRate:null},
  {id:"derek",name:"Derek",loc:"California",glassRate:null},
  {id:"sammy",name:"Sammy",loc:"Wyoming",glassRate:null},
  {id:"mike",name:"Mike",loc:"New Mexico",glassRate:null},
  {id:"office",name:"Office",loc:"National",glassRate:null},
];
const FILMS = [
  // Vista
  {name:"V 33 SR CDF - Neutral",psf:1.50,pg:2,brand:"Vista"},
  {name:"V 45 SR CDF - Neutral",psf:1.50,pg:2,brand:"Vista"},
  {name:"V 58 SR CDF - Neutral",psf:1.50,pg:2,brand:"Vista"},
  {name:"V 33 BR SR CDF - Neutral",psf:1.52,pg:2,brand:"Vista"},
  {name:"V 14 SR CDF - Dual Reflective",psf:1.52,pg:2,brand:"Vista"},
  {name:"V 18 SR CDF - Dual Reflective",psf:1.52,pg:2,brand:"Vista"},
  {name:"V 28 SR CDF - Dual Reflective",psf:1.52,pg:2,brand:"Vista"},
  {name:"V 28 SR PS8 - Safety - Dual Reflective",psf:2.17,pg:3,brand:"Vista"},
  {name:"V 38 SR CDF - Dual Reflective",psf:1.52,pg:2,brand:"Vista"},
  {name:"V 38 SR PS8 - Safety - Dual Reflective",psf:2.17,pg:3,brand:"Vista"},
  {name:"V 48 SR CDF - Dual Reflective",psf:1.52,pg:2,brand:"Vista"},
  {name:"VE 35 SR CDF - Low-E",psf:1.48,pg:1,brand:"Vista"},
  {name:"VE 50 SR CDF - Low-E",psf:1.48,pg:1,brand:"Vista"},
  {name:"VS 60 SR CDF - Spectrally Selective",psf:5.47,pg:7,brand:"Vista"},
  {name:"VS 61 SR CDF - Spectrally Selective",psf:1.70,pg:2,brand:"Vista"},
  {name:"VS 70 SR CDF - Spectrally Selective",psf:5.47,pg:7,brand:"Vista"},
  {name:"Ceramic 35 SR PS",psf:2.87,pg:4,brand:"Vista"},
  {name:"Ceramic 45 SR PS",psf:2.87,pg:4,brand:"Vista"},
  {name:"Ceramic 55 SR PS",psf:2.87,pg:4,brand:"Vista"},
  {name:"Ceramic 65 SR PS",psf:2.87,pg:4,brand:"Vista"},
  {name:"RN 07G SR CDF - Reflective",psf:1.02,pg:1,brand:"Vista"},
  {name:"R 15 G SR CDF - Reflective",psf:1.16,pg:1,brand:"Vista"},
  {name:"R 15 B SR CDF - Reflective",psf:1.16,pg:1,brand:"Vista"},
  {name:"R 15 Gold SR PS - Reflective",psf:1.60,pg:2,brand:"Vista"},
  {name:"R 15 Blue SR PS - Reflective",psf:1.60,pg:2,brand:"Vista"},
  {name:"R 20 SR CDF - Reflective",psf:0.93,pg:1,brand:"Vista"},
  {name:"R 35 SR CDF - Reflective",psf:0.93,pg:1,brand:"Vista"},
  {name:"R 50 SR CDF - Reflective",psf:0.93,pg:1,brand:"Vista"},
  {name:"DR 5 SR CDF - Dual Reflective",psf:1.04,pg:1,brand:"Vista"},
  {name:"DR 15 SR CDF - Dual Reflective",psf:1.04,pg:1,brand:"Vista"},
  {name:"DR 15 SR PS5 - Safety Security Solar",psf:2.14,pg:3,brand:"Vista"},
  {name:"DR 25 SR PS5 - Safety Security Solar",psf:2.14,pg:3,brand:"Vista"},
  {name:"DR 25 SR PS9 - Safety Security Solar",psf:2.81,pg:4,brand:"Vista"},
  {name:"DR 25 SR CDF - Dual Reflective",psf:1.04,pg:1,brand:"Vista"},
  {name:"DR 35 SR CDF - Dual Reflective",psf:1.04,pg:1,brand:"Vista"},
  {name:"SunTek DRDS 15",psf:1.28,pg:1,brand:"Vista"},
  {name:"SunTek DRDS 25",psf:1.25,pg:1,brand:"Vista"},
  {name:"SunTek DRDS 35",psf:1.25,pg:1,brand:"Vista"},
  {name:"N1020 SR CDF - Neutral",psf:1.20,pg:1,brand:"Vista"},
  {name:"N1050 SR CDF - Neutral",psf:1.20,pg:1,brand:"Vista"},
  {name:"N1065 SR CDF - Neutral",psf:1.20,pg:1,brand:"Vista"},
  {name:"N1020B SR CDF - Neutral",psf:1.27,pg:1,brand:"Vista"},
  {name:"N1035B SR CDF - Neutral",psf:1.27,pg:1,brand:"Vista"},
  {name:"E 1220 SR CDF - Low-E",psf:1.3335,pg:1,brand:"Vista"},
  {name:"DL 05G SR CDF - Deluxe",psf:1.58,pg:2,brand:"Vista"},
  {name:"DL 15B SR CDF - Deluxe",psf:1.36,pg:1,brand:"Vista"},
  {name:"DL 15G SR CDF - Deluxe",psf:1.36,pg:1,brand:"Vista"},
  {name:"DL 30 GN SR PS - Deluxe",psf:1.60,pg:2,brand:"Vista"},
  {name:"SCL SR PS2 - Safety/Security",psf:0.96,pg:1,brand:"Vista"},
  {name:"SCL SR PS4 - Safety/Security",psf:1.01,pg:1,brand:"Vista"},
  {name:"SCL SR PS7 - Safety/Security",psf:1.29,pg:1,brand:"Vista"},
  {name:"SCL SR PS8 - Safety/Security",psf:1.51,pg:2,brand:"Vista"},
  {name:"SCL SR PS13 - Safety/Security",psf:3.86,pg:5,brand:"Vista"},
  {name:"R 20 SR PS5 - Safety/Security",psf:1.72,pg:2,brand:"Vista"},
  {name:"R 20 SR PS9 - Safety/Security",psf:2.24,pg:3,brand:"Vista"},
  {name:"N1020 SR PS4 - Safety/Security",psf:1.62,pg:2,brand:"Vista"},
  {name:"N1020 SR PS8 - Safety/Security",psf:2.01,pg:3,brand:"Vista"},
  {name:"N1040 SR PS4 - Safety/Security",psf:1.62,pg:2,brand:"Vista"},
  {name:"N1040 SR PS8 - Safety/Security",psf:2.01,pg:3,brand:"Vista"},
  {name:"N1050 SR PS4 - Safety/Security",psf:1.62,pg:2,brand:"Vista"},
  {name:"N1050 SR PS8 - Safety/Security",psf:2.01,pg:3,brand:"Vista"},
  {name:"NUV 65 SR PS4 - Safety/Security",psf:2.03,pg:3,brand:"Vista"},
  {name:"RHE 20 ER HPR - Exterior",psf:1.94,pg:2,brand:"Vista"},
  {name:"RHE 35 ER HPR - Exterior",psf:1.94,pg:2,brand:"Vista"},
  {name:"RHE 50 ER HPR - Exterior",psf:1.94,pg:2,brand:"Vista"},
  {name:"NHE 20 ER HPR - Exterior",psf:2.55,pg:4,brand:"Vista"},
  {name:"NHE 35 ER HPR - Exterior",psf:2.55,pg:4,brand:"Vista"},
  {name:"THE 80 BLER HPR - Exterior",psf:3.31,pg:5,brand:"Vista"},
  {name:"SHE CL ER PS4 - Exterior",psf:2.65,pg:4,brand:"Vista"},
  {name:"SHE CL ER PS7 - Exterior",psf:3.05,pg:5,brand:"Vista"},
  {name:"GCL SR PS4 - Graffiti",psf:0.88,pg:1,brand:"Vista"},
  {name:"GCL SR PS6 - Graffiti",psf:1.15,pg:1,brand:"Vista"},
  {name:"Frost (NRM PS2) - Elegant Frost",psf:0.83,pg:1,brand:"Vista"},
  {name:"Mist (NRM80 PS2) - Elegant Frost",psf:0.94,pg:1,brand:"Vista"},
  {name:"Glacier (NRM55 PS4) - Elegant Frost",psf:0.94,pg:1,brand:"Vista"},
  {name:"Bronze (NRMB PS2) - Elegant Frost",psf:0.94,pg:1,brand:"Vista"},
  {name:"Silver (RMS PS2) - Elegant Frost",psf:1.81,pg:2,brand:"Vista"},
  {name:"Satin Crystal (NRMV SC HPR) - Elegant Frost",psf:1.40,pg:1,brand:"Vista"},
  {name:"Brushed Crystal (NRMV BC HPR) - Elegant Frost",psf:1.40,pg:1,brand:"Vista"},
  {name:"Satin Crystal Clear - Elegant Frost",psf:1.40,pg:1,brand:"Vista"},
  {name:"Sandblast - Elegant Frost",psf:1.40,pg:1,brand:"Vista"},
  {name:"Frosted Glass - Elegant Frost",psf:1.40,pg:1,brand:"Vista"},
  {name:"Etched Frost (NRMV60F PS3) - Elegant Frost",psf:1.81,pg:2,brand:"Vista"},
  {name:"Dusted Crystal (NRMV80DC PS3) - Elegant Frost",psf:1.81,pg:2,brand:"Vista"},
  {name:"Dusted Frost - Elegant Frost",psf:1.81,pg:2,brand:"Vista"},
  {name:"Acid Etch - Elegant Frost",psf:1.785,pg:2,brand:"Vista"},
  {name:"Silver Shimmer - Elegant Frost",psf:1.785,pg:2,brand:"Vista"},
  {name:"Silver Sparkle - Elegant Frost",psf:1.81,pg:2,brand:"Vista"},
  {name:"Dusted Crystal Poly - Elegant Frost",psf:2.23,pg:3,brand:"Vista"},
  {name:"Crackled Glass (NRMV CG HPR) 28X75 - Elegant Frost",psf:2.88,pg:4,brand:"Vista"},
  {name:"Dot Matrix Gradient",psf:2.23,pg:3,brand:"Vista"},
  {name:"Mini Dot Matrix Gradient",psf:2.23,pg:3,brand:"Vista"},
  {name:"Mirror Mini Dot Mtrx Gradient",psf:2.23,pg:3,brand:"Vista"},
  {name:"Grass Blad Gradient",psf:2.058,pg:3,brand:"Vista"},
  {name:"Blizzard Gradient",psf:3.885,pg:5,brand:"Vista"},
  {name:"Static Gradient",psf:4.24,pg:6,brand:"Vista"},
  {name:"Blinds Gradient",psf:3.885,pg:5,brand:"Vista"},
  {name:"Temporary Black Out - Distinctive Specialties",psf:0.8925,pg:1,brand:"Vista"},
  {name:"Temporary White Out - Distinctive Specialties",psf:0.8925,pg:1,brand:"Vista"},
  {name:"Black (NRMM PS2) - Distinctive Specialties",psf:0.945,pg:1,brand:"Vista"},
  {name:"White (NRMW PS3) - Distinctive Specialties",psf:0.945,pg:1,brand:"Vista"},
  {name:"DECO RED SR HPR - Distinctive Specialties",psf:1.89,pg:2,brand:"Vista"},
  {name:"DECO YELLOW SR HPR - Distinctive Specialties",psf:1.89,pg:2,brand:"Vista"},
  {name:"DECO BLUE SR HPR - Distinctive Specialties",psf:1.89,pg:2,brand:"Vista"},
  {name:"DECO GREEN SR HPR - Distinctive Specialties",psf:1.89,pg:2,brand:"Vista"},
  {name:"White Light Diffuser - Distinctive Specialties",psf:1.89,pg:2,brand:"Vista"},
  {name:"100% White Out - Distinctive Specialties",psf:1.89,pg:2,brand:"Vista"},
  {name:"Stripes (NRM FS SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Matte Stripes (NRM MFS SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Thin Lines (NRM FTL SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Bands (NRM FB SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Squares (NRM FSQ SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Matte Squares (NRM MSQ SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Small Dots (NRM FSD SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Matte Small Dots (NRM MFSD SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Mini Dots (NRM FMD SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Rice Paper (NRM FRP SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Fiberglass (NRM FIBG SR HPR) - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Small Etched Stripes - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Medium Etched Stripes - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Etched Squares - Graphic Patterns",psf:1.47,pg:1,brand:"Vista"},
  {name:"Frosted Sparkle - Graphic Patterns",psf:2.23,pg:3,brand:"Vista"},
  {name:"Pinstripes - Graphic Patterns",psf:2.94,pg:4,brand:"Vista"},
  {name:"Privacy Stripes - Graphic Patterns",psf:2.94,pg:4,brand:"Vista"},
  {name:"Barcode - Graphic Patterns",psf:2.94,pg:4,brand:"Vista"},
  {name:"Mini Blinds - Graphic Patterns",psf:2.94,pg:4,brand:"Vista"},
  {name:"White Wood Grain - Graphic Patterns",psf:2.94,pg:4,brand:"Vista"},
  {name:"Metro - Graphic Patterns",psf:2.94,pg:4,brand:"Vista"},
  {name:"Privacy Matte",psf:1.02,pg:1,brand:"Vista"},
  {name:"Privacy Mirror",psf:2.05,pg:3,brand:"Vista"},
  // 3M
  {name:"AERINA",psf:4.76,pg:6,brand:"3M"},
  {name:"Affinity 15",psf:1.70,pg:2,brand:"3M"},
  {name:"Affinity 30",psf:1.70,pg:2,brand:"3M"},
  {name:"ALTAIR",psf:2.22,pg:3,brand:"3M"},
  {name:"Anti Graffiti 4 (AG-4)",psf:1.57,pg:2,brand:"3M"},
  {name:"Anti Graffiti 6 (AG-6)",psf:1.94,pg:2,brand:"3M"},
  {name:"ARPA - BLACK VERTICAL",psf:3.97,pg:5,brand:"3M"},
  {name:"ARPA CRYSTAL",psf:3.97,pg:5,brand:"3M"},
  {name:"ARPA - VERTICAL",psf:3.97,pg:5,brand:"3M"},
  {name:"ASTRAL SILVER-PRISM",psf:4.73,pg:6,brand:"3M"},
  {name:"AURA 9 - DOT",psf:4.73,pg:6,brand:"3M"},
  {name:"BLACK BLOCKOUT MATTE FILM",psf:1.71,pg:2,brand:"3M"},
  {name:"BLACK ELECTROCUT FILM",psf:1.54,pg:2,brand:"3M"},
  {name:"CEILO - DOT",psf:4.73,pg:6,brand:"3M"},
  {name:"Ceramic 35 (CA35)",psf:2.80,pg:4,brand:"3M"},
  {name:"Ceramic 45 (CA45)",psf:2.80,pg:4,brand:"3M"},
  {name:"Ceramic 60 (CA60)",psf:2.80,pg:4,brand:"3M"},
  {name:"Ceramic 80 (CA80)",psf:2.80,pg:4,brand:"3M"},
  {name:"CHAMONIX",psf:2.57,pg:4,brand:"3M"},
  {name:"CLOUD",psf:5.66,pg:7,brand:"3M"},
  {name:"DIAMOND",psf:5.66,pg:7,brand:"3M"},
  {name:"DICHROIC FILM (DEP-A) BLAZE",psf:9.16,pg:9,brand:"3M"},
  {name:"DICHROIC FILM (DEP-A) CHILL",psf:9.19,pg:9,brand:"3M"},
  {name:"DIFFUSER FILM WHITE",psf:1.61,pg:2,brand:"3M"},
  {name:"DUSTED CRYSTAL",psf:2.50,pg:4,brand:"3M"},
  {name:"DUSTED CRYSTAL NON LOGO",psf:2.50,pg:4,brand:"3M"},
  {name:"ESSEN",psf:2.57,pg:4,brand:"3M"},
  {name:"Exterior Prestige 20 PRX 20",psf:5.63,pg:6,brand:"3M"},
  {name:"Exterior Prestige 40 PRX 40",psf:5.63,pg:7,brand:"3M"},
  {name:"Exterior Prestige 70 PRX70",psf:5.63,pg:7,brand:"3M"},
  {name:"Exterior Prestige 90 PRX90",psf:4.48,pg:6,brand:"3M"},
  {name:"Fasara Emboss",psf:2.86,pg:4,brand:"3M"},
  {name:"Fasara Fabric Patterns",psf:2.57,pg:4,brand:"3M"},
  {name:"Fasara Gradient Patterns (Cloud Narrow)",psf:3.64,pg:5,brand:"3M"},
  {name:"Fasara Gradient Patterns (Light Gray)",psf:3.64,pg:5,brand:"3M"},
  {name:"Fasara Gradient Patterns (Blue Gray)",psf:3.64,pg:5,brand:"3M"},
  {name:"Fasara Gradient Patterns (Dark Gray)",psf:3.64,pg:5,brand:"3M"},
  {name:"Fasara Gradient Silky Patterns Illumina Silky S",psf:7.09,pg:8,brand:"3M"},
  {name:"Fasara Gradient Silky Patterns Illumina Silky W",psf:9.48,pg:9,brand:"3M"},
  {name:"FINE - VERTICAL",psf:4.73,pg:6,brand:"3M"},
  {name:"FINE CRYSTAL",psf:2.57,pg:4,brand:"3M"},
  {name:"FROSTED BLUE MIST CRYSTAL",psf:2.50,pg:4,brand:"3M"},
  {name:"FROSTED CRYSTAL",psf:2.50,pg:4,brand:"3M"},
  {name:"FROSTED GOLD CRYSTAL",psf:2.50,pg:4,brand:"3M"},
  {name:"FROSTED MINT CRYSTAL",psf:2.33,pg:3,brand:"3M"},
  {name:"FROSTED ROSE CRYSTAL",psf:2.50,pg:4,brand:"3M"},
  {name:"FROSTED VIOLET SKY",psf:2.50,pg:4,brand:"3M"},
  {name:"GLACE",psf:2.17,pg:3,brand:"3M"},
  {name:"ILLUMINA",psf:4.76,pg:6,brand:"3M"},
  {name:"ILLUMINA BLACK",psf:4.72,pg:6,brand:"3M"},
  {name:"ILLUMINA GLACE",psf:4.76,pg:6,brand:"3M"},
  {name:"ILLUMINA P (FOR PLASTIC)",psf:4.91,pg:6,brand:"3M"},
  {name:"ILLUMINA SILVER",psf:4.76,pg:6,brand:"3M"},
  {name:"KANON - DOT",psf:3.97,pg:5,brand:"3M"},
  {name:"KENUN",psf:2.23,pg:3,brand:"3M"},
  {name:"LATTICE - HORIZONTAL",psf:4.37,pg:6,brand:"3M"},
  {name:"LATTICE GLACE - BORDER HORIZONTAL",psf:4.37,pg:6,brand:"3M"},
  {name:"LAUSANNE",psf:2.17,pg:3,brand:"3M"},
  {name:"LE 20 - Sun Control Film",psf:2.81,pg:4,brand:"3M"},
  {name:"LE 35 - Sun Control Film",psf:2.48,pg:3,brand:"3M"},
  {name:"LEISE - HORIZONTAL",psf:4.73,pg:6,brand:"3M"},
  {name:"LINEN",psf:2.23,pg:3,brand:"3M"},
  {name:"LINEN CRYSTAL",psf:2.23,pg:3,brand:"3M"},
  {name:"LONTANO",psf:5.66,pg:7,brand:"3M"},
  {name:"LUCE",psf:2.57,pg:4,brand:"3M"},
  {name:"LUNA 6-DOT",psf:4.73,pg:6,brand:"3M"},
  {name:"LUNA 9 - DOT",psf:4.73,pg:6,brand:"3M"},
  {name:"MARE",psf:4.81,pg:6,brand:"3M"},
  {name:"MAT CRYSTAL 1",psf:2.57,pg:4,brand:"3M"},
  {name:"MAT CRYSTAL CRX2 - EXTERIOR",psf:4.65,pg:6,brand:"3M"},
  {name:"MILANO - MILKY WHITE",psf:1.91,pg:2,brand:"3M"},
  {name:"MILKY CRYSTAL",psf:2.57,pg:4,brand:"3M"},
  {name:"Neutral 20 (RE20NEARL)",psf:2.52,pg:4,brand:"3M"},
  {name:"Neutral 35 (RE35NEARL)",psf:2.40,pg:3,brand:"3M"},
  {name:"Neutral 35 Exterior",psf:3.11,pg:5,brand:"3M"},
  {name:"Neutral 50 (RE50NEARL)",psf:2.34,pg:3,brand:"3M"},
  {name:"Neutral 70 (RE70NEARL)",psf:2.32,pg:3,brand:"3M"},
  {name:"Night Vision 15 (NV-15)",psf:2.67,pg:4,brand:"3M"},
  {name:"Night Vision 25 (NV-25)",psf:2.67,pg:4,brand:"3M"},
  {name:"Night Vision 35 (NV-35)",psf:2.67,pg:4,brand:"3M"},
  {name:"NOKTO - HORIZONTAL",psf:4.73,pg:6,brand:"3M"},
  {name:"OPAQUE BLACK",psf:4.82,pg:6,brand:"3M"},
  {name:"OPAQUE WHITE",psf:2.57,pg:4,brand:"3M"},
  {name:"OSLO",psf:2.57,pg:4,brand:"3M"},
  {name:"OSLO - P FOR PLASTIC",psf:2.23,pg:3,brand:"3M"},
  {name:"PARACELL - HORIZONTAL",psf:4.73,pg:6,brand:"3M"},
  {name:"PIXELLA - HORIZONTAL",psf:4.73,pg:6,brand:"3M"},
  {name:"Prestige 20",psf:5.03,pg:7,brand:"3M"},
  {name:"Prestige 40",psf:5.03,pg:7,brand:"3M"},
  {name:"Prestige 50",psf:5.03,pg:7,brand:"3M"},
  {name:"Prestige 60",psf:5.59,pg:7,brand:"3M"},
  {name:"Prestige 70",psf:5.59,pg:7,brand:"3M"},
  {name:"PRISM NOIR - PRISM",psf:4.73,pg:6,brand:"3M"},
  {name:"PRISM SILVER - PRISM",psf:4.73,pg:6,brand:"3M"},
  {name:"RADIUS",psf:4.42,pg:6,brand:"3M"},
  {name:"RIKYU",psf:2.23,pg:3,brand:"3M"},
  {name:"ROBE",psf:4.91,pg:6,brand:"3M"},
  {name:"S40 Exterior (SH4CLARXL)",psf:2.29,pg:3,brand:"3M"},
  {name:"S70 Exterior (SH7CLARXL)",psf:2.65,pg:4,brand:"3M"},
  {name:"SABRINA",psf:5.67,pg:7,brand:"3M"},
  {name:"Safety Neutral 35",psf:2.93,pg:4,brand:"3M"},
  {name:"Safety S2400",psf:17.00,pg:9,brand:"3M"},
  {name:"Safety S140 (SH14CLARL)",psf:4.74,pg:6,brand:"3M"},
  {name:"Safety S40 (SH4CLARL)",psf:1.44,pg:1,brand:"3M"},
  {name:"Safety S70 (SH7CLARL)",psf:1.69,pg:2,brand:"3M"},
  {name:"Safety S80 (SH8CLARL)",psf:1.69,pg:2,brand:"3M"},
  {name:"Safety Silver 20",psf:2.65,pg:4,brand:"3M"},
  {name:"SAFU",psf:2.23,pg:3,brand:"3M"},
  {name:"SAGANO",psf:2.23,pg:3,brand:"3M"},
  {name:"SAN MARINO - MILKY MILKY",psf:1.91,pg:2,brand:"3M"},
  {name:"SAN MARINO - MILKY MILKY (Gray)",psf:3.64,pg:5,brand:"3M"},
  {name:"SCOTCHCAL CLEAR VIEW GRAPHIC",psf:1.81,pg:2,brand:"3M"},
  {name:"SEATTLE - FINE",psf:4.73,pg:6,brand:"3M"},
  {name:"SEATTLE - VERTICAL",psf:4.73,pg:6,brand:"3M"},
  {name:"SHIZUKU-DOT",psf:4.73,pg:6,brand:"3M"},
  {name:"SHUTIE - BLACK VERTICAL",psf:4.73,pg:6,brand:"3M"},
  {name:"SHUTIE - VERTICAL",psf:4.73,pg:6,brand:"3M"},
  {name:"SILVER 1",psf:5.67,pg:7,brand:"3M"},
  {name:"Silver 15 Exterior (RE15SIARXL)",psf:2.75,pg:4,brand:"3M"},
  {name:"Silver 35 (RE35SIARL)",psf:1.83,pg:2,brand:"3M"},
  {name:"Silver P-18 (P18ARL)",psf:2.01,pg:3,brand:"3M"},
  {name:"SLAT - HORIZONTAL",psf:4.73,pg:6,brand:"3M"},
  {name:"SLAT GLACE - BORDER HORIZONTAL",psf:4.73,pg:6,brand:"3M"},
  {name:"TSURUGI",psf:5.67,pg:7,brand:"3M"},
  {name:"Ultra Night Vision S25 (S25NVAR400)",psf:4.25,pg:6,brand:"3M"},
  {name:"Ultra Prestige 50",psf:6.37,pg:8,brand:"3M"},
  {name:"Ultra Prestige 70",psf:6.37,pg:8,brand:"3M"},
  {name:"Ultra S800",psf:4.50,pg:6,brand:"3M"},
  {name:"VEGA",psf:2.23,pg:3,brand:"3M"},
  {name:"VENETIAN",psf:5.81,pg:7,brand:"3M"},
  {name:"VISTA - DOT",psf:4.73,pg:6,brand:"3M"},
  {name:"WHITE BLOCKOUT MATTE FILM",psf:1.41,pg:1,brand:"3M"},
  {name:"WHITE ELECTROCUT FILM",psf:1.55,pg:2,brand:"3M"},
  {name:"WHITEBOARD FILM - POST IT FLEX WRITE SURFACE",psf:4.47,pg:6,brand:"3M"},
  {name:"WHITEBOARD FILM - GLASS",psf:5.14,pg:7,brand:"3M"},
  {name:"YAMATO",psf:2.23,pg:3,brand:"3M"},
  // Huper Optik
  {name:"CLEAR CERAMIC KLAR 85",psf:4.65,pg:6,brand:"Huper"},
  {name:"CLEAR CERAMIC 70",psf:7.268,pg:8,brand:"Huper"},
  {name:"X3 CERAMIC 30",psf:4.025,pg:6,brand:"Huper"},
  {name:"X3 CERAMIC 40",psf:4.025,pg:6,brand:"Huper"},
  {name:"X3 CERAMIC 50",psf:2.5645,pg:4,brand:"Huper"},
  {name:"X3 CERAMIC 60",psf:2.5645,pg:4,brand:"Huper"},
  {name:"SINGLE LAYER CERAMIC 35",psf:2.4035,pg:3,brand:"Huper"},
  {name:"SINGLE LAYER CERAMIC 45",psf:2.4035,pg:3,brand:"Huper"},
  {name:"DARK CERAMIC 20",psf:4.60,pg:6,brand:"Huper"},
  {name:"SECH",psf:6.7505,pg:8,brand:"Huper"},
  {name:"DREI",psf:8.211,pg:9,brand:"Huper"},
  {name:"THERM X 30",psf:3.1625,pg:5,brand:"Huper"},
  {name:"THERM X 70",psf:3.1625,pg:5,brand:"Huper"},
  {name:"DUAL REFLECTIVE FUSION HF10",psf:1.4605,pg:1,brand:"Huper"},
  {name:"DUAL REFLECTIVE FUSION HF20",psf:1.4605,pg:1,brand:"Huper"},
  {name:"DUAL REFLECTIVE FUSION HF28",psf:1.4605,pg:1,brand:"Huper"},
  {name:"TRADITIONAL SILVER TSL 18",psf:1.311,pg:1,brand:"Huper"},
  {name:"TRADITIONAL SILVER TSL 30",psf:1.311,pg:1,brand:"Huper"},
  {name:"TRADITIONAL BRONZE TSL 25",psf:1.84,pg:2,brand:"Huper"},
  {name:"TRADITIONAL BRONZE TSL 40",psf:1.84,pg:2,brand:"Huper"},
  {name:"DECORATIVE FROST",psf:1.012,pg:1,brand:"Huper"},
  {name:"DECORATIVE MATT BLACK",psf:1.219,pg:1,brand:"Huper"},
  {name:"DECORATIVE DUSTED CRYSTAL",psf:2.5875,pg:4,brand:"Huper"},
  {name:"DECORATIV WHITE OUT",psf:1.219,pg:1,brand:"Huper"},
  {name:"SECURITY 4 MIL",psf:1.4375,pg:1,brand:"Huper"},
  {name:"SECURITY 8 MIL",psf:2.1735,pg:3,brand:"Huper"},
  {name:"SECURITY 14 MIL",psf:3.174,pg:5,brand:"Huper"},
  {name:"SECURITY SHIELD 35 NEUTRAL 8 MIL",psf:3.174,pg:5,brand:"Huper"},
  {name:"LLumar — Custom / Other",psf:null,pg:null,brand:"LLumar"},
];

const BRANDS = ["Vista","3M","Huper","LLumar"];
const BRAND_COLORS = {Vista:"#1e40af","3M":"#dc2626",Huper:"#15803d",LLumar:"#7e22ce"};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmt$ = n => n==null?"—":"$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtSF = n => n==null?"—":n.toFixed(2)+" SF";

function getRoll(w){for(const r of ROLL_WIDTHS){if(w<=r)return r;}return 72;}

function getCommRate(pg,total){
  if(!pg||!COMM_RATES[pg])return null;
  const rates=COMM_RATES[pg];
  let idx=0;
  for(let i=0;i<COMM_TIERS.length;i++){if(total>=COMM_TIERS[i])idx=i;}
  return rates[idx]??null;
}

function calcRowGeometry(row,minD){
  if(!row.w||!row.h||!row.qty)return null;
  const w=Math.max(parseFloat(row.w),minD);
  const h=Math.max(parseFloat(row.h),minD);
  const qty=parseInt(row.qty)||1;
  const rollW=getRoll(w);
  const actualSF=(w*h*qty)/144;
  const chargedSF=(rollW*(h+1)*qty)/144;
  return{w,h,qty,rollW,actualSF,chargedSF,wastageSF:chargedSF-actualSF};
}

let _rid=0;
const newRow=()=>({id:++_rid,desc:"",w:"",h:"",qty:1,film:null,pgOverride:null});
const initials=n=>n.split(" ").map(x=>x[0]).join("").toUpperCase().slice(0,2);

// ─── ROW FILM PICKER ──────────────────────────────────────────────────────────

function FilmPicker({film, pgOverride, onFilm, onPgOverride}){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const ref=useRef(null);

  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  const grouped=useMemo(()=>{
    const lo=q.toLowerCase();
    const list=q?FILMS.filter(f=>f.name.toLowerCase().includes(lo)):FILMS;
    return BRANDS.map(b=>({brand:b,films:list.filter(f=>f.brand===b)})).filter(g=>g.films.length>0);
  },[q]);

  const effectivePg=pgOverride??film?.pg??null;
  const psf=effectivePg?PRICING_GROUPS[effectivePg]:null;

  return(
    <div ref={ref} style={{position:"relative",width:"100%"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{
        display:"flex",alignItems:"center",gap:6,padding:"5px 8px",
        border:"1px solid",borderColor:open?"#3b82f6":"transparent",
        borderRadius:6,background:open?"#fff":film?"#f0f9ff":"transparent",
        cursor:"pointer",minWidth:0,
      }}>
        {film?(
          <>
            <span style={{fontSize:11,fontWeight:700,color:BRAND_COLORS[film.brand],background:BRAND_COLORS[film.brand]+"18",padding:"1px 5px",borderRadius:4,flexShrink:0}}>{film.brand}</span>
            <span style={{fontSize:12,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{film.name}</span>
            <span style={{fontSize:11,color:"#64748b",flexShrink:0}}>Grp {effectivePg}</span>
          </>
        ):(
          <span style={{fontSize:12,color:"#94a3b8",flex:1}}>Select film…</span>
        )}
        <svg width="10" height="10" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg>
      </div>

      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 2px)",left:0,width:480,background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,zIndex:300,boxShadow:"0 12px 40px rgba(0,0,0,.15)",display:"flex",flexDirection:"column",maxHeight:360}}>
          <div style={{padding:"8px 10px",borderBottom:"1px solid #f1f5f9",display:"flex",gap:8}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search 295 films…" style={{flex:1,padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            <select value={pgOverride??film?.pg??""} onChange={e=>onPgOverride(e.target.value?parseInt(e.target.value):null)} style={{padding:"6px 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",color:"#374151"}}>
              <option value="">Auto group</option>
              {Object.entries(PRICING_GROUPS).map(([g,p])=><option key={g} value={g}>Grp {g} · ${p.toFixed(2)}/SF</option>)}
            </select>
          </div>
          <div style={{overflowY:"auto",flex:1}}>
            {grouped.map(({brand,films})=>(
              <div key={brand}>
                <div style={{padding:"5px 12px 3px",fontSize:10,fontWeight:700,color:BRAND_COLORS[brand],textTransform:"uppercase",letterSpacing:".07em",background:"#f8fafc",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0}}>{brand}</div>
                {films.map(f=>(
                  <div key={f.name} onClick={()=>{onFilm(f);setOpen(false);setQ("");}}
                    style={{padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,color:"#1e293b",borderBottom:"1px solid #f8fafc",background:film?.name===f.name?"#eff6ff":"transparent"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f0f9ff"}
                    onMouseLeave={e=>e.currentTarget.style.background=film?.name===f.name?"#eff6ff":"transparent"}>
                    <span style={{flex:1,paddingRight:8}}>{f.name}</span>
                    <span style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>Grp {f.pg} · ${f.psf?.toFixed(2)}/SF</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {film&&<div onClick={()=>{onFilm(null);onPgOverride(null);setOpen(false);}} style={{padding:"8px 12px",borderTop:"1px solid #f1f5f9",fontSize:12,color:"#ef4444",cursor:"pointer",textAlign:"center"}}
            onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"}
            onMouseLeave={e=>e.currentTarget.style.background=""}>Clear film</div>}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App(){
  const [designer,setDesigner]=useState(null);
  const [showDesModal,setShowDesModal]=useState(false);
  const [customer,setCustomer]=useState("");
  const [address,setAddress]=useState("");
  const [minDim,setMinDim]=useState(8);
  const [rows,setRows]=useState([newRow(),newRow(),newRow()]);
  const [activeTab,setActiveTab]=useState("customer");
  const [invoice,setInvoice]=useState({customer:"",internal:""});
  const [generating,setGenerating]=useState(false);

  const updateRow=useCallback((id,field,val)=>setRows(prev=>prev.map(r=>r.id===id?{...r,[field]:val}:r)),[]);
  const removeRow=useCallback(id=>setRows(prev=>prev.filter(r=>r.id!==id)),[]);
  const addRow=useCallback(()=>setRows(prev=>[...prev,newRow()]),[]);

  // Per-row calculations
  const lineCalcs=useMemo(()=>rows.map(row=>{
    const geo=calcRowGeometry(row,minDim);
    if(!geo)return null;
    const pg=row.pgOverride??row.film?.pg??null;
    const psf=pg?PRICING_GROUPS[pg]:null;
    const lineTotal=psf?geo.chargedSF*psf:null;
    return{...geo,pg,psf,lineTotal};
  }),[rows,minDim]);

  // Job totals
  const totals=useMemo(()=>{
    let totalActual=0,totalCharged=0,totalPrice=0,winCount=0;
    let highestPg=0;
    lineCalcs.forEach(c=>{
      if(!c)return;
      totalActual+=c.actualSF;
      totalCharged+=c.chargedSF;
      winCount+=c.qty;
      if(c.lineTotal)totalPrice+=c.lineTotal;
      if(c.pg&&c.pg>highestPg)highestPg=c.pg;
    });
    const hasPrice=totalPrice>0;
    const rawTotal=hasPrice?totalPrice:null;
    const total=rawTotal!=null?Math.max(rawTotal,MIN_PRICE):null;
    const minAdj=(total!=null&&rawTotal!=null&&total>rawTotal)?total-rawTotal:0;
    const commRate=(highestPg&&total)?getCommRate(highestPg,total):null;
    const commission=(total!=null&&commRate!=null)?total*commRate:null;
    return{totalActual,totalCharged,totalPrice,winCount,highestPg,rawTotal,total,minAdj,commRate,commission};
  },[lineCalcs]);

  async function generateInvoice(){
    if(!totals.total)return;
    setGenerating(true);
    const lines=rows.map((row,i)=>{
      const c=lineCalcs[i];
      if(!c||!c.lineTotal)return null;
      return{desc:row.desc||`Window ${i+1}`,w:row.w,h:row.h,qty:c.qty,film:row.film?.name||"—",brand:row.film?.brand||"—",pg:c.pg,psf:c.psf?.toFixed(2),rollW:c.rollW,actSF:c.actualSF.toFixed(2),chrSF:c.chargedSF.toFixed(2),wasteSF:c.wastageSF.toFixed(2),lineTotal:c.lineTotal.toFixed(2)};
    }).filter(Boolean);
    try{
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1200,messages:[{role:"user",content:`Generate two proposal versions for Scottish Window Tinting (7075 S. Alton Way, Centennial, CO 80112 | scottishwindowtinting.com).

Customer: ${customer||"—"} | Address: ${address||"—"}
Designer: ${designer?.name||"—"} (${designer?.loc||"—"}) | Date: ${new Date().toLocaleDateString()}
Min dimension applied: ${minDim}" | Min job price: $${MIN_PRICE}

Line items (each window has its own film):
${lines.map(l=>`  ${l.desc}: ${l.w}"×${l.h}" qty ${l.qty} | Film: ${l.film} (${l.brand}) | Group ${l.pg} · $${l.psf}/SF | ${l.rollW}" roll | ${l.chrSF} charged SF (${l.actSF} actual, ${l.wasteSF} wastage) | Line total: $${l.lineTotal}`).join("\n")}

Job totals: ${totals.totalActual.toFixed(2)} actual SF, ${totals.totalCharged.toFixed(2)} charged SF
Subtotal: $${totals.totalPrice.toFixed(2)}${totals.minAdj>0?` → adjusted to $${totals.total?.toFixed(2)} (minimum)`:` = $${totals.total?.toFixed(2)}`}
Commission basis: highest pricing group on job = Group ${totals.highestPg}
Commission: ${totals.commission!=null?`$${totals.commission.toFixed(2)} (${totals.commRate!=null?(totals.commRate*100).toFixed(0)+"%":"—"} of $${totals.total?.toFixed(2)})`:"N/A"}

Return ONLY a JSON object (no markdown) with:
- "customer": professional customer-facing proposal with line items (description, dimensions, qty, line price), subtotal, total. NO film cost codes, no $/SF, no commission, no roll widths, no group numbers.
- "internal": complete internal record with all technical details — film names, brands, pricing groups, $/SF, roll widths, actual/charged/wastage SF per line, commission breakdown.
Each under 400 words.`}]})
      });
      const data=await resp.json();
      const text=data.content?.find(b=>b.type==="text")?.text||"";
      let parsed;
      try{parsed=JSON.parse(text.replace(/```json|```/g,"").trim());}
      catch{parsed={customer:text,internal:text};}
      setInvoice({customer:parsed.customer||text,internal:parsed.internal||text});
      setActiveTab("customer");
    }catch{setInvoice({customer:"Invoice generation failed.",internal:""});}
    setGenerating(false);
  }

  function resetJob(){
    setCustomer("");setAddress("");
    setRows([newRow(),newRow(),newRow()]);
    setInvoice({customer:"",internal:""});
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#f8fafc",minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <header style={{background:"#0f172a",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,flexShrink:0,borderBottom:"1px solid #1e293b"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,#0ea5e9,#6366f1)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontSize:11,fontWeight:700}}>SWT</span>
          </div>
          <span style={{color:"#f1f5f9",fontWeight:600,fontSize:14}}>Scottish Window Tinting</span>
          <span style={{color:"#475569",fontSize:13,marginLeft:4}}>/ Film Pricing</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,color:"#64748b"}}>Min dim</span>
            <input type="number" value={minDim} min={1} step={0.5} onChange={e=>setMinDim(parseFloat(e.target.value)||8)} style={{width:52,padding:"4px 8px",background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#f1f5f9",fontSize:12,fontFamily:"inherit",textAlign:"center"}}/>
            <span style={{fontSize:12,color:"#64748b"}}>"</span>
          </div>
          <button onClick={()=>setShowDesModal(true)} style={{display:"flex",alignItems:"center",gap:8,background:designer?"#1e293b":"#1d4ed8",border:"1px solid",borderColor:designer?"#334155":"#2563eb",borderRadius:8,padding:"5px 12px 5px 7px",cursor:"pointer",color:"#f1f5f9"}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:designer?"#0ea5e9":"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff"}}>
              {designer?initials(designer.name):"?"}
            </div>
            <span style={{fontSize:13,fontWeight:500}}>{designer?designer.name:"Select designer"}</span>
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
      </header>

      <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 296px",overflow:"hidden"}}>

        {/* LEFT */}
        <div style={{padding:"20px 24px",overflowY:"auto",display:"flex",flexDirection:"column",gap:20}}>

          {/* Job info */}
          <section>
            <p style={sectionLabel}>Job info</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Customer name" style={inputSt}/>
              <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Job address" style={inputSt}/>
            </div>
          </section>

          {/* Windows */}
          <section>
            <p style={sectionLabel}>Windows — each row can use a different film</p>
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
              {/* Header */}
              <div style={{display:"grid",gridTemplateColumns:"120px 1fr 60px 60px 52px 80px 80px 36px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
                {["Description","Film","W\"","H\"","Qty","Roll","Chg SF",""].map((h,i)=>(
                  <div key={i} style={{padding:"8px 8px",fontSize:10,fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {rows.map((row,idx)=>{
                const c=lineCalcs[idx];
                return(
                  <div key={row.id} style={{display:"grid",gridTemplateColumns:"120px 1fr 60px 60px 52px 80px 80px 36px",borderBottom:"1px solid #f1f5f9",alignItems:"center",background:"#fff"}}>
                    {/* Description */}
                    <div style={{padding:"4px 6px"}}>
                      <input value={row.desc} onChange={e=>updateRow(row.id,"desc",e.target.value)} placeholder={`Window ${idx+1}`} style={{...cellSt,width:"100%"}}/>
                    </div>
                    {/* Film picker — full width across its column */}
                    <div style={{padding:"4px 4px",minWidth:0}}>
                      <FilmPicker
                        film={row.film}
                        pgOverride={row.pgOverride}
                        onFilm={f=>updateRow(row.id,"film",f)}
                        onPgOverride={v=>updateRow(row.id,"pgOverride",v)}
                      />
                    </div>
                    {/* W */}
                    <div style={{padding:"4px 4px"}}>
                      <input type="number" min="1" step="0.5" value={row.w} onChange={e=>updateRow(row.id,"w",e.target.value)} placeholder="0" style={{...cellSt,width:"100%",textAlign:"right"}}/>
                    </div>
                    {/* H */}
                    <div style={{padding:"4px 4px"}}>
                      <input type="number" min="1" step="0.5" value={row.h} onChange={e=>updateRow(row.id,"h",e.target.value)} placeholder="0" style={{...cellSt,width:"100%",textAlign:"right"}}/>
                    </div>
                    {/* Qty */}
                    <div style={{padding:"4px 4px"}}>
                      <input type="number" min="1" step="1" value={row.qty} onChange={e=>updateRow(row.id,"qty",e.target.value)} style={{...cellSt,width:"100%",textAlign:"right"}}/>
                    </div>
                    {/* Roll badge */}
                    <div style={{padding:"4px 8px"}}>
                      {c?<span style={{background:"#eff6ff",color:"#1d4ed8",fontWeight:600,fontSize:11,padding:"2px 7px",borderRadius:5}}>{c.rollW}"</span>:<span style={{color:"#cbd5e1",fontSize:12}}>—</span>}
                    </div>
                    {/* Charged SF + line total */}
                    <div style={{padding:"4px 8px"}}>
                      {c&&c.lineTotal!=null?(
                        <div>
                          <div style={{fontSize:12,fontWeight:600,color:"#0f172a",fontVariantNumeric:"tabular-nums"}}>{fmt$(c.lineTotal)}</div>
                          <div style={{fontSize:10,color:"#94a3b8"}}>{c.chargedSF.toFixed(1)} SF</div>
                        </div>
                      ):(
                        <span style={{color:"#cbd5e1",fontSize:12}}>{c?c.chargedSF.toFixed(1)+" SF":"—"}</span>
                      )}
                    </div>
                    {/* Delete */}
                    <div style={{padding:"4px 4px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <button onClick={()=>removeRow(row.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#cbd5e1",padding:4,borderRadius:4,lineHeight:1}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#fee2e2";e.currentTarget.style.color="#ef4444";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="#cbd5e1";}}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}

              <button onClick={addRow} style={{width:"100%",padding:"9px 12px",background:"none",border:"none",borderTop:"1px solid #f1f5f9",cursor:"pointer",color:"#3b82f6",fontSize:13,display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}}
                onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                Add window
              </button>
            </div>
            {/* Film summary badges */}
            {rows.some(r=>r.film)&&(
              <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:5}}>
                {[...new Map(rows.filter(r=>r.film).map(r=>[r.film.name,r.film])).values()].map(f=>(
                  <span key={f.name} style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:BRAND_COLORS[f.brand]+"15",color:BRAND_COLORS[f.brand],fontWeight:500,border:`1px solid ${BRAND_COLORS[f.brand]}30`}}>
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{background:"#fff",borderLeft:"1px solid #e2e8f0",display:"flex",flexDirection:"column",overflowY:"auto"}}>
          <div style={{padding:"20px 18px 0"}}>
            <p style={sectionLabel}>Summary</p>
            <div style={{background:"#f8fafc",borderRadius:10,marginBottom:14}}>
              {[
                ["Windows",totals.winCount||"—"],
                ["Actual SF",totals.totalActual>0?fmtSF(totals.totalActual):"—"],
                ["Charged SF",totals.totalCharged>0?fmtSF(totals.totalCharged):"—"],
                ["Wastage",totals.totalCharged>0?fmtSF(totals.totalCharged-totals.totalActual):"—"],
                ["Subtotal",totals.rawTotal?fmt$(totals.rawTotal):"—"],
                ...(totals.minAdj>0?[["Min adjustment",`+${fmt$(totals.minAdj)}`]]:[[]])
              ].filter(r=>r.length===2).map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 13px",borderBottom:"1px solid #e2e8f0"}}>
                  <span style={{fontSize:12,color:"#64748b"}}>{l}</span>
                  <span style={{fontSize:12,color:"#0f172a",fontVariantNumeric:"tabular-nums"}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 13px"}}>
                <span style={{fontSize:15,fontWeight:600,color:"#0f172a"}}>Total</span>
                <span style={{fontSize:19,fontWeight:700,color:"#0f172a",fontVariantNumeric:"tabular-nums"}}>{totals.total?fmt$(totals.total):"—"}</span>
              </div>
            </div>

            {totals.commission!=null&&(
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"11px 13px",marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>Your commission</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontSize:22,fontWeight:700,color:"#15803d",fontVariantNumeric:"tabular-nums"}}>{fmt$(totals.commission)}</span>
                  <span style={{fontSize:12,color:"#16a34a"}}>{(totals.commRate*100).toFixed(0)}% · Grp {totals.highestPg}</span>
                </div>
              </div>
            )}
          </div>

          {/* Invoice */}
          <div style={{padding:"0 18px",flex:1,display:"flex",flexDirection:"column"}}>
            <p style={sectionLabel}>Invoice</p>
            <div style={{display:"flex",borderBottom:"1px solid #e2e8f0",marginBottom:9}}>
              {["customer","internal"].map(t=>(
                <button key={t} onClick={()=>setActiveTab(t)} style={{padding:"5px 12px",fontSize:12,fontWeight:activeTab===t?600:400,color:activeTab===t?"#1d4ed8":"#64748b",background:"none",border:"none",borderBottom:`2px solid ${activeTab===t?"#3b82f6":"transparent"}`,cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize"}}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{flex:1,background:"#f8fafc",borderRadius:8,padding:11,fontSize:11,lineHeight:1.7,color:"#475569",whiteSpace:"pre-wrap",fontFamily:"ui-monospace,monospace",overflowY:"auto",minHeight:100,maxHeight:220}}>
              {generating?(
                <div style={{display:"flex",gap:5,alignItems:"center",justifyContent:"center",padding:16}}>
                  {[0,.2,.4].map(d=><div key={d} style={{width:5,height:5,borderRadius:"50%",background:"#94a3b8",animation:`p 1s ${d}s infinite`}}/>)}
                  <style>{`@keyframes p{0%,80%,100%{opacity:.2}40%{opacity:1}}`}</style>
                  <span style={{fontFamily:"inherit",color:"#94a3b8"}}>Generating…</span>
                </div>
              ):(
                (activeTab==="customer"?invoice.customer:invoice.internal)||
                <span style={{color:"#cbd5e1",fontFamily:"inherit"}}>Generate invoice below</span>
              )}
            </div>
          </div>

          <div style={{padding:16,display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={generateInvoice} disabled={generating||!totals.total} style={{width:"100%",padding:10,background:"#1d4ed8",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:(!totals.total||generating)?0.5:1}}>
              Generate invoice
            </button>
            <button onClick={resetJob} style={{width:"100%",padding:8,background:"#f1f5f9",color:"#475569",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
              New job
            </button>
          </div>
        </div>
      </div>

      {/* Designer modal */}
      {showDesModal&&(
        <div onClick={()=>setShowDesModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:22,width:360,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
            <h2 style={{fontSize:15,fontWeight:600,marginBottom:14,color:"#0f172a"}}>Select designer</h2>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {DESIGNERS.map(d=>(
                <div key={d.id} onClick={()=>{setDesigner(d);setShowDesModal(false);}}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 13px",border:`1px solid ${designer?.id===d.id?"#3b82f6":"#e2e8f0"}`,borderRadius:8,cursor:"pointer",background:designer?.id===d.id?"#eff6ff":"#fff"}}
                  onMouseEnter={e=>{if(designer?.id!==d.id)e.currentTarget.style.background="#f8fafc";}}
                  onMouseLeave={e=>{if(designer?.id!==d.id)e.currentTarget.style.background="#fff";}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"#0ea5e9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>
                    {initials(d.name)}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:"#0f172a"}}>{d.name}</div>
                    <div style={{fontSize:11,color:"#94a3b8"}}>{d.loc}{d.glassRate!=null?` · ${Math.round(d.glassRate*100)}% glass commission`:""}</div>
                  </div>
                  {designer?.id===d.id&&<svg style={{marginLeft:"auto",flexShrink:0}} width="15" height="15" fill="none" stroke="#3b82f6" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const sectionLabel={fontSize:11,fontWeight:600,color:"#64748b",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10};
const inputSt={padding:"8px 12px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",color:"#0f172a",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"};
const cellSt={padding:"5px 7px",border:"1px solid transparent",borderRadius:6,background:"transparent",color:"#0f172a",fontSize:12,fontFamily:"inherit",outline:"none"};
