import React, { useRef, useState } from "react";
import {
  Camera,
  Eye,
  EyeOff,
  HelpCircle,
  Plus,
  RotateCcw,
  Scan,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  BreakpointRule,
  BreakpointStandardId,
  DetectedDisk,
  ImageQualityReport,
  OrganismId,
} from "../types/amr";
import { interpretZoneDiameter } from "../data/breakpoints";
import { computeDiskZoiMm } from "../utils/calibration";

interface PlateCaliperCanvasProps {
  imageUrl: string;
  plateId: string;
  organism: OrganismId;
  standard: BreakpointStandardId;
  scaleDiskNorm: number;
  knownDiskDiameterMm: number;
  disks: DetectedDisk[];
  selectedDiskId: string | null;
  breakpoints: BreakpointRule[];
  imageQuality: ImageQualityReport;
  isAnalyzing: boolean;
  onSelectDisk: (id: string | null) => void;
  onUpdateDisk: (id: string, patch: Partial<DetectedDisk>) => void;
  onAddDiskAt: (xNorm: number, yNorm: number) => void;
  onDeleteDisk: (id: string) => void;
  onScaleChange: (newScaleNorm: number) => void;
  onRunVisionAi: () => void;
}

type InspectionFilter = "standard" | "contrast" | "transmitted";

interface DragState {
  diskId: string;
  mode: "move" | "resize-zoi" | "resize-disk";
}

