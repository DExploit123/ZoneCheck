import React, { useMemo, useState } from "react";
import { BreakpointRule, SavedPlateRecord } from "../types/amr";
import { interpretZoneDiameter, STANDARD_LABELS } from "../data/breakpoints";
import { computeDiskZoiMm } from "../utils/calibration";

interface ValidationPitchViewProps {
  plates: SavedPlateRecord[];
  breakpoints: BreakpointRule[];
}

interface ComparisonPoint {
  plateId: string;
  organism: string;
  antibiotic: string;
  appMm: number;
  reader1Mm: number;
  reader2Mm: number | null;
  appCall: string;
  gtCall: string;
  absError: number;
  signedError: number;
  interReaderDiff: number | null;
}

export const ValidationPitchView: React.FC<ValidationPitchViewProps> = ({
  plates,
  breakpoints,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points: ComparisonPoint[] = useMemo(() => {
    const list: ComparisonPoint[] = [];
    for (const plate of plates) {
      for (const disk of plate.disks) {
        if (disk.reader1Mm === null || !disk.antibiotic) continue;
        const appMm = computeDiskZoiMm(
          disk,
          plate.scaleDiskNorm,
          plate.metadata.knownDiskDiameterMm
        );
        const appRes = interpretZoneDiameter(
          appMm,
          disk.antibiotic,
          plate.metadata.organism,
          plate.metadata.standard,
          breakpoints
        );
        const gtRes = interpretZoneDiameter(
          disk.reader1Mm,
          disk.antibiotic,
          plate.metadata.organism,
          plate.metadata.standard,
          breakpoints
        );
        list.push({
          plateId: plate.metadata.plateId,
          organism: plate.metadata.organism,
          antibiotic: disk.antibiotic,
          appMm,
          reader1Mm: disk.reader1Mm,
          reader2Mm: disk.reader2Mm,
          appCall: appRes.call,
          gtCall: gtRes.call,
          absError: Math.abs(appMm - disk.reader1Mm),
          signedError: appMm - disk.reader1Mm,
          interReaderDiff:
            disk.reader2Mm !== null ? Math.abs(disk.reader1Mm - disk.reader2Mm) : null,
        });
      }
    }
    return list;
  }, [plates, breakpoints]);

  const stats = useMemo(() => {
    const n = points.length;
    if (n === 0) {
      return {
        n: 0,
        mae: 0,
        within1mmPct: 0,
        within2mmPct: 0,
        sirAgreementPct: 0,
        humanInterReaderMae: 0,
        humanInterReaderCount: 0,
        ecoliPlates: 0,
        saureusPlates: 0,
      };
    }

    const mae = points.reduce((acc, p) => acc + p.absError, 0) / n;
    const within1 = points.filter((p) => p.absError <= 1.0).length;
    const within2 = points.filter((p) => p.absError <= 2.0).length;
    const sirMatches = points.filter((p) => p.appCall === p.gtCall).length;
    const interPairs = points.filter((p) => p.interReaderDiff !== null);
    const humanMae =
      interPairs.length > 0
        ? interPairs.reduce((acc, p) => acc + (p.interReaderDiff ?? 0), 0) / interPairs.length
        : 0;

    return {
      n,
      mae,
      within1mmPct: (within1 / n) * 100,
      within2mmPct: (within2 / n) * 100,
      sirAgreementPct: (sirMatches / n) * 100,
      humanInterReaderMae: humanMae,
      humanInterReaderCount: interPairs.length,
      ecoliPlates: plates.filter((p) => p.metadata.organism === "E. coli").length,
      saureusPlates: plates.filter((p) => p.metadata.organism === "S. aureus").length,
    };
  }, [points, plates]);

  // SVG chart dimensions
  const chartW = 460;
  const chartH = 340;
  const pad = 44;
  const minMm = 5;
  const maxMm = 36;
  const toX = (mm: number) => pad + ((mm - minMm) / (maxMm - minMm)) * (chartW - pad * 2);
  const toY = (mm: number) => chartH - pad - ((mm - minMm) / (maxMm - minMm)) * (chartH - pad * 2);

  return (
    <div className="space-y-6">
      {/* Pitch Header Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Clinical Validation & Inter-Reader Agreement
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Live agreement metrics comparing ZoneCheck optical measurements against blinded
              caliper readings across {plates.length} Kirby-Bauer plates ({stats.n} individual disk
              zones). Target MVP dataset: 30–50 plates split evenly between{" "}
              <em>E. coli</em> and <em>S. aureus</em>.
            </p>
          </div>
          <div className="text-right font-mono text-xs text-slate-600 tabular-nums">
            <div>
              Dataset progress: <strong className="text-slate-900">{plates.length} / 30</strong>{" "}
              min plates
            </div>
            <div className="mt-1">
              {stats.ecoliPlates} <em>E. coli</em> · {stats.saureusPlates} <em>S. aureus</em>
            </div>
          </div>
        </div>

        {/* Progress Bar toward 30-50 plate MVP */}
        <div className="mt-4">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-sky-600 transition-all duration-300"
              style={{ width: `${Math.min(100, (plates.length / 30) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">S/I/R Categorical Agreement</div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900">
              {stats.sirAgreementPct.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1">%</span>
          </div>
          <div className="mt-1 text-xs font-mono text-emerald-700">
            Exact match vs Reader 1 ({stats.n} zones)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Mean Absolute ZOI Error</div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900">
              {stats.mae.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1.5">mm</span>
          </div>
          <div className="mt-1 text-xs font-mono text-slate-600">
            Human Reader 1 vs 2: ±{stats.humanInterReaderMae.toFixed(2)} mm
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Within ±1.0 mm Tolerance</div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900">
              {stats.within1mmPct.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1">%</span>
          </div>
          <div className="mt-1 text-xs font-mono text-slate-600">
            Within ±2.0 mm: {stats.within2mmPct.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Active Breakpoint Standard</div>
          <div className="mt-1.5 text-lg font-semibold text-slate-900">
            {plates[0] ? STANDARD_LABELS[plates[0].metadata.standard].name : "CLSI M100"}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Consistent single-standard cohort
          </div>
        </div>
      </div>

      {/* Dual Charts: Scatter Agreement + Method Rigor Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Scatter Plot */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                App ZOI vs. Hand Caliper Ground Truth (mm)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Shaded band marks ±2.0 mm tolerance around identity line (y = x)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
              <span className="text-emerald-700">● S</span>
              <span className="text-amber-600">▲ I</span>
              <span className="text-rose-600">✖ R</span>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-[520px] h-auto">
              {/* Grid lines */}
              {[10, 15, 20, 25, 30, 35].map((tick) => (
                <g key={tick}>
                  <line
                    x1={toX(tick)}
                    y1={pad}
                    x2={toX(tick)}
                    y2={chartH - pad}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  <line
                    x1={pad}
                    y1={toY(tick)}
                    x2={chartW - pad}
                    y2={toY(tick)}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  <text
                    x={toX(tick)}
                    y={chartH - pad + 16}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {tick}
                  </text>
                  <text
                    x={pad - 8}
                    y={toY(tick) + 3}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              {/* ±2 mm tolerance polygon */}
              <polygon
                points={`${toX(minMm)},${toY(minMm + 2)} ${toX(maxMm - 2)},${toY(maxMm)} ${toX(
                  maxMm
                )},${toY(maxMm)} ${toX(maxMm)},${toY(maxMm - 2)} ${toX(minMm + 2)},${toY(
                  minMm
                )} ${toX(minMm)},${toY(minMm)}`}
                fill="rgba(2, 132, 199, 0.08)"
              />

              {/* Identity line y = x */}
              <line
                x1={toX(minMm)}
                y1={toY(minMm)}
                x2={toX(maxMm)}
                y2={toY(maxMm)}
                stroke="#0284C7"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />

              {/* Axes */}
              <line x1={pad} y1={chartH - pad} x2={chartW - pad} y2={chartH - pad} stroke="#94A3B8" />
              <line x1={pad} y1={pad} x2={pad} y2={chartH - pad} stroke="#94A3B8" />

              <text
                x={chartW / 2}
                y={chartH - 8}
                textAnchor="middle"
                fill="#475569"
                fontSize="11"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                Hand Caliper Reader 1 (mm)
              </text>
              <text
                x={14}
                y={chartH / 2}
                textAnchor="middle"
                fill="#475569"
                fontSize="11"
                fontFamily="Plus Jakarta Sans, sans-serif"
                transform={`rotate(-90 14 ${chartH / 2})`}
              >
                ZoneCheck App ZOI (mm)
              </text>

              {/* Data points */}
              {points.map((pt, i) => {
                const cx = toX(Math.min(maxMm, Math.max(minMm, pt.reader1Mm)));
                const cy = toY(Math.min(maxMm, Math.max(minMm, pt.appMm)));
                const color =
                  pt.appCall === "S"
                    ? "#059669"
                    : pt.appCall === "I"
                      ? "#D97706"
                      : pt.appCall === "R"
                        ? "#DC2626"
                        : "#0284C7";
                const isHovered = hoveredIdx === i;
                return (
                  <circle
                    key={`${pt.plateId}-${pt.antibiotic}-${i}`}
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6.5 : 4.5}
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
          </div>

          <div className="mt-2 min-h-[20px] text-xs font-mono text-slate-600 text-center tabular-nums">
            {hoveredIdx !== null && points[hoveredIdx] ? (
              <span>
                {points[hoveredIdx].plateId} · {points[hoveredIdx].organism} ·{" "}
                {points[hoveredIdx].antibiotic}: App {points[hoveredIdx].appMm.toFixed(1)} mm vs Lab{" "}
                {points[hoveredIdx].reader1Mm.toFixed(1)} mm (Δ{" "}
                {points[hoveredIdx].signedError >= 0 ? "+" : ""}
                {points[hoveredIdx].signedError.toFixed(1)} mm)
              </span>
            ) : (
              <span>Hover any point to inspect disk-level agreement</span>
            )}
          </div>
        </div>

        {/* Scientific Rigor & Pitch Brief Alignment */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Validation Protocol & Guardrails
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Designed directly around the laboratory requirements brief for clinical trust.
            </p>

            <dl className="mt-4 divide-y divide-slate-200 text-xs">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600">Method & Incubation</dt>
                <dd className="font-medium text-slate-900 text-right">
                  Kirby-Bauer MHA · 16–20 h @ 35 °C
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600">Target Organisms (MVP)</dt>
                <dd className="font-medium text-slate-900 text-right">
                  <em>E. coli</em> & <em>S. aureus</em>
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600">QC Reference Strains</dt>
                <dd className="font-mono text-slate-900 text-right">
                  ATCC 25922 / ATCC 25923
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600">Scale Calibration</dt>
                <dd className="font-medium text-slate-900 text-right">
                  6.0 mm paper disk reference
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600">Double-Read Benchmark</dt>
                <dd className="font-mono tabular-nums text-slate-900 text-right">
                  {stats.humanInterReaderCount} paired readings (±
                  {stats.humanInterReaderMae.toFixed(2)} mm)
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600">Human-in-the-Loop</dt>
                <dd className="font-medium text-slate-900 text-right">
                  Technician adjusts & confirms every call
                </dd>
              </div>
            </dl>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed">
            <strong className="text-slate-900">No Early-Read Claims:</strong> Standard 16–20 h
            incubation is strictly enforced in the MVP. Any messy or hazy plates remain in the
            validation cohort alongside clean QC plates so accuracy figures stay honest.
          </div>
        </div>
      </div>
    </div>
  );
};
