export type OrganismId = "E. coli" | "S. aureus";

export type BreakpointStandardId = "CLSI_2025" | "EUCAST_2025";

export type SusceptibilityCall = "S" | "I" | "R" | "UNASSIGNED";

export interface BreakpointRule {
  id: string;
  standard: BreakpointStandardId;
  organism: OrganismId;
  antibiotic: string;
  shortCode: string;
  diskContentUg: string;
  resistantMaxMm: number; // R <= resistantMaxMm
  susceptibleMinMm: number; // S >= susceptibleMinMm
  notes?: string;
}

export interface DetectedDisk {
  id: string;
  printedCode: string;
  antibiotic: string;
  diskContentUg: string;
  diskLot: string;
  diskExpiry: string;
  centerXNorm: number; // 0..1000
  centerYNorm: number; // 0..1000
  diskDiameterNorm: number; // 0..1000 (represents 6.0 mm)
  zoiDiameterNorm: number; // 0..1000 (includes disk)
  manualZoiOverrideMm: number | null;
  reader1Mm: number | null;
  reader2Mm: number | null;
  edgeNote: string;
  orientationNote?: string;
  confidence: number;
  confirmed: boolean;
}

export interface ImageQualityReport {
  overheadAlignmentOk: boolean;
  glareDetected: boolean;
  overlappingZonesDetected: boolean;
  lawnUniformityNote: string;
}

export interface PlateMetadata {
  plateId: string;
  organism: OrganismId;
  strainType: string;
  plateDiameterMm: 90 | 150;
  knownDiskDiameterMm: number;
  agarDetails: string;
  incubationDetails: string;
  inoculationTime: string;
  incubationStartTime: string;
  readingTime: string;
  photoFileName: string;
  lidRemoved: boolean;
  phoneModel: string;
  standard: BreakpointStandardId;
}

export interface SavedPlateRecord {
  id: string;
  savedAt: string;
  metadata: PlateMetadata;
  imageUrl: string;
  scaleDiskNorm: number; // global calibrated norm units for 6.0 mm
  disks: DetectedDisk[];
  imageQuality: ImageQualityReport;
}
