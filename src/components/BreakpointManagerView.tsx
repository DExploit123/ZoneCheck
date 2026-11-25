import React, { useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { BreakpointRule, BreakpointStandardId, OrganismId } from "../types/amr";
import { STANDARD_LABELS } from "../data/breakpoints";

interface BreakpointManagerViewProps {
  breakpoints: BreakpointRule[];
  activeStandard: BreakpointStandardId;
  onChangeStandard: (std: BreakpointStandardId) => void;
  onUpdateRule: (id: string, patch: Partial<BreakpointRule>) => void;
  onAddRule: (rule: BreakpointRule) => void;
  onResetDefaults: () => void;
}

export const BreakpointManagerView: React.FC<BreakpointManagerViewProps> = ({
  breakpoints,
  activeStandard,
  onChangeStandard,
  onUpdateRule,
  onAddRule,
  onResetDefaults,
}) => {
  const [organismFilter, setOrganismFilter] = useState<OrganismId>("E. coli");
  const [newAntibiotic, setNewAntibiotic] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newContent, setNewContent] = useState("10 µg");
  const [newRMax, setNewRMax] = useState("13");
  const [newSMin, setNewSMin] = useState("17");

  const filtered = breakpoints.filter(
    (b) => b.standard === activeStandard && b.organism === organismFilter
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAntibiotic.trim()) return;
    onAddRule({
      id: `custom-${Date.now()}`,
      standard: activeStandard,
      organism: organismFilter,
      antibiotic: newAntibiotic.trim(),
      shortCode: (newCode.trim() || newAntibiotic.slice(0, 3)).toUpperCase(),
      diskContentUg: newContent.trim() || "10 µg",
      resistantMaxMm: Number(newRMax) || 13,
      susceptibleMinMm: Number(newSMin) || 17,
      notes: "Added by reviewing microbiologist",
    });
    setNewAntibiotic("");
    setNewCode("");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Breakpoint Table & Standard Governance
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Breakpoints are never hidden in black-box code. Select a single standard for your
              study—never mix CLSI and EUCAST in the same dataset—and adjust any threshold below to
              match the lab&apos;s current edition.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Reference Defaults</span>
          </button>
        </div>

        {/* Standard & Organism Controls */}
        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Active Standard:</span>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
              {(["CLSI_2025", "EUCAST_2025"] as BreakpointStandardId[]).map((std) => (
                <button
                  key={std}
                  type="button"
                  onClick={() => onChangeStandard(std)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    activeStandard === std
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {STANDARD_LABELS[std].edition}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Organism Panel:</span>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
              {(["E. coli", "S. aureus"] as OrganismId[]).map((org) => (
                <button
                  key={org}
                  type="button"
                  onClick={() => setOrganismFilter(org)}
                  className={`px-3 py-1.5 text-xs font-medium rounded italic transition-colors whitespace-nowrap ${
                    organismFilter === org
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {org}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editable Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                <th className="py-3 px-4">Antibiotic Agent</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Disk Content</th>
                <th className="py-3 px-4">Resistant (R ≤ mm)</th>
                <th className="py-3 px-4">Intermediate (I range)</th>
                <th className="py-3 px-4">Susceptible (S ≥ mm)</th>
                <th className="py-3 px-4">Microbiologist Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((rule) => {
                const hasIntermediate = rule.susceptibleMinMm - rule.resistantMaxMm > 1;
                const iRange = hasIntermediate
                  ? `${rule.resistantMaxMm + 1} – ${rule.susceptibleMinMm - 1} mm`
                  : "None";

                return (
                  <tr key={rule.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{rule.antibiotic}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">{rule.shortCode}</td>
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={rule.diskContentUg}
                        onChange={(e) => onUpdateRule(rule.id, { diskContentUg: e.target.value })}
                        aria-label={`Disk content for ${rule.antibiotic}`}
                        className="w-28 px-2 py-1 font-mono text-xs border border-slate-300 rounded bg-white text-slate-900"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        value={rule.resistantMaxMm}
                        onChange={(e) =>
                          onUpdateRule(rule.id, {
                            resistantMaxMm: Number(e.target.value) || 6,
                          })
                        }
                        aria-label={`Resistant max mm for ${rule.antibiotic}`}
                        className="w-20 px-2 py-1 font-mono tabular-nums text-xs border border-slate-300 rounded bg-white text-rose-700 font-semibold"
                      />
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-amber-700">
                      {iRange}
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        value={rule.susceptibleMinMm}
                        onChange={(e) =>
                          onUpdateRule(rule.id, {
                            susceptibleMinMm: Number(e.target.value) || 6,
                          })
                        }
                        aria-label={`Susceptible min mm for ${rule.antibiotic}`}
                        className="w-20 px-2 py-1 font-mono tabular-nums text-xs border border-slate-300 rounded bg-white text-emerald-700 font-semibold"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{rule.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Custom Drug Row */}
        <form
          onSubmit={handleAdd}
          className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-end gap-3 text-xs"
        >
          <div>
            <label className="block text-slate-600 mb-1">Add Antibiotic ({organismFilter})</label>
            <input
              type="text"
              placeholder="e.g. Cefotaxime"
              value={newAntibiotic}
              onChange={(e) => setNewAntibiotic(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900 w-44"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Code</label>
            <input
              type="text"
              placeholder="CTX"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="px-2.5 py-1.5 font-mono border border-slate-300 rounded bg-white text-slate-900 w-20"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Content</label>
            <input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="px-2.5 py-1.5 font-mono border border-slate-300 rounded bg-white text-slate-900 w-24"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">R ≤ mm</label>
            <input
              type="number"
              value={newRMax}
              onChange={(e) => setNewRMax(e.target.value)}
              className="px-2.5 py-1.5 font-mono border border-slate-300 rounded bg-white text-slate-900 w-20"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">S ≥ mm</label>
            <input
              type="number"
              value={newSMin}
              onChange={(e) => setNewSMin(e.target.value)}
              className="px-2.5 py-1.5 font-mono border border-slate-300 rounded bg-white text-slate-900 w-20"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rule</span>
          </button>
        </form>
      </div>
    </div>
  );
};