export const PlateCaliperCanvas: React.FC<PlateCaliperCanvasProps> = ({
  imageUrl,
  plateId,
  organism,
  standard,
  scaleDiskNorm,
  knownDiskDiameterMm,
  disks,
  selectedDiskId,
  breakpoints,
  imageQuality,
  isAnalyzing,
  onSelectDisk,
  onUpdateDisk,
  onAddDiskAt,
  onDeleteDisk,
  onScaleChange,
  onRunVisionAi,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [filterMode, setFilterMode] = useState<InspectionFilter>("standard");
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [addMode, setAddMode] = useState<boolean>(false);
  const [showProtocolTip, setShowProtocolTip] = useState<boolean>(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [imageError, setImageError] = useState<boolean>(false);

  const clientToNorm = (clientX: number, clientY: number): { xNorm: number; yNorm: number } => {
    const el = stageRef.current;
    if (!el) return { xNorm: 500, yNorm: 500 };
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 1000;
    const y = ((clientY - rect.top) / rect.height) * 1000;
    return {
      xNorm: Math.max(0, Math.min(1000, x)),
      yNorm: Math.max(0, Math.min(1000, y)),
    };
  };

  const handlePointerDownStage = (e: React.PointerEvent<HTMLDivElement>) => {
    if (addMode) {
      const { xNorm, yNorm } = clientToNorm(e.clientX, e.clientY);
      onAddDiskAt(Math.round(xNorm), Math.round(yNorm));
      setAddMode(false);
    }
  };

  const handlePointerMoveStage = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const { xNorm, yNorm } = clientToNorm(e.clientX, e.clientY);
    const disk = disks.find((d) => d.id === dragState.diskId);
    if (!disk) return;

    if (dragState.mode === "move") {
      onUpdateDisk(disk.id, {
        centerXNorm: Math.round(xNorm),
        centerYNorm: Math.round(yNorm),
      });
    } else if (dragState.mode === "resize-zoi") {
      const dx = xNorm - disk.centerXNorm;
      const dy = yNorm - disk.centerYNorm;
      const radiusNorm = Math.sqrt(dx * dx + dy * dy);
      const newDiameterNorm = Math.max(scaleDiskNorm, Math.round(radiusNorm * 2));
      onUpdateDisk(disk.id, {
        zoiDiameterNorm: newDiameterNorm,
        manualZoiOverrideMm: null,
      });
    } else if (dragState.mode === "resize-disk") {
      const dx = xNorm - disk.centerXNorm;
      const dy = yNorm - disk.centerYNorm;
      const radiusNorm = Math.sqrt(dx * dx + dy * dy);
      const newDiskNorm = Math.max(24, Math.min(140, Math.round(radiusNorm * 2)));
      onScaleChange(newDiskNorm);
      onUpdateDisk(disk.id, {
        diskDiameterNorm: newDiskNorm,
      });
    }
  };

  const handlePointerUpStage = () => {
    if (dragState) {
      setDragState(null);
    }
  };

  const filterStyle: React.CSSProperties =
    filterMode === "contrast"
      ? { filter: "contrast(1.48) brightness(0.96) saturate(0.85)" }
      : filterMode === "transmitted"
        ? { filter: "invert(0.92) contrast(1.38) hue-rotate(180deg)" }
        : {};

  const getCallColor = (call: string) => {
    switch (call) {
      case "S":
        return { stroke: "#059669", fill: "rgba(5, 150, 105, 0.08)" };
      case "I":
        return { stroke: "#D97706", fill: "rgba(217, 119, 6, 0.09)" };
      case "R":
        return { stroke: "#DC2626", fill: "rgba(220, 38, 38, 0.10)" };
      default:
        return { stroke: "#0284C7", fill: "rgba(2, 132, 199, 0.08)" };
    }
  };

  const selectedDisk = disks.find((d) => d.id === selectedDiskId) ?? null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
      {/* Focused Canvas Action Bar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRunVisionAi}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>{isAnalyzing ? "Detecting..." : "Auto-Detect Rings (AI)"}</span>
          </button>

          <button
            type="button"
            onClick={() => setAddMode((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              addMode
                ? "bg-sky-700 text-white border-sky-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{addMode ? "Tap Plate to Place" : "Add Disk"}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200"
            role="group"
            aria-label="Plate lighting filter"
          >
            <button
              type="button"
              onClick={() => setFilterMode("standard")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterMode === "standard"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("contrast")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterMode === "contrast"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Contrast
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("transmitted")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterMode === "transmitted"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Invert
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowOverlays((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
            aria-label="Toggle measurement rings"
          >
            {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <div className="inline-flex items-center border border-slate-200 rounded-md bg-white">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40"
              disabled={zoom <= 1}
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-xs tabular-nums text-slate-700">
              {zoom.toFixed(2).replace(/\.00$/, "")}x
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40"
              disabled={zoom >= 2.5}
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1.5 text-slate-500 hover:text-slate-900 border-l border-slate-200"
                aria-label="Reset zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowProtocolTip((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              showProtocolTip ? "text-sky-700 bg-sky-50" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Photo Guide</span>
          </button>
        </div>
      </div>

      {/* Collapsible Photo Protocol Guide */}
      {showProtocolTip && (
        <div className="px-4 py-3 bg-sky-50/50 border-b border-slate-200 text-xs text-slate-700 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
            <Camera className="w-3.5 h-3.5 text-sky-700" />
            <span>Best Photo Setup:</span>
          </div>
          <span>1. Hold phone flat 20–30 cm directly above plate</span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span>2. Use matte black background, side light, no flash</span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span>3. Whole dish in frame</span>
        </div>
      )}

      {/* Interactive Optical Plate Viewport */}
      <div className="relative bg-slate-950 flex items-center justify-center overflow-auto p-3 sm:p-5 min-h-[360px] lg:min-h-[520px]">
        <div
          ref={stageRef}
          onPointerDown={handlePointerDownStage}
          onPointerMove={handlePointerMoveStage}
          onPointerUp={handlePointerUpStage}
          onPointerLeave={handlePointerUpStage}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
          }}
          className={`relative w-full max-w-[520px] aspect-square select-none touch-none transition-transform duration-150 ${
            addMode ? "cursor-crosshair" : "cursor-default"
          }`}
        >
          {!imageError ? (
            <img
              src={imageUrl}
              alt={`Kirby-Bauer disk diffusion plate ${plateId}`}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              style={filterStyle}
              className="w-full h-full object-cover rounded-md pointer-events-none"
            />
          ) : (
            <div className="w-full h-full rounded-md bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <p className="text-sm font-medium text-slate-200">Plate image unavailable</p>
              <p className="text-xs text-slate-400 mt-1">
                Choose a sample plate or upload a Kirby-Bauer photograph.
              </p>
            </div>
          )}

          {showOverlays && (
            <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full overflow-visible">
              {disks.map((disk, index) => {
                const zoiMm = computeDiskZoiMm(disk, scaleDiskNorm, knownDiskDiameterMm);
                const { call } = interpretZoneDiameter(
                  zoiMm,
                  disk.antibiotic,
                  organism,
                  standard,
                  breakpoints
                );
                const colors = getCallColor(call);
                const isSelected = disk.id === selectedDiskId;
                const diskRadius = scaleDiskNorm / 2;
                const effectiveZoiNorm =
                  disk.manualZoiOverrideMm !== null
                    ? (disk.manualZoiOverrideMm / knownDiskDiameterMm) * scaleDiskNorm
                    : disk.zoiDiameterNorm;
                const zoiRadius = Math.max(diskRadius, effectiveZoiNorm / 2);

                const shortTag =
                  breakpoints.find(
                    (b) =>
                      b.standard === standard &&
                      b.organism === organism &&
                      b.antibiotic.toLowerCase() === disk.antibiotic.toLowerCase()
                  )?.shortCode ||
                  disk.printedCode ||
                  `D${index + 1}`;

                return (
                  <g key={disk.id} opacity={selectedDiskId && !isSelected ? 0.72 : 1}>
                    {/* Outer ZOI Clear Zone Circle */}
                    <circle
                      cx={disk.centerXNorm}
                      cy={disk.centerYNorm}
                      r={zoiRadius}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={isSelected ? 4.5 : 2.5}
                      strokeDasharray={disk.confirmed ? undefined : "8 5"}
                      className="cursor-pointer transition-all"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectDisk(disk.id);
                      }}
                    />

                    {/* Diameter ruler line when selected */}
                    {isSelected && (
                      <line
                        x1={disk.centerXNorm - zoiRadius}
                        y1={disk.centerYNorm}
                        x2={disk.centerXNorm + zoiRadius}
                        y2={disk.centerYNorm}
                        stroke={colors.stroke}
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                    )}

                    {/* Inner 6.0 mm Reference Disk Ring */}
                    <circle
                      cx={disk.centerXNorm}
                      cy={disk.centerYNorm}
                      r={diskRadius}
                      fill="transparent"
                      stroke="#38BDF8"
                      strokeWidth={isSelected ? 3 : 1.75}
                      strokeDasharray="3 3"
                      className="cursor-move"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectDisk(disk.id);
                        setDragState({ diskId: disk.id, mode: "move" });
                      }}
                    />

                    {/* Center Drag Handle */}
                    <circle
                      cx={disk.centerXNorm}
                      cy={disk.centerYNorm}
                      r={isSelected ? 12 : 9}
                      fill={isSelected ? "#0284C7" : "rgba(15, 23, 42, 0.72)"}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      className="cursor-move"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectDisk(disk.id);
                        setDragState({ diskId: disk.id, mode: "move" });
                      }}
                    />

                    {/* Prominent Outer Ring Resize Grip (East edge) */}
                    <g
                      className="cursor-ew-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectDisk(disk.id);
                        setDragState({ diskId: disk.id, mode: "resize-zoi" });
                      }}
                    >
                      {/* Invisible larger touch target for mobile fingers */}
                      <circle
                        cx={disk.centerXNorm + zoiRadius}
                        cy={disk.centerYNorm}
                        r={26}
                        fill="transparent"
                      />
                      <circle
                        cx={disk.centerXNorm + zoiRadius}
                        cy={disk.centerYNorm}
                        r={isSelected ? 15 : 11}
                        fill="#FFFFFF"
                        stroke={colors.stroke}
                        strokeWidth="4"
                      />
                      {isSelected && (
                        <circle
                          cx={disk.centerXNorm + zoiRadius}
                          cy={disk.centerYNorm}
                          r={4}
                          fill={colors.stroke}
                        />
                      )}
                    </g>

                    {/* Inner 6mm Reference Ring Resize Handle (when selected) */}
                    {isSelected && (
                      <g
                        className="cursor-ns-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDragState({ diskId: disk.id, mode: "resize-disk" });
                        }}
                      >
                        <circle
                          cx={disk.centerXNorm}
                          cy={disk.centerYNorm + diskRadius}
                          r={22}
                          fill="transparent"
                        />
                        <rect
                          x={disk.centerXNorm - 8}
                          y={disk.centerYNorm + diskRadius - 8}
                          width="16"
                          height="16"
                          rx="3"
                          fill="#38BDF8"
                          stroke="#0F172A"
                          strokeWidth="2"
                        />
                      </g>
                    )}

                    {/* High-Legibility Monospace Callout Tag */}
                    <g
                      transform={`translate(${disk.centerXNorm}, ${Math.max(
                        34,
                        disk.centerYNorm - zoiRadius - 16
                      )})`}
                      className="cursor-pointer"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectDisk(disk.id);
                      }}
                    >
                      <rect
                        x="-72"
                        y="-21"
                        width="144"
                        height="28"
                        rx="5"
                        fill={isSelected ? "#0F172A" : "rgba(15, 23, 42, 0.88)"}
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? "2.5" : "1.5"}
                      />
                      <text
                        x="0"
                        y="-2"
                        textAnchor="middle"
                        fill="#F8FAFC"
                        fontSize="15"
                        fontFamily="IBM Plex Mono, monospace"
                        fontWeight="600"
                      >
                        {`${shortTag} ${zoiMm.toFixed(1)}mm ${call === "UNASSIGNED" ? "-" : call}`}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] rounded-md flex flex-col items-center justify-center text-white p-6 text-center">
              <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-semibold">Detecting Disks & Clear Zones...</p>
              <p className="text-xs text-slate-300 mt-1 max-w-xs">
                Calibrating millimeter scale from 6.0 mm paper disks.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Clear Interactive Gesture Hint Strip */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            <strong className="text-slate-800">Tap</strong> a ring to inspect
          </span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span>
            <strong className="text-slate-800">Drag white knob</strong> on ring edge to resize zone
          </span>
          {!imageQuality.overheadAlignmentOk && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-amber-700 font-medium">Angle tilt detected</span>
            </>
          )}
        </div>

        {selectedDisk && (
          <button
            type="button"
            onClick={() => onDeleteDisk(selectedDisk.id)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove Disk</span>
          </button>
        )}
      </div>
    </div>
  );
};
