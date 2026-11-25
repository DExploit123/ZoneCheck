import React, { useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, SlidersHorizontal, Upload } from "lucide-react";
import {
  BreakpointRule,
  BreakpointStandardId,
  DetectedDisk,
  ImageQualityReport,
  OrganismId,
  PlateMetadata,
  SavedPlateRecord,
} from "./types/amr";
import { INITIAL_BREAKPOINTS } from "./data/breakpoints";
import { PILOT_VALIDATION_COHORT, SAMPLE_PLATES } from "./data/samplePlates";
import { fileToDataUrl, imageUrlToResizedBase64 } from "./utils/calibration";
import { PlateCaliperCanvas } from "./components/PlateCaliperCanvas";
import { DiskInspectorPanel } from "./components/DiskInspectorPanel";
import { ValidationPitchView } from "./components/ValidationPitchView";
import { BreakpointManagerView } from "./components/BreakpointManagerView";
import { RecordingSheetView } from "./components/RecordingSheetView";

type AppTab = "reader" | "validation" | "breakpoints" | "sheet";

function guessAntibioticFromCode(
  printedCode: string,
  organism: OrganismId,
  standard: BreakpointStandardId,
  rules: BreakpointRule[]
): { antibiotic: string; diskContentUg: string } {
  const code = printedCode.toUpperCase().trim();
  if (!code) {
    return { antibiotic: "", diskContentUg: "" };
  }

  // Extract leading alphabetic token (e.g. "FFC 30" -> "FFC", "AMC30" -> "AMC")
  const tokens = code.replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/);
  const alphaToken = tokens[0]?.replace(/[0-9]+$/, "") ?? "";
  const orgRules = rules.filter((r) => r.standard === standard && r.organism === organism);

  for (const r of orgRules) {
    const shortUpper = r.shortCode.toUpperCase();
    if (
      alphaToken === shortUpper ||
      tokens.includes(shortUpper) ||
      code === r.antibiotic.toUpperCase()
    ) {
      return { antibiotic: r.antibiotic, diskContentUg: r.diskContentUg };
    }
  }

  // Known alternative standard abbreviations (e.g. GEN for Gentamicin CN, TMP/SMX for SXT)
  if (alphaToken === "GEN" || alphaToken === "GM") {
    const gen = orgRules.find((r) => r.shortCode === "CN");
    if (gen) return { antibiotic: gen.antibiotic, diskContentUg: gen.diskContentUg };
  }
  if (alphaToken === "CLI") {
    const cli = orgRules.find((r) => r.shortCode === "DA");
    if (cli) return { antibiotic: cli.antibiotic, diskContentUg: cli.diskContentUg };
  }

  // Never default unknown codes to Ampicillin or any other panel drug
  return { antibiotic: "", diskContentUg: "" };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("reader");
  const [breakpoints, setBreakpoints] = useState<BreakpointRule[]>(INITIAL_BREAKPOINTS);
  const [savedPlates, setSavedPlates] = useState<SavedPlateRecord[]>([
    ...SAMPLE_PLATES,
    ...PILOT_VALIDATION_COHORT,
  ]);

  const initialPlate = SAMPLE_PLATES[0];
  const [activeRecordId, setActiveRecordId] = useState<string>(initialPlate.id);
  const [imageUrl, setImageUrl] = useState<string>(initialPlate.imageUrl);
  const [scaleDiskNorm, setScaleDiskNorm] = useState<number>(initialPlate.scaleDiskNorm);
  const [metadata, setMetadata] = useState<PlateMetadata>(initialPlate.metadata);
  const [disks, setDisks] = useState<DetectedDisk[]>(initialPlate.disks);
  const [imageQuality, setImageQuality] = useState<ImageQualityReport>(
    initialPlate.imageQuality
  );
  const [selectedDiskId, setSelectedDiskId] = useState<string | null>(
    initialPlate.disks[0]?.id ?? null
  );

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [showPlateDetails, setShowPlateDetails] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSampleOrSavedPlate = (plate: SavedPlateRecord) => {
    setActiveRecordId(plate.id);
    setImageUrl(plate.imageUrl);
    setScaleDiskNorm(plate.scaleDiskNorm);
    setMetadata({ ...plate.metadata });
    setDisks(plate.disks.map((d) => ({ ...d })));
    setImageQuality({ ...plate.imageQuality });
    setSelectedDiskId(plate.disks[0]?.id ?? null);
    setAnalysisError(null);
    setSaveToast(null);
    setActiveTab("reader");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const dataUrl = await fileToDataUrl(file);
      const nextNum = savedPlates.length + 15;
      const prefix = metadata.organism === "E. coli" ? "EC" : "SA";
      const newId = `plate-custom-${Date.now()}`;
      setActiveRecordId(newId);
      setImageUrl(dataUrl);
      setDisks([]);
      setSelectedDiskId(null);
      setAnalysisError(null);
      setSaveToast(null);
      setMetadata((prev) => ({
        ...prev,
        plateId: `${prefix}-${String(nextNum).padStart(3, "0")}`,
        photoFileName: file.name || `${prefix}-${nextNum}_photo1.jpg`,
        readingTime: new Date().toISOString().slice(0, 16).replace("T", " "),
      }));
      setImageQuality({
        overheadAlignmentOk: true,
        glareDetected: false,
        overlappingZonesDetected: false,
        lawnUniformityNote: "Ready for Vision AI disk detection or manual disk placement.",
      });
      setActiveTab("reader");
      await runVisionDetection(dataUrl, metadata.organism, metadata.plateDiameterMm);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to load selected image.");
    }
  };

  const runVisionDetection = async (
    targetImageUrl = imageUrl,
    targetOrganism = metadata.organism,
    targetPlateMm = metadata.plateDiameterMm
  ) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setSaveToast(null);

    try {
      const { base64, mimeType } = await imageUrlToResizedBase64(targetImageUrl, 1400);
      const res = await fetch("/api/analyze-plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          organism: targetOrganism,
          plateDiameterMm: targetPlateMm,
          knownDiskDiameterMm: metadata.knownDiskDiameterMm,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || `Analysis failed with status ${res.status}`);
      }

      const rawDisks = Array.isArray(payload.disks) ? payload.disks : [];
      if (rawDisks.length === 0) {
        throw new Error(
          "No antibiotic disks were detected in this image. Adjust framing or tap Add Disk manually."
        );
      }

      const diskSizes = rawDisks
        .map((d: { diskDiameterNorm?: number }) => Number(d.diskDiameterNorm) || 60)
        .filter((v: number) => v >= 15 && v <= 180)
        .sort((a: number, b: number) => a - b);
      const medianScale =
        typeof payload.medianDiskNorm === "number" && payload.medianDiskNorm >= 15
          ? payload.medianDiskNorm
          : diskSizes.length > 0
            ? diskSizes[Math.floor(diskSizes.length / 2)]
            : 60;

      setScaleDiskNorm(Number(medianScale.toFixed(1)));

      const mappedDisks: DetectedDisk[] = rawDisks.map(
        (
          d: {
            diskCode?: string;
            printedCode?: string;
            orientation_note?: string;
            centerXNorm?: number;
            centerYNorm?: number;
            diskDiameterNorm?: number;
            zoiDiameterNorm?: number;
            edgeNote?: string;
            confidence?: number;
          },
          index: number
        ) => {
          const code = String(d.diskCode ?? d.printedCode ?? "").trim();
          const guessed = guessAntibioticFromCode(
            code,
            targetOrganism,
            metadata.standard,
            breakpoints
          );
          const diskDia = Math.round(Number(d.diskDiameterNorm) || medianScale);
          const zoiDia = Math.max(diskDia, Math.round(Number(d.zoiDiameterNorm) || medianScale));

          return {
            id: `vision-${Date.now()}-${index}`,
            printedCode: code,
            antibiotic: guessed.antibiotic,
            diskContentUg: guessed.diskContentUg,
            diskLot: "Lab Stock",
            diskExpiry: "2027-06",
            centerXNorm: Math.round(Number(d.centerXNorm) || 500),
            centerYNorm: Math.round(Number(d.centerYNorm) || 500),
            diskDiameterNorm: diskDia,
            zoiDiameterNorm: zoiDia,
            manualZoiOverrideMm: null,
            reader1Mm: null,
            reader2Mm: null,
            edgeNote: String(d.edgeNote ?? "Detected by Vision AI"),
            orientationNote: String(d.orientation_note ?? "").trim() || undefined,
            confidence: Number(d.confidence ?? 0.9),
            confirmed: false,
          };
        }
      );

      setDisks(mappedDisks);
      setSelectedDiskId(mappedDisks[0]?.id ?? null);
      if (payload.imageQuality) {
        setImageQuality({
          overheadAlignmentOk: Boolean(payload.imageQuality.overheadAlignmentOk),
          glareDetected: Boolean(payload.imageQuality.glareDetected),
          overlappingZonesDetected: Boolean(payload.imageQuality.overlappingZonesDetected),
          lawnUniformityNote: String(
            payload.imageQuality.lawnUniformityNote || "Vision AI quality check complete."
          ),
        });
      }
    } catch (err: unknown) {
      setAnalysisError(
        err instanceof Error ? err.message : "Vision AI detection encountered an error."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateDisk = (id: string, patch: Partial<DetectedDisk>) => {
    setDisks((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleAddDiskAt = (xNorm: number, yNorm: number) => {
    const newDisk: DetectedDisk = {
      id: `manual-${Date.now()}`,
      printedCode: `M${disks.length + 1}`,
      antibiotic: "",
      diskContentUg: "10 µg",
      diskLot: "Lab Stock",
      diskExpiry: "2027-06",
      centerXNorm: xNorm,
      centerYNorm: yNorm,
      diskDiameterNorm: scaleDiskNorm,
      zoiDiameterNorm: Math.round(scaleDiskNorm * 2.5),
      manualZoiOverrideMm: null,
      reader1Mm: null,
      reader2Mm: null,
      edgeNote: "Manually placed disk",
      confidence: 1,
      confirmed: false,
    };
    setDisks((prev) => [...prev, newDisk]);
    setSelectedDiskId(newDisk.id);
  };

  const handleDeleteDisk = (id: string) => {
    setDisks((prev) => {
      const remaining = prev.filter((d) => d.id !== id);
      if (selectedDiskId === id) {
        setSelectedDiskId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  };

  const handleConfirmAllAndSave = () => {
    const confirmedDisks = disks.map((d) => ({ ...d, confirmed: true }));
    setDisks(confirmedDisks);

    const record: SavedPlateRecord = {
      id: activeRecordId,
      savedAt: new Date().toISOString(),
      imageUrl,
      scaleDiskNorm,
      metadata: { ...metadata },
      disks: confirmedDisks,
      imageQuality: { ...imageQuality },
    };

    setSavedPlates((prev) => {
      const exists = prev.some((p) => p.id === record.id);
      if (exists) {
        return prev.map((p) => (p.id === record.id ? record : p));
      }
      return [record, ...prev];
    });

    setSaveToast(
      `Plate ${metadata.plateId} saved (${confirmedDisks.length} disks confirmed).`
    );
  };

  const handleChangeStandard = (std: BreakpointStandardId) => {
    setMetadata((prev) => ({ ...prev, standard: std }));
    setSavedPlates((prev) =>
      prev.map((p) => ({ ...p, metadata: { ...p.metadata, standard: std } }))
    );
  };

  const activeSampleSlug = useMemo(() => {
    return SAMPLE_PLATES.find((s) => s.id === activeRecordId)?.id ?? null;
  }, [activeRecordId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab("reader")}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            ZoneCheck
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {(
              [
                { id: "reader", label: "Plate Reader" },
                { id: "validation", label: "Validation" },
                { id: "breakpoints", label: "Breakpoints" },
                { id: "sheet", label: "Recording Sheet" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? "border-sky-700 text-slate-900"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture Plate</span>
            </button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden border-t border-slate-200 px-3 flex items-center gap-1 overflow-x-auto bg-slate-50">
          {(
            [
              { id: "reader", label: "Plate Reader" },
              { id: "validation", label: "Validation" },
              { id: "breakpoints", label: "Breakpoints" },
              { id: "sheet", label: "Recording Sheet" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === item.id
                  ? "border-sky-700 text-sky-900"
                  : "border-transparent text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === "reader" && (
          <div className="space-y-4">
            {/* Step 1: Compact Plate Selection & Essential Context Bar */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Sample Plates & Upload */}
                <div className="flex flex-wrap items-center gap-2">
                  {SAMPLE_PLATES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => loadSampleOrSavedPlate(sample)}
                      className={`inline-flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
                        activeSampleSlug === sample.id
                          ? "bg-sky-50 border-sky-400 text-slate-900 font-semibold"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <img
                        src={sample.imageUrl}
                        alt={sample.metadata.plateId}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded object-cover border border-slate-200"
                      />
                      <span className="font-mono">{sample.metadata.plateId}</span>
                      <span className="italic text-slate-500 font-normal">
                        {sample.metadata.organism}
                      </span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-700" />
                    <span>Upload Photo</span>
                  </button>
                </div>

                {/* Essential Clinical Context: Organism + Standard + Optional Details */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
                    {(["E. coli", "S. aureus"] as OrganismId[]).map((org) => (
                      <button
                        key={org}
                        type="button"
                        onClick={() =>
                          setMetadata((prev) => ({ ...prev, organism: org }))
                        }
                        className={`px-2.5 py-1 text-xs font-medium italic rounded transition-colors cursor-pointer ${
                          metadata.organism === org
                            ? "bg-white text-slate-900 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {org}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
                    {(["CLSI_2025", "EUCAST_2025"] as BreakpointStandardId[]).map((std) => (
                      <button
                        key={std}
                        type="button"
                        onClick={() => handleChangeStandard(std)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                          metadata.standard === std
                            ? "bg-white text-slate-900 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {std === "CLSI_2025" ? "CLSI" : "EUCAST"}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPlateDetails((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                      showPlateDetails
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Plate Details</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Secondary Metadata & Manual Calibration Drawer */}
              {showPlateDetails && (
                <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1">Plate ID</label>
                    <input
                      type="text"
                      value={metadata.plateId}
                      onChange={(e) =>
                        setMetadata((prev) => ({ ...prev, plateId: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Strain / QC Type</label>
                    <input
                      type="text"
                      value={metadata.strainType}
                      onChange={(e) =>
                        setMetadata((prev) => ({ ...prev, strainType: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Agar Details</label>
                    <input
                      type="text"
                      value={metadata.agarDetails}
                      onChange={(e) =>
                        setMetadata((prev) => ({ ...prev, agarDetails: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Incubation</label>
                    <input
                      type="text"
                      value={metadata.incubationDetails}
                      onChange={(e) =>
                        setMetadata((prev) => ({
                          ...prev,
                          incubationDetails: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-600">6.0 mm Ring Size</label>
                      <span className="font-mono tabular-nums text-slate-800">
                        {scaleDiskNorm.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={110}
                      step={0.5}
                      value={scaleDiskNorm}
                      onChange={(e) => setScaleDiskNorm(Number(e.target.value))}
                      className="w-full accent-sky-700 mt-1"
                    />
                  </div>
                </div>
              )}

              {analysisError && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <strong>Detection Notice:</strong> {analysisError}
                </div>
              )}

              {saveToast && (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{saveToast}</span>
                </div>
              )}
            </div>

            {/* Step 2: Balanced 2-Column Plate Stage + Focused Disk Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-7">
                <PlateCaliperCanvas
                  imageUrl={imageUrl}
                  plateId={metadata.plateId}
                  organism={metadata.organism}
                  standard={metadata.standard}
                  scaleDiskNorm={scaleDiskNorm}
                  knownDiskDiameterMm={metadata.knownDiskDiameterMm}
                  disks={disks}
                  selectedDiskId={selectedDiskId}
                  breakpoints={breakpoints}
                  imageQuality={imageQuality}
                  isAnalyzing={isAnalyzing}
                  onSelectDisk={setSelectedDiskId}
                  onUpdateDisk={handleUpdateDisk}
                  onAddDiskAt={handleAddDiskAt}
                  onDeleteDisk={handleDeleteDisk}
                  onScaleChange={setScaleDiskNorm}
                  onRunVisionAi={() => runVisionDetection()}
                />
              </div>

              <div className="lg:col-span-5">
                <DiskInspectorPanel
                  organism={metadata.organism}
                  standard={metadata.standard}
                  scaleDiskNorm={scaleDiskNorm}
                  knownDiskDiameterMm={metadata.knownDiskDiameterMm}
                  disks={disks}
                  selectedDiskId={selectedDiskId}
                  breakpoints={breakpoints}
                  onSelectDisk={(id) => setSelectedDiskId(id)}
                  onUpdateDisk={handleUpdateDisk}
                  onConfirmAll={handleConfirmAllAndSave}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "validation" && (
          <ValidationPitchView plates={savedPlates} breakpoints={breakpoints} />
        )}

        {activeTab === "breakpoints" && (
          <BreakpointManagerView
            breakpoints={breakpoints}
            activeStandard={metadata.standard}
            onChangeStandard={handleChangeStandard}
            onUpdateRule={(id, patch) =>
              setBreakpoints((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
            }
            onAddRule={(rule) => setBreakpoints((prev) => [...prev, rule])}
            onResetDefaults={() => setBreakpoints(INITIAL_BREAKPOINTS)}
          />
        )}

        {activeTab === "sheet" && (
          <RecordingSheetView
            plates={savedPlates}
            breakpoints={breakpoints}
            onLoadPlateToReader={(recordId) => {
              const found = savedPlates.find((p) => p.id === recordId);
              if (found) loadSampleOrSavedPlate(found);
            }}
          />
        )}
      </main>
    </div>
  );
}
