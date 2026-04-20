import express from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = parseInt(process.env.REMOTION_PORT || "3100", 10);

// Serve per-render assets (Reddit hook clips, etc.) so OffthreadVideo in
// HookText can fetch them over HTTP. Clients POST files to /assets and use
// the returned URL as a prop.
const ASSETS_DIR = path.join(os.tmpdir(), "nesso-remotion-assets");
fs.mkdirSync(ASSETS_DIR, { recursive: true });
app.use("/assets", express.static(ASSETS_DIR));

// Upload endpoint — accepts raw video bytes and returns a URL
app.put("/assets/:name", (req, res) => {
  const { name } = req.params;
  // Sanitize filename — alphanumeric, dash, underscore, dot only
  const safe = name.replace(/[^A-Za-z0-9._-]/g, "_");
  const out = path.join(ASSETS_DIR, safe);
  const writeStream = fs.createWriteStream(out);
  req.pipe(writeStream);
  writeStream.on("finish", () => {
    const size = fs.statSync(out).size;
    console.log(`[remotion] asset uploaded: ${safe} (${size} bytes)`);
    res.json({ url: `http://localhost:${PORT}/assets/${safe}`, size });
  });
  writeStream.on("error", (err) => {
    console.error(`[remotion] asset upload error: ${err}`);
    res.status(500).json({ error: String(err) });
  });
});

// Cleanup endpoint — remove an asset after render
app.delete("/assets/:name", (req, res) => {
  const { name } = req.params;
  const safe = name.replace(/[^A-Za-z0-9._-]/g, "_");
  const p = path.join(ASSETS_DIR, safe);
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

let bundleLocation: string | null = null;
let bundlePromise: Promise<string> | null = null;

async function ensureBundle(): Promise<string> {
  if (bundleLocation) return bundleLocation;
  if (bundlePromise) return bundlePromise;

  bundlePromise = (async () => {
    console.log("[remotion] Bundling project...");
    const t0 = Date.now();
    const loc = await bundle({
      entryPoint: path.resolve(__dirname, "./index.ts"),
      webpackOverride: (config) => config,
    });
    console.log(`[remotion] Bundle ready in ${Date.now() - t0}ms: ${loc}`);
    bundleLocation = loc;
    return loc;
  })();

  return bundlePromise;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", bundled: !!bundleLocation });
});

// Generic render endpoint — compositionId is passed in the URL
app.post("/render/:compositionId", async (req, res) => {
  const startTime = Date.now();
  const { compositionId } = req.params;
  const { props = {}, durationSeconds, fps = 30 } = req.body;

  try {
    const bundleLoc = await ensureBundle();

    const composition = await selectComposition({
      serveUrl: bundleLoc,
      id: compositionId,
      inputProps: props,
    });

    if (typeof durationSeconds === "number") {
      composition.durationInFrames = Math.max(
        1,
        Math.round(durationSeconds * fps),
      );
    }
    composition.fps = fps;

    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `nesso-${compositionId}-`),
    );
    const outputPath = path.join(tmpDir, `${compositionId}.mp4`);

    await renderMedia({
      composition,
      serveUrl: bundleLoc,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: props,
      concurrency: 1, // Railway has 512MB memory limit
    });

    const elapsed = Date.now() - startTime;
    console.log(
      `[remotion] ${compositionId} rendered in ${elapsed}ms (${composition.durationInFrames}f @ ${fps}fps)`,
    );

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("X-Render-Time-Ms", String(elapsed));
    res.setHeader("X-Composition-Id", compositionId);

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);

    stream.on("end", () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    stream.on("error", (err) => {
      console.error("[remotion] stream error:", err);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  } catch (err: any) {
    console.error(`[remotion] render failed for ${compositionId}:`, err);
    res.status(500).json({
      error: err.message || "Render failed",
      composition: compositionId,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

// Legacy endpoint for backward compat (NessoReveal)
app.post("/render", async (req, res) => {
  req.params = { compositionId: "NessoReveal" } as any;
  req.body = {
    props: req.body,
    durationSeconds: req.body.durationSeconds || 5.0,
    fps: req.body.fps || 30,
  };
  const handler = app._router.stack.find(
    (l: any) => l.route?.path === "/render/:compositionId",
  );
  if (handler) return handler.route.stack[0].handle(req, res);
  res.status(404).json({ error: "legacy route unavailable" });
});

app.listen(PORT, () => {
  console.log(`[remotion] server listening on port ${PORT}`);
  ensureBundle().catch((err) => {
    console.error("[remotion] pre-bundle failed:", err);
    process.exit(1);
  });
});
