# ZoneCheck — Kirby-Bauer AMR Plate Reader

ZoneCheck is a mobile-friendly, human-in-the-loop web application for measuring antimicrobial susceptibility Zones of Inhibition (ZOI) from photographs of Kirby-Bauer Mueller-Hinton agar plates and interpreting **Susceptible (S) / Intermediate (I) / Resistant (R)** calls against **CLSI M100** and **EUCAST** breakpoints.

> **Research & Prototype Disclaimer:** ZoneCheck is an early-stage clinical decision-support prototype intended for laboratory validation and evaluation. All automated detections and zone measurements must be verified and confirmed by a qualified laboratory technician prior to clinical use.

---

## Key Features

- **Vision AI Disk & Zone Detection (`/api/analyze-plate`):** Detects circular antibiotic disks, reads printed drug codes (including rotated/upside-down labels), estimates clear inhibition zone boundaries, and reports image quality checks (tilt, glare, overlapping zones).
- **6.0 mm Self-Calibrating Optical Scale:** Calibrates pixels-per-millimeter across the plate using the median detected diameter of standardized `6.0 mm` paper disks, locking zone rings concentrically and clamping measurements to `0.5 mm` clinical increments.
- **Interactive SVG Caliper Canvas:** Drag ring centers or resize handles directly on mobile or desktop, zoom (`1x–2.5x`), toggle overlays, and switch optical inspection filters (**Normal**, **Contrast**, **Invert**).
- **Safe Breakpoint Interpretation:** Ships with editable **CLSI M100 Ed. 35 (2025)** and **EUCAST v15.0 (2025)** breakpoint tables for *Escherichia coli* and *Staphylococcus aureus*. Unrecognized disk codes remain explicitly **Unmapped / Unknown Disk** (`-`) rather than defaulting to another drug.
- **Validation Analytics & CSV Export:** Tracks App-vs.-Hand-Caliper Mean Absolute Error (MAE), `±1.0 mm` / `±2.0 mm` agreement rates, S/I/R concordance, and exports a 17-column clinical recording sheet as CSV.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite 8, Lucide Icons
- **Backend:** Node.js (`>=22.18.0`), Express (`server.ts`)
- **Vision AI:** `@google/genai` SDK (`gemini-4-hydrogen` with retry/fallback to `gemini-3.1-flash-lite`)
- **Deployment:** Configured for Railway via `railway.json`

---

## Project Structure

```text
├── server.ts                        # Express server, Vite dev middleware, & /api/analyze-plate
├── railway.json                     # Railway build, start, and /api/health configuration
├── package.json
├── .env.example
└── src/
    ├── App.tsx                      # Main workflow, plate upload, & state management
    ├── types/amr.ts                 # Domain models (disks, breakpoints, plate metadata)
    ├── data/
    │   ├── breakpoints.ts           # CLSI M100 (2025) & EUCAST v15.0 (2025) rules
    │   └── samplePlates.ts          # Sample & pilot cohort plate data
    ├── utils/
    │   └── calibration.ts           # mm scale math, image resizing, & 17-col CSV export
    └── components/
        ├── PlateCaliperCanvas.tsx   # Interactive SVG caliper & optical filters
        ├── DiskInspectorPanel.tsx   # Single-disk inspector, 0.5 mm steppers, R/I/S bar
        ├── ValidationPitchView.tsx  # Scatter plot & inter-reader agreement KPIs
        ├── BreakpointManagerView.tsx# Live CLSI/EUCAST breakpoint editor
        └── RecordingSheetView.tsx   # Tabular cohort view & CSV download
