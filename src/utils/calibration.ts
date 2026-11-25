import { BreakpointRule, DetectedDisk, SavedPlateRecord } from "../types/amr";
import { interpretZoneDiameter, STANDARD_LABELS } from "../data/breakpoints";

export function computeDiskZoiMm(
  disk: DetectedDisk,
  globalScaleDiskNorm: number,
  knownDiskDiameterMm = 6.0
): number {
  if (disk.manualZoiOverrideMm !== null && Number.isFinite(disk.manualZoiOverrideMm)) {
    return Math.max(knownDiskDiameterMm, disk.manualZoiOverrideMm);
  }
  const refNorm = globalScaleDiskNorm > 0 ? globalScaleDiskNorm : disk.diskDiameterNorm;
  if (refNorm <= 0) return knownDiskDiameterMm;
  const rawMm = (disk.zoiDiameterNorm / refNorm) * knownDiskDiameterMm;
  // Clamp at minimum 6.0 mm (cannot be smaller than the physical paper disk)
  const clamped = Math.max(knownDiskDiameterMm, rawMm);
  return Math.round(clamped * 2) / 2; // Nearest 0.5 mm per Section 8 Hand Measurement Protocol
}

export function zoiMmToNorm(
  zoiMm: number,
  globalScaleDiskNorm: number,
  knownDiskDiameterMm = 6.0
): number {
  return (Math.max(knownDiskDiameterMm, zoiMm) / knownDiskDiameterMm) * globalScaleDiskNorm;
}

export async function imageUrlToResizedBase64(
  url: string,
  maxDimension = 1400
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Unable to initialize 2D canvas context."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = () => reject(new Error("Failed to load plate image for processing."));
    img.src = url;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportRecordingSheetCsv(
  plates: SavedPlateRecord[],
  breakpoints: BreakpointRule[]
): string {
  const headers = [
    "Plate ID",
    "Date & Time (Inoculation / Incubation / Reading)",
    "Organism",
    "Strain Type",
    "Agar Brand, Batch & Depth",
    "Antibiotic",
    "Disk Content",
    "Disk Manufacturer, Lot & Expiry",
    "Incubation Temp & Hours",
    "App Measured ZOI (mm)",
    "Measured ZOI Reader 1 (mm)",
    "Measured ZOI Reader 2 (mm)",
    "Interpretation (S/I/R)",
    "Technician Confirmed",
    "Standard & Edition",
    "Photo File Name",
    "Notes",
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const plate of plates) {
    const stdLabel = STANDARD_LABELS[plate.metadata.standard].edition;
    const timestamps = `${plate.metadata.inoculationTime} / ${plate.metadata.incubationStartTime} / ${plate.metadata.readingTime}`;

    for (const disk of plate.disks) {
      const appZoi = computeDiskZoiMm(
        disk,
        plate.scaleDiskNorm,
        plate.metadata.knownDiskDiameterMm
      );
      const { call } = interpretZoneDiameter(
        appZoi,
        disk.antibiotic,
        plate.metadata.organism,
        plate.metadata.standard,
        breakpoints
      );

      rows.push(
        [
          plate.metadata.plateId,
          timestamps,
          plate.metadata.organism,
          plate.metadata.strainType,
          plate.metadata.agarDetails,
          disk.antibiotic,
          disk.diskContentUg,
          `${disk.diskLot}, exp ${disk.diskExpiry}`,
          plate.metadata.incubationDetails,
          appZoi.toFixed(1),
          disk.reader1Mm !== null ? disk.reader1Mm.toFixed(1) : "",
          disk.reader2Mm !== null ? disk.reader2Mm.toFixed(1) : "",
          call === "UNASSIGNED" ? "" : call,
          disk.confirmed ? "Yes" : "Pending",
          stdLabel,
          plate.metadata.photoFileName,
          disk.edgeNote,
        ]
          .map(escapeCsvCell)
          .join(",")
      );
    }
  }

  return rows.join("\n");
}
