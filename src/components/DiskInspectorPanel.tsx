import React, { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
} from "lucide-react";
import {
  BreakpointRule,
  BreakpointStandardId,
  DetectedDisk,
  OrganismId,
} from "../types/amr";
import { formatSirLabel, interpretZoneDiameter } from "../data/breakpoints";
import { computeDiskZoiMm, zoiMmToNorm } from "../utils/calibration";

interface DiskInspectorPanelProps {
  organism: OrganismId;
  standard: BreakpointStandardId;
  scaleDiskNorm: number;
  knownDiskDiameterMm: number;
  disks: DetectedDisk[];
  selectedDiskId: string | null;
  breakpoints: BreakpointRule[];
  onSelectDisk: (id: string) => void;
  onUpdateDisk: (id: string, patch: Partial<DetectedDisk>) => void;
  onConfirmAll: () => void;
}

export const DiskInspectorPanel: React.FC<DiskInspectorPanelProps> = ({
  organism,
  standard,
  scaleDiskNorm,
  knownDiskDiameterMm,
  disks,
  selectedDiskId,
  breakpoints,
  onSelectDisk,
  onUpdateDisk,
  onConfirmAll,
}) => {
  const [showGroundTruth, setShowGroundTruth] = useState(false);

  const organismRules = breakpoints.filter(
    (b) => b.standard === standard && b.organism === organism
  );

  const activeDisk = disks.find((d) => d.id === selectedDiskId) ?? disks[0] ?? null;
  const confirmedCount = disks.filter((d) => d.confirmed).length;

  const adjustZoiByStep = (disk: DetectedDisk, deltaMm: number) => {
    const current = computeDiskZoiMm(disk, scaleDiskNorm, knownDiskDiameterMm);
    const nextMm = Math.max(knownDiskDiameterMm, Math.round((current + deltaMm) * 2) / 2);
    onUpdateDisk(disk.id, {
      zoiDiameterNorm: zoiMmToNorm(nextMm, scaleDiskNorm, knownDiskDiameterMm),
      manualZoiOverrideMm: nextMm,
    });
  };

  const selectNextUnconfirmed = () => {
    if (!activeDisk) return;
    const next = disks.find((d) => d.id !== activeDisk.id && !d.confirmed);
    if (next) {
      onSelectDisk(next.id);
    }
  };

  const renderVerdictBadge = (call: string) => {
    switch (call) {
      case "S":
        return (
          <span className="font-mono text-xs font-semibold text-emerald-700">
            ● Susceptible (S)
          </span>
        );
      case "I":
        return (
          <span className="font-mono text-xs font-semibold text-amber-700">
            ▲ Intermediate (I)
          </span>
        );
      case "R":
        return (
          <span className="font-mono text-xs font-semibold text-rose-700">
            ✖ Resistant (R)
          </span>
        );
      default:
        return <span className="font-mono text-xs text-slate-500">— · Unmapped</span>;
    }
  };

  // Visual Breakpoint Ruler helper (6 mm to 36 mm scale)
  const renderBreakpointBar = (zoiMm: number, rule: BreakpointRule | null) => {
    if (!rule) return null;
    const minScale = 6;
    const maxScale = 36;
    const pct = (mm: number) =>
      Math.max(0, Math.min(100, ((mm - minScale) / (maxScale - minScale)) * 100));

    const rEndPct = pct(rule.resistantMaxMm + 0.5);
    const sStartPct = pct(rule.susceptibleMinMm - 0.5);
    const markerPct = pct(zoiMm);

    return (
      <div className="pt-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1.5 tabular-nums">
          <span>R ≤ {rule.resistantMaxMm} mm</span>
          {rule.susceptibleMinMm - rule.resistantMaxMm > 1 && (
            <span>
              I: {rule.resistantMaxMm + 1}–{rule.susceptibleMinMm - 1}
            </span>
          )}
          <span>S ≥ {rule.susceptibleMinMm} mm</span>
        </div>

        <div className="relative h-3 w-full rounded-full overflow-hidden flex bg-slate-100 border border-slate-200">
          <div style={{ width: `${rEndPct}%` }} className="bg-rose-200 h-full" />
          <div
            style={{ width: `${Math.max(0, sStartPct - rEndPct)}%` }}
            className="bg-amber-200 h-full"
          />
          <div style={{ width: `${Math.max(0, 100 - sStartPct)}%` }} className="bg-emerald-200 h-full" />
        </div>

        {/* Marker Pin */}
        <div className="relative h-3 w-full">
          <div
            style={{ left: `${markerPct}%` }}
            className="absolute -top-3.5 -translate-x-1/2 flex flex-col items-center"
          >
            <div className="w-1 h-4 bg-slate-900 rounded-full" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Focused Single-Disk Inspector Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Selected Disk Inspector</h2>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {confirmedCount} / {disks.length} confirmed
          </span>
        </div>

        {!activeDisk ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No disks detected yet. Click <strong>Auto-Detect Rings (AI)</strong> or{" "}
            <strong>Add Disk</strong> on the plate.
          </div>
        ) : (
          (() => {
            const idx = disks.findIndex((d) => d.id === activeDisk.id);
            const zoiMm = computeDiskZoiMm(activeDisk, scaleDiskNorm, knownDiskDiameterMm);
            const { call, rule } = interpretZoneDiameter(
              zoiMm,
              activeDisk.antibiotic,
              organism,
              standard,
              breakpoints
            );

            return (
              <div className="space-y-4">
                {/* Antibiotic Selector + Verdict Header */}
                <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      Disk {idx + 1} {activeDisk.printedCode ? `· ${activeDisk.printedCode}` : ""}
                      {activeDisk.orientationNote ? ` (${activeDisk.orientationNote})` : ""}
                    </span>
                    {renderVerdictBadge(call)}
                  </div>

                  <select
                    value={activeDisk.antibiotic}
                    onChange={(e) => {
                      const matched = organismRules.find((r) => r.antibiotic === e.target.value);
                      onUpdateDisk(activeDisk.id, {
                        antibiotic: e.target.value,
                        diskContentUg: matched?.diskContentUg ?? activeDisk.diskContentUg,
                      });
                    }}
                    aria-label="Assign antibiotic agent"
                    className="w-full px-3 py-2 text-sm font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  >
                    <option value="">Unmapped / Unknown Disk</option>
                    {organismRules.map((r) => (
                      <option key={r.id} value={r.antibiotic}>
                        {r.antibiotic} ({r.diskContentUg})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Big Touch-Friendly ZOI Measurement Stepper */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <span>Zone of Inhibition Diameter</span>
                    <span className="text-slate-500">Includes 6.0 mm disk</span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => adjustZoiByStep(activeDisk, -0.5)}
                      className="h-11 w-14 flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                      aria-label="Decrease zone diameter by 0.5 mm"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="flex-1 text-center py-1.5 rounded-md bg-slate-50 border border-slate-200">
                      <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900">
                        {zoiMm.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-slate-500 ml-1.5">mm</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => adjustZoiByStep(activeDisk, 0.5)}
                      className="h-11 w-14 flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                      aria-label="Increase zone diameter by 0.5 mm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {renderBreakpointBar(zoiMm, rule)}
                </div>

                {/* Primary Confirmation CTA */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateDisk(activeDisk.id, { confirmed: !activeDisk.confirmed });
                      if (!activeDisk.confirmed) {
                        selectNextUnconfirmed();
                      }
                    }}
                    className={`flex-1 h-11 inline-flex items-center justify-center gap-2 px-4 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                      activeDisk.confirmed
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                        : "bg-sky-700 text-white border-sky-700 hover:bg-sky-800"
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{activeDisk.confirmed ? "Confirmed (Click to Undo)" : "Confirm Disk Result"}</span>
                  </button>

                  {disks.some((d) => d.id !== activeDisk.id && !d.confirmed) && (
                    <button
                      type="button"
                      onClick={selectNextUnconfirmed}
                      title="Jump to next unconfirmed disk"
                      className="h-11 px-3 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Progressive Disclosure: Optional Ground Truth & Morphology Notes */}
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowGroundTruth((v) => !v)}
                    className="w-full flex items-center justify-between text-xs font-medium text-slate-600 hover:text-slate-900 py-1 cursor-pointer"
                  >
                    <span>Lab Ground-Truth Caliper & Notes (Optional)</span>
                    {showGroundTruth ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {showGroundTruth && (
                    <div className="mt-2.5 space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-slate-600 mb-1">Reader 1 (mm)</label>
                          <input
                            type="number"
                            step="0.5"
                            min="6"
                            max="60"
                            placeholder="—"
                            value={activeDisk.reader1Mm ?? ""}
                            onChange={(e) =>
                              onUpdateDisk(activeDisk.id, {
                                reader1Mm: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="w-full px-2.5 py-1.5 font-mono tabular-nums border border-slate-300 rounded bg-white text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">Reader 2 (mm)</label>
                          <input
                            type="number"
                            step="0.5"
                            min="6"
                            max="60"
                            placeholder="—"
                            value={activeDisk.reader2Mm ?? ""}
                            onChange={(e) =>
                              onUpdateDisk(activeDisk.id, {
                                reader2Mm: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="w-full px-2.5 py-1.5 font-mono tabular-nums border border-slate-300 rounded bg-white text-slate-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Morphology Notes</label>
                        <input
                          type="text"
                          value={activeDisk.edgeNote}
                          placeholder="e.g. Slight haze near edge, double zone"
                          onChange={(e) =>
                            onUpdateDisk(activeDisk.id, { edgeNote: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Scannable Plate Summary List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            All Disks on Plate ({disks.length})
          </h3>
          <button
            type="button"
            onClick={onConfirmAll}
            disabled={disks.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirm All & Save</span>
          </button>
        </div>

        <div className="divide-y divide-slate-200">
          {disks.map((disk, idx) => {
            const zoiMm = computeDiskZoiMm(disk, scaleDiskNorm, knownDiskDiameterMm);
            const { call } = interpretZoneDiameter(
              zoiMm,
              disk.antibiotic,
              organism,
              standard,
              breakpoints
            );
            const isSelected = activeDisk?.id === disk.id;

            return (
              <button
                key={disk.id}
                type="button"
                onClick={() => onSelectDisk(disk.id)}
                className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  isSelected ? "bg-sky-50/80" : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    <span className="font-mono text-slate-500 mr-1.5">D{idx + 1}</span>
                    {disk.antibiotic || disk.printedCode || "Unmapped / Unknown Disk"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {disk.confirmed ? "Confirmed" : "Needs review"}
                    {disk.orientationNote ? ` · ${disk.orientationNote}` : ""}
                    {disk.edgeNote ? ` · ${disk.edgeNote}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 font-mono text-xs tabular-nums">
                  <span className="font-semibold text-slate-900">{zoiMm.toFixed(1)} mm</span>
                  <span
                    title={formatSirLabel(call)}
                    className={`w-5 text-center font-semibold ${
                      call === "S"
                        ? "text-emerald-700"
                        : call === "I"
                          ? "text-amber-700"
                          : call === "R"
                            ? "text-rose-700"
                            : "text-slate-400"
                    }`}
                  >
                    {call === "UNASSIGNED" ? "-" : call}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
