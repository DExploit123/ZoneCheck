import React, { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { BreakpointRule, OrganismId, SavedPlateRecord } from "../types/amr";
import { interpretZoneDiameter, STANDARD_LABELS } from "../data/breakpoints";
import { computeDiskZoiMm, exportRecordingSheetCsv } from "../utils/calibration";

interface RecordingSheetViewProps {
  plates: SavedPlateRecord[];
  breakpoints: BreakpointRule[];
  onLoadPlateToReader: (plateId: string) => void;
}

export const RecordingSheetView: React.FC<RecordingSheetViewProps> = ({
  plates,
  breakpoints,
  onLoadPlateToReader,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [organismFilter, setOrganismFilter] = useState<"ALL" | OrganismId>("ALL");

  const rows = useMemo(() => {
    const out: Array<{
      plateId: string;
      plateRecordId: string;
      timestamps: string;
      organism: OrganismId;
      strainType: string;
      agarDetails: string;
      antibiotic: string;
      diskContent: string;
      diskLotExpiry: string;
      incubation: string;
      appZoi: number;
      reader1: number | null;
      reader2: number | null;
      call: string;
      confirmed: boolean;
      standardEdition: string;
      photoFile: string;
      notes: string;
    }> = [];

    for (const plate of plates) {
      if (organismFilter !== "ALL" && plate.metadata.organism !== organismFilter) continue;
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
        const row = {
          plateId: plate.metadata.plateId,
          plateRecordId: plate.id,
          timestamps: `${plate.metadata.inoculationTime} / ${plate.metadata.readingTime}`,
          organism: plate.metadata.organism,
          strainType: plate.metadata.strainType,
          agarDetails: plate.metadata.agarDetails,
          antibiotic: disk.antibiotic || "Unassigned",
          diskContent: disk.diskContentUg,
          diskLotExpiry: `${disk.diskLot} · ${disk.diskExpiry}`,
          incubation: plate.metadata.incubationDetails,
          appZoi,
          reader1: disk.reader1Mm,
          reader2: disk.reader2Mm,
          call,
          confirmed: disk.confirmed,
          standardEdition: STANDARD_LABELS[plate.metadata.standard].name,
          photoFile: plate.metadata.photoFileName,
          notes: disk.edgeNote,
        };

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            row.plateId.toLowerCase().includes(q) ||
            row.antibiotic.toLowerCase().includes(q) ||
            row.strainType.toLowerCase().includes(q) ||
            row.notes.toLowerCase().includes(q);
          if (!match) continue;
        }
        out.push(row);
      }
    }
    return out;
  }, [plates, breakpoints, organismFilter, searchQuery]);

  const handleDownloadCsv = () => {
    const csv = exportRecordingSheetCsv(plates, breakpoints);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zonecheck_amr_recording_sheet_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Data Recording Sheet (One Row per Disk)
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Structured export matching Section 9 of the Laboratory Requirements Brief ({rows.length}{" "}
              disk rows across {plates.length} plates). No patient-identifying details stored.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter plate ID, antibiotic, notes..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
            {(["ALL", "E. coli", "S. aureus"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setOrganismFilter(opt)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  organismFilter === opt
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt === "ALL" ? "All Organisms" : opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                <th className="py-2.5 px-3 whitespace-nowrap">Plate ID</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Organism & Strain</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Antibiotic</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Disk Content</th>
                <th className="py-2.5 px-3 whitespace-nowrap">App ZOI</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Reader 1</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Reader 2</th>
                <th className="py-2.5 px-3 whitespace-nowrap">S/I/R</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Standard</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Agar & Incubation</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Photo File</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row, idx) => (
                <tr key={`${row.plateRecordId}-${idx}`} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onLoadPlateToReader(row.plateRecordId)}
                      className="text-sky-700 hover:underline"
                    >
                      {row.plateId}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="italic font-medium text-slate-900">{row.organism}</div>
                    <div className="text-[11px] text-slate-500">{row.strainType}</div>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                    {row.antibiotic}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {row.diskContent}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {row.appZoi.toFixed(1)} mm
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {row.reader1 !== null ? `${row.reader1.toFixed(1)} mm` : "—"}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {row.reader2 !== null ? `${row.reader2.toFixed(1)} mm` : "—"}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                    <span
                      className={
                        row.call === "S"
                          ? "text-emerald-700"
                          : row.call === "I"
                            ? "text-amber-700"
                            : row.call === "R"
                              ? "text-rose-700"
                              : "text-slate-400"
                      }
                    >
                      {row.call === "UNASSIGNED" ? "—" : row.call}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                    {row.standardEdition}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 min-w-[200px]">
                    <div className="truncate max-w-[220px]">{row.agarDetails}</div>
                    <div className="text-[11px] text-slate-500">{row.incubation}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {row.photoFile}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 min-w-[160px]">
                    {row.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
