import {
  BreakpointRule,
  BreakpointStandardId,
  OrganismId,
  SusceptibilityCall,
} from "../types/amr";

export const STANDARD_LABELS: Record<BreakpointStandardId, { name: string; edition: string }> = {
  CLSI_2025: {
    name: "CLSI M100",
    edition: "CLSI M100 Ed. 35 (2025)",
  },
  EUCAST_2025: {
    name: "EUCAST",
    edition: "EUCAST Breakpoint Tables v15.0 (2025)",
  },
};

export const INITIAL_BREAKPOINTS: BreakpointRule[] = [
  // CLSI M100 — E. coli (Enterobacterales)
  {
    id: "clsi-ec-amp",
    standard: "CLSI_2025",
    organism: "E. coli",
    antibiotic: "Ampicillin",
    shortCode: "AMP",
    diskContentUg: "10 µg",
    resistantMaxMm: 13,
    susceptibleMinMm: 17,
    notes: "Enterobacterales standard disk",
  },
  {
    id: "clsi-ec-amc",
    standard: "CLSI_2025",
    organism: "E. coli",
    antibiotic: "Amoxicillin-clavulanic acid",
    shortCode: "AMC",
    diskContentUg: "20/10 µg",
    resistantMaxMm: 13,
    susceptibleMinMm: 18,
  },
  {
    id: "clsi-ec-cro",
    standard: "CLSI_2025",
    organism: "E. coli",
    antibiotic: "Ceftriaxone",
    shortCode: "CRO",
    diskContentUg: "30 µg",
    resistantMaxMm: 19,
    susceptibleMinMm: 23,
  },
  {
    id: "clsi-ec-gen",
    standard: "CLSI_2025",
    organism: "E. coli",
    antibiotic: "Gentamicin",
    shortCode: "CN",
    diskContentUg: "10 µg",
    resistantMaxMm: 12,
    susceptibleMinMm: 15,
  },
  {
    id: "clsi-ec-cip",
    standard: "CLSI_2025",
    organism: "E. coli",
    antibiotic: "Ciprofloxacin",
    shortCode: "CIP",
    diskContentUg: "5 µg",
    resistantMaxMm: 21,
    susceptibleMinMm: 26,
  },
  {
    id: "clsi-ec-sxt",
    standard: "CLSI_2025",
    organism: "E. coli",
    antibiotic: "Trimethoprim-sulfamethoxazole",
    shortCode: "SXT",
    diskContentUg: "1.25/23.75 µg",
    resistantMaxMm: 10,
    susceptibleMinMm: 16,
  },

  // CLSI M100 — S. aureus
  {
    id: "clsi-sa-fox",
    standard: "CLSI_2025",
    organism: "S. aureus",
    antibiotic: "Cefoxitin (MRSA screen)",
    shortCode: "FOX",
    diskContentUg: "30 µg",
    resistantMaxMm: 21,
    susceptibleMinMm: 22,
    notes: "Surrogate marker for mecA-mediated oxacillin resistance (MRSA); no I category",
  },
  {
    id: "clsi-sa-gen",
    standard: "CLSI_2025",
    organism: "S. aureus",
    antibiotic: "Gentamicin",
    shortCode: "CN",
    diskContentUg: "10 µg",
    resistantMaxMm: 12,
    susceptibleMinMm: 15,
  },
  {
    id: "clsi-sa-cip",
    standard: "CLSI_2025",
    organism: "S. aureus",
    antibiotic: "Ciprofloxacin",
    shortCode: "CIP",
    diskContentUg: "5 µg",
    resistantMaxMm: 15,
    susceptibleMinMm: 21,
  },
  {
    id: "clsi-sa-tet",
    standard: "CLSI_2025",
    organism: "S. aureus",
    antibiotic: "Tetracycline",
    shortCode: "TET",
    diskContentUg: "30 µg",
    resistantMaxMm: 14,
    susceptibleMinMm: 19,
  },
  {
    id: "clsi-sa-ery",
    standard: "CLSI_2025",
    organism: "S. aureus",
    antibiotic: "Erythromycin",
    shortCode: "ERY",
    diskContentUg: "15 µg",
    resistantMaxMm: 13,
    susceptibleMinMm: 23,
  },
  {
    id: "clsi-sa-cli",
    standard: "CLSI_2025",
    organism: "S. aureus",
    antibiotic: "Clindamycin",
    shortCode: "DA",
    diskContentUg: "2 µg",
    resistantMaxMm: 14,
    susceptibleMinMm: 21,
  },
  {
    id: "clsi-sa-sxt",
    standard: "CLSI_2025",
    organism: "S. aureus",
    antibiotic: "Trimethoprim-sulfamethoxazole",
    shortCode: "SXT",
    diskContentUg: "1.25/23.75 µg",
    resistantMaxMm: 10,
    susceptibleMinMm: 16,
  },

  // EUCAST v15.0 — E. coli
  {
    id: "eucast-ec-amp",
    standard: "EUCAST_2025",
    organism: "E. coli",
    antibiotic: "Ampicillin",
    shortCode: "AMP",
    diskContentUg: "10 µg",
    resistantMaxMm: 13,
    susceptibleMinMm: 14,
    notes: "EUCAST S >= 14 mm, R < 14 mm",
  },
  {
    id: "eucast-ec-amc",
    standard: "EUCAST_2025",
    organism: "E. coli",
    antibiotic: "Amoxicillin-clavulanic acid",
    shortCode: "AMC",
    diskContentUg: "20/10 µg",
    resistantMaxMm: 18,
    susceptibleMinMm: 19,
  },
  {
    id: "eucast-ec-cro",
    standard: "EUCAST_2025",
    organism: "E. coli",
    antibiotic: "Ceftriaxone",
    shortCode: "CRO",
    diskContentUg: "30 µg",
    resistantMaxMm: 21,
    susceptibleMinMm: 25,
    notes: "Area of Technical Uncertainty / I zone 22–24 mm",
  },
  {
    id: "eucast-ec-gen",
    standard: "EUCAST_2025",
    organism: "E. coli",
    antibiotic: "Gentamicin",
    shortCode: "CN",
    diskContentUg: "10 µg",
    resistantMaxMm: 16,
    susceptibleMinMm: 17,
  },
  {
    id: "eucast-ec-cip",
    standard: "EUCAST_2025",
    organism: "E. coli",
    antibiotic: "Ciprofloxacin",
    shortCode: "CIP",
    diskContentUg: "5 µg",
    resistantMaxMm: 21,
    susceptibleMinMm: 25,
  },
  {
    id: "eucast-ec-sxt",
    standard: "EUCAST_2025",
    organism: "E. coli",
    antibiotic: "Trimethoprim-sulfamethoxazole",
    shortCode: "SXT",
    diskContentUg: "1.25/23.75 µg",
    resistantMaxMm: 10,
    susceptibleMinMm: 14,
  },

  // EUCAST v15.0 — S. aureus
  {
    id: "eucast-sa-fox",
    standard: "EUCAST_2025",
    organism: "S. aureus",
    antibiotic: "Cefoxitin (MRSA screen)",
    shortCode: "FOX",
    diskContentUg: "30 µg",
    resistantMaxMm: 21,
    susceptibleMinMm: 22,
    notes: "S >= 22 mm, R < 22 mm",
  },
  {
    id: "eucast-sa-gen",
    standard: "EUCAST_2025",
    organism: "S. aureus",
    antibiotic: "Gentamicin",
    shortCode: "CN",
    diskContentUg: "10 µg",
    resistantMaxMm: 17,
    susceptibleMinMm: 18,
  },
  {
    id: "eucast-sa-cip",
    standard: "EUCAST_2025",
    organism: "S. aureus",
    antibiotic: "Ciprofloxacin",
    shortCode: "CIP",
    diskContentUg: "5 µg",
    resistantMaxMm: 20,
    susceptibleMinMm: 50,
    notes: "EUCAST uses I (Susceptible, increased exposure) 21–49 mm",
  },
  {
    id: "eucast-sa-tet",
    standard: "EUCAST_2025",
    organism: "S. aureus",
    antibiotic: "Tetracycline",
    shortCode: "TET",
    diskContentUg: "30 µg",
    resistantMaxMm: 18,
    susceptibleMinMm: 22,
  },
  {
    id: "eucast-sa-ery",
    standard: "EUCAST_2025",
    organism: "S. aureus",
    antibiotic: "Erythromycin",
    shortCode: "ERY",
    diskContentUg: "15 µg",
    resistantMaxMm: 17,
    susceptibleMinMm: 21,
  },
  {
    id: "eucast-sa-cli",
    standard: "EUCAST_2025",
    organism: "S. aureus",
    antibiotic: "Clindamycin",
    shortCode: "DA",
    diskContentUg: "2 µg",
    resistantMaxMm: 18,
    susceptibleMinMm: 22,
  },
  {
    id: "eucast-sa-sxt",
    standard: "EUCAST_2025",
    organism: "S. aureus",
    antibiotic: "Trimethoprim-sulfamethoxazole",
    shortCode: "SXT",
    diskContentUg: "1.25/23.75 µg",
    resistantMaxMm: 13,
    susceptibleMinMm: 17,
  },
];

export function interpretZoneDiameter(
  zoiMm: number,
  antibiotic: string,
  organism: OrganismId,
  standard: BreakpointStandardId,
  rules: BreakpointRule[]
): { call: SusceptibilityCall; rule: BreakpointRule | null } {
  const rule =
    rules.find(
      (r) =>
        r.standard === standard &&
        r.organism === organism &&
        r.antibiotic.toLowerCase() === antibiotic.toLowerCase()
    ) ?? null;

  if (!rule) {
    return { call: "UNASSIGNED", rule: null };
  }

  // Round to nearest 0.5 or integer standard clinical reading
  const rounded = Math.round(zoiMm);
  if (rounded >= rule.susceptibleMinMm) {
    return { call: "S", rule };
  }
  if (rounded <= rule.resistantMaxMm) {
    return { call: "R", rule };
  }
  return { call: "I", rule };
}

export function formatSirLabel(call: SusceptibilityCall): string {
  switch (call) {
    case "S":
      return "Susceptible (S)";
    case "I":
      return "Intermediate (I)";
    case "R":
      return "Resistant (R)";
    default:
      return "Unassigned";
  }
}
