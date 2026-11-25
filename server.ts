import "dotenv/config";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.NODE_ENV === "production" ? Number(process.env.PORT || 3000) : 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable Vision AI plate analysis."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "18mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/analyze-plate", async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = "image/jpeg",
        organism = "Escherichia coli",
        plateDiameterMm = 90,
        knownDiskDiameterMm = 6.0,
      } = req.body ?? {};

      if (typeof imageBase64 !== "string" || imageBase64.trim().length === 0) {
        return res.status(400).json({
          error: "Missing plate image payload (imageBase64).",
        });
      }

      const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      const normalizedMime = allowedMimes.includes(mimeType) ? mimeType : "image/jpeg";

      const ai = getGeminiClient();

      const systemInstruction = [
        `You are a clinical microbiology optical metrology assistant analyzing top-down photographs of Kirby-Bauer disk diffusion Mueller-Hinton agar plates.`,
        `Return precise 2D bounding boxes in [y_min, x_min, y_max, x_max] format normalized to 0-1000.`,
        `Be resilient to rotated or upside-down text printed on antibiotic disks (for example reading MAR 5, FFC 30, ENR 5, CN 10, SXT 25 accurately even when rotated 180 degrees).`,
        `Ignore handwritten marker ink on the Petri dish lid/underside when sizing paper disks.`,
      ].join("\n");

      const prompt = [
        `Analyze this Kirby-Bauer disk diffusion plate photograph.`,
        `Organism context: ${organism}. Nominal Petri dish diameter: ${plateDiameterMm} mm. Known antibiotic paper disk diameter: ${knownDiskDiameterMm} mm.`,
        ``,
        `Locate the circular Petri dish rim and EVERY white circular antibiotic paper disk on the agar.`,
        `For each disk, return two separate 2D bounding boxes as [y_min, x_min, y_max, x_max] normalized 0 to 1000 (top-left is 0,0; bottom-right is 1000,1000):`,
        `1. disk_box_2d: Tight bounding box strictly around the 6.0 mm white paper disk itself, ignoring any nearby marker ink or shadows.`,
        `2. zone_box_2d: Concentric outer boundary of the clear inhibition zone centered on that paper disk.`,
        `   - Outer lawn margin rule (hazy / inner glare rings): zone_box_2d MUST trace the full outer boundary where dense, confluent, opaque bacterial lawn begins. Do NOT stop early at faint inner haze, semi-translucent halos, or inner glare circles inside the clearing—only stop at the outer transition back into solid bacterial growth.`,
        `   - Overlapping/merged zones rule: When an inhibition zone merges with an adjacent clearing on one side ("Merged clearing"), DO NOT collapse zone_box_2d to disk_box_2d (6.0 mm) and DO NOT stop 2–3 mm short inside the clear agar. Extend the unobstructed radial edge all the way outward until it meets the solid bacterial lawn boundary, and reflect that full radius symmetrically around disk_box_2d.`,
        `   - Rim/glare rule: If a clear zone touches the Petri dish rim or glare edge, keep zone_box_2d concentric around disk_box_2d and estimate the true circular clearing diameter without expanding past the agar boundary.`,
        `   - True resistance rule: ONLY set zone_box_2d equal to disk_box_2d when dense bacterial growth visibly touches the white paper disk edge all the way around (360 degrees).`,
        `3. diskCode: Exact code printed on the paper disk (e.g. "MAR 5", "FFC 30", "ENR 5", "AMC 30", "SXT 25", "CN 10", "CIP 5"), reading rotated or 180-degree upside-down labels accurately. Use empty string if blank/unreadable.`,
        `4. orientation_note: Label orientation on the disk (e.g. "Upright", "Rotated 180°", "Rotated 90° CW", or "Blank / Unreadable").`,
        `5. edgeNote: Margin morphology (e.g. "Sharp margin", "Merged clearing (estimated from unobstructed edge)", "Growth to disk edge", "Slight haze near edge", "Inner colonies inside zone").`,
      ].join("\n");

      const boxSchema = {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: "Bounding box [y_min, x_min, y_max, x_max] normalized 0 to 1000",
      };

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          plateCircle: {
            type: Type.OBJECT,
            properties: {
              centerXNorm: { type: Type.NUMBER, description: "Plate center X (0-1000)" },
              centerYNorm: { type: Type.NUMBER, description: "Plate center Y (0-1000)" },
              radiusNorm: { type: Type.NUMBER, description: "Plate inner agar radius (0-500)" },
            },
            required: ["centerXNorm", "centerYNorm", "radiusNorm"],
          },
          disks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                diskCode: {
                  type: Type.STRING,
                  description: "Raw OCR code printed on disk (even if rotated/upside-down) or empty string",
                },
                orientation_note: {
                  type: Type.STRING,
                  description: "Disk label orientation note, e.g. Upright, Rotated 180°, Blank",
                },
                disk_box_2d: {
                  ...boxSchema,
                  description: "Tight [y_min, x_min, y_max, x_max] box around the 6mm paper disk",
                },
                zone_box_2d: {
                  ...boxSchema,
                  description: "Concentric [y_min, x_min, y_max, x_max] box around the clear inhibition zone; equal to disk_box_2d only if growth touches disk edge all around",
                },
                edgeNote: { type: Type.STRING, description: "Zone margin morphology note" },
                confidence: { type: Type.NUMBER, description: "Detection confidence 0.0 to 1.0" },
              },
              required: [
                "diskCode",
                "orientation_note",
                "disk_box_2d",
                "zone_box_2d",
                "edgeNote",
                "confidence",
              ],
            },
          },
          imageQuality: {
            type: Type.OBJECT,
            properties: {
              overheadAlignmentOk: { type: Type.BOOLEAN },
              glareDetected: { type: Type.BOOLEAN },
              overlappingZonesDetected: { type: Type.BOOLEAN },
              lawnUniformityNote: { type: Type.STRING },
            },
            required: [
              "overheadAlignmentOk",
              "glareDetected",
              "overlappingZonesDetected",
              "lawnUniformityNote",
            ],
          },
        },
        required: ["plateCircle", "disks", "imageQuality"],
      };

      const attemptModels = [
        { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW },
        { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW },
        { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL },
        { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL },
      ];

      let lastErr: unknown = null;
      let responseText: string | null = null;
      let modelUsed = "gemini-4-hydrogen";

      for (let i = 0; i < attemptModels.length; i++) {
        const candidate = attemptModels[i];
        try {
          if (i > 0) {
            const delayMs = 700 * i;
            await new Promise((r) => setTimeout(r, delayMs));
          }

          const response = await ai.models.generateContent({
            model: candidate.model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: normalizedMime,
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
              responseMimeType: "application/json",
              responseSchema,
            },
          });

          responseText = (response.text ?? "{}").trim();
          modelUsed = candidate.model;
          break;
        } catch (err: unknown) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          const isTransient =
            msg.includes("503") ||
            msg.includes("UNAVAILABLE") ||
            msg.includes("429") ||
            msg.includes("RESOURCE_EXHAUSTED");
          if (!isTransient) {
            throw err;
          }
          console.warn(
            `Transient Vision API error on ${candidate.model} (attempt ${i + 1}): ${msg}`
          );
        }
      }

      if (responseText === null) {
        throw lastErr ?? new Error("Vision service temporarily unavailable.");
      }

      const parsed = JSON.parse(responseText) as {
        plateCircle?: { centerXNorm?: number; centerYNorm?: number; radiusNorm?: number };
        disks?: Array<{
          diskCode?: string;
          orientation_note?: string;
          disk_box_2d?: number[];
          zone_box_2d?: number[];
          edgeNote?: string;
          confidence?: number;
        }>;
        imageQuality?: {
          overheadAlignmentOk?: boolean;
          glareDetected?: boolean;
          overlappingZonesDetected?: boolean;
          lawnUniformityNote?: string;
        };
      };

      const plateCircle = {
        centerXNorm: Number(parsed.plateCircle?.centerXNorm) || 500,
        centerYNorm: Number(parsed.plateCircle?.centerYNorm) || 500,
        radiusNorm: Math.max(150, Math.min(500, Number(parsed.plateCircle?.radiusNorm) || 450)),
      };

      const rawDisks = Array.isArray(parsed.disks) ? parsed.disks : [];

      const parseBox = (box: unknown) => {
        if (!Array.isArray(box) || box.length < 4) return null;
        const [yMin, xMin, yMax, xMax] = box.map((n) => Number(n));
        if ([yMin, xMin, yMax, xMax].some((v) => !Number.isFinite(v))) return null;
        const w = Math.max(10, xMax - xMin);
        const h = Math.max(10, yMax - yMin);
        return {
          yMin,
          xMin,
          yMax,
          xMax,
          cx: (xMin + xMax) / 2,
          cy: (yMin + yMax) / 2,
          diameter: (w + h) / 2,
        };
      };

      // Step 1: Extract disk boxes and compute median 6.0 mm disk width across ALL detected disks
      const extracted = rawDisks
        .map((d) => {
          const diskBox = parseBox(d.disk_box_2d);
          if (!diskBox) return null;
          const zoneBox = parseBox(d.zone_box_2d) ?? diskBox;
          return { raw: d, diskBox, zoneBox };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const validDiskWidths = extracted
        .map((x) => x.diskBox.diameter)
        .filter((v) => v >= 15 && v <= 180)
        .sort((a, b) => a - b);

      const medianDiskPx =
        validDiskWidths.length > 0
          ? validDiskWidths[Math.floor(validDiskWidths.length / 2)]
          : 60;

      const pixelsPerMm = medianDiskPx / Number(knownDiskDiameterMm || 6.0);
      const maxAutoZoneNorm = Math.min(
        40.0 * pixelsPerMm, // Clamp auto-detected zone diameter to <= 40 mm
        plateCircle.radiusNorm * 2 // Never exceed Petri dish inner agar diameter
      );

      // Step 2: Keep zone center strictly concentric with disk_box_2d and compute median unobstructed radius
      const normalizedDisks = extracted.map(({ raw, diskBox, zoneBox }) => {
        const diskCx = diskBox.cx;
        const diskCy = diskBox.cy;

        // Distances from (disk_cx, disk_cy) to each of the 4 zone_box_2d edges
        const edgeCandidates = [
          { dist: Math.max(0, diskCx - zoneBox.xMin), clipped: zoneBox.xMin <= 2 },
          { dist: Math.max(0, zoneBox.xMax - diskCx), clipped: zoneBox.xMax >= 998 },
          { dist: Math.max(0, diskCy - zoneBox.yMin), clipped: zoneBox.yMin <= 2 },
          { dist: Math.max(0, zoneBox.yMax - diskCy), clipped: zoneBox.yMax >= 998 },
        ];

        const unobstructed = edgeCandidates
          .filter((e) => !e.clipped)
          .map((e) => e.dist)
          .sort((a, b) => a - b);

        const radii = (
          unobstructed.length >= 2
            ? unobstructed
            : edgeCandidates.map((e) => e.dist).sort((a, b) => a - b)
        );

        const medianRadius =
          radii.length % 2 === 1
            ? radii[Math.floor(radii.length / 2)]
            : (radii[radii.length / 2 - 1] + radii[radii.length / 2]) / 2;

        // Only snap to 6.0 mm when all unobstructed edges sit right on the paper disk perimeter
        const maxUnobstructed = radii[radii.length - 1] ?? 0;
        const concentricZoneDia =
          medianRadius <= diskBox.diameter * 0.56 && maxUnobstructed <= diskBox.diameter * 0.65
            ? medianDiskPx
            : medianRadius * 2;

        // Clamp oversized zones touching plate boundary or exceeding 40.0 mm
        const distFromPlateCenter = Math.hypot(
          diskCx - plateCircle.centerXNorm,
          diskCy - plateCircle.centerYNorm
        );
        const maxRadiusInsidePlate = Math.max(
          medianDiskPx * 0.6,
          plateCircle.radiusNorm - distFromPlateCenter + medianDiskPx * 0.35
        );
        const clampedZoiNorm = Math.max(
          medianDiskPx,
          Math.min(
            maxAutoZoneNorm,
            concentricZoneDia,
            Math.max(maxRadiusInsidePlate * 2, 32 * pixelsPerMm)
          )
        );

        return {
          diskCode: String(raw.diskCode ?? "").trim(),
          printedCode: String(raw.diskCode ?? "").trim(),
          orientation_note: String(raw.orientation_note ?? "").trim(),
          centerXNorm: Math.round(diskCx),
          centerYNorm: Math.round(diskCy),
          zone_cx: Math.round(diskCx),
          zone_cy: Math.round(diskCy),
          diskDiameterNorm: Math.round(medianDiskPx),
          zoiDiameterNorm: Math.round(clampedZoiNorm),
          disk_box_2d: raw.disk_box_2d,
          zone_box_2d: raw.zone_box_2d,
          edgeNote: String(raw.edgeNote ?? "Detected by Vision AI"),
          confidence: Number(raw.confidence ?? 0.9),
        };
      });

      return res.json({
        plateCircle,
        disks: normalizedDisks,
        medianDiskNorm: Number(medianDiskPx.toFixed(2)),
        pixelsPerMm: Number(pixelsPerMm.toFixed(3)),
        imageQuality: parsed.imageQuality ?? {
          overheadAlignmentOk: true,
          glareDetected: false,
          overlappingZonesDetected: false,
          lawnUniformityNote: "Vision AI quality check complete.",
        },
        modelUsed,
      });
    } catch (err: unknown) {
      let message =
        err instanceof Error ? err.message : "Failed to analyze Kirby-Bauer plate image.";

      // Extract clean message if SDK returned JSON-encoded error string
      if (message.trim().startsWith("{")) {
        try {
          const parsedErr = JSON.parse(message);
          if (parsedErr?.error?.message) {
            message = String(parsedErr.error.message);
          }
        } catch {
          // Keep original string if not valid JSON
        }
      }

      const status =
        message.includes("API_KEY_INVALID") || message.includes("PERMISSION_DENIED")
          ? 403
          : message.includes("RESOURCE_EXHAUSTED") || message.includes("429")
            ? 429
            : message.includes("UNAVAILABLE") || message.includes("503") || message.includes("high demand")
              ? 503
              : 500;
      console.error("Plate analysis error:", err);
      return res.status(status).json({ error: message });
    }
  });

  const httpServer = http.createServer(app);
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*all", (_req, res) => {
      const indexPath = path.join(distDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build first.");
      }
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`ZoneCheck AMR server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
