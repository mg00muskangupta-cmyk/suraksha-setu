import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).toString();

export async function extractPdfText(file) {
  if (!file || file.type !== "application/pdf") throw new Error("Choose a valid PDF file.");
  if (file.size > 15 * 1024 * 1024) throw new Error("PDF is larger than the 15 MB limit.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const text = await page.getTextContent();
    pages.push(text.items.map(item => item.str).join(" "));
  }
  const result = pages.join("\n\n").trim();
  if (!result) throw new Error("No selectable text was found. This may be a scanned PDF; OCR is not available yet.");
  return { text: result, pages: pdf.numPages };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("Choose a valid image file."));
    if (file.size > 10 * 1024 * 1024) return reject(new Error("Image is larger than the 10 MB limit."));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The image could not be opened.")); };
    image.src = url;
  });
}

function grayscaleSignature(image, size = 16) {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const values = [];
  for (let i = 0; i < data.length; i += 4) {
    values.push((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255);
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const centered = values.map(v => v - mean);
  const norm = Math.sqrt(centered.reduce((a, b) => a + b * b, 0)) || 1;
  return centered.map(v => v / norm);
}

export async function makeLogoReference(file) {
  const image = await loadImage(file);
  return grayscaleSignature(image);
}

function bestLogoMatch(image, reference) {
  if (!Array.isArray(reference) || reference.length !== 256) return null;
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const ratio = Math.min(size / image.width, size / image.height);
  const w = Math.max(1, Math.round(image.width * ratio));
  const h = Math.max(1, Math.round(image.height * ratio));
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
  let best = -1;
  const sizes = [24, 32, 40, 48, 64, 80, 96];
  for (const box of sizes) {
    const step = Math.max(4, Math.floor(box / 8));
    for (let y = 0; y <= size - box; y += step) {
      for (let x = 0; x <= size - box; x += step) {
        const patch = ctx.getImageData(x, y, box, box);
        const vals = [];
        for (let gy = 0; gy < 16; gy += 1) {
          for (let gx = 0; gx < 16; gx += 1) {
            const px = Math.min(box - 1, Math.floor((gx + 0.5) * box / 16));
            const py = Math.min(box - 1, Math.floor((gy + 0.5) * box / 16));
            const i = (py * box + px) * 4;
            vals.push((0.299 * patch.data[i] + 0.587 * patch.data[i + 1] + 0.114 * patch.data[i + 2]) / 255);
          }
        }
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const centered = vals.map(v => v - mean);
        const norm = Math.sqrt(centered.reduce((a, b) => a + b * b, 0)) || 1;
        const signature = centered.map(v => v / norm);
        const score = signature.reduce((sum, v, i) => sum + v * reference[i], 0);
        if (score > best) best = score;
      }
    }
  }
  return Math.max(0, Math.min(100, Math.round(best * 100)));
}

function dominantColors(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 96; canvas.height = 96;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, 96, 96);
  const data = ctx.getImageData(0, 0, 96, 96).data;
  const counts = new Map();
  for (let i = 0; i < data.length; i += 16) {
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const key = [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
    const hex = "#" + key.map(v => v.toString(16).padStart(2, "0")).join("");
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color]) => color);
}

function hexToRgb(hex) {
  const clean = String(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16));
}
function colorDistance(a, b) {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return 999;
  return Math.sqrt(x.reduce((sum, v, i) => sum + (v - y[i]) ** 2, 0));
}

export async function analyzeVisualCreative(file, brand) {
  const image = await loadImage(file);
  const colors = dominantColors(image);
  const approved = (brand.visual?.colors || []).filter(c => hexToRgb(c));
  const palette = approved.length
    ? colors.map(color => ({ color, nearest: approved.reduce((best, candidate) => colorDistance(color, candidate) < colorDistance(color, best) ? candidate : best, approved[0]), distance: Math.min(...approved.map(candidate => colorDistance(color, candidate))) }))
    : [];
  const outOfPalette = palette.filter(x => x.distance > 95);
  const logoScore = brand.visual?.logoSignature ? bestLogoMatch(image, brand.visual.logoSignature) : null;
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    colors,
    approvedColors: approved,
    palette,
    logoScore,
    findings: [
      ...(approved.length ? (outOfPalette.length ? [{ severity: "Medium", title: "Possible colour mismatch", detail: outOfPalette.length + " of the dominant sampled colours are far from the approved palette." }] : [{ severity: "Low", title: "Palette broadly aligned", detail: "The dominant sampled colours are reasonably close to the configured brand palette." }]) : [{ severity: "Info", title: "Brand palette not configured", detail: "Add approved HEX colours in Brand knowledge to enable palette comparison." }]),
      ...(logoScore === null ? [{ severity: "Info", title: "Logo reference not configured", detail: "Upload a clean logo reference in Brand knowledge to enable an approximate visual match check." }] : [{ severity: logoScore >= 78 ? "Low" : "Medium", title: logoScore >= 78 ? "Possible logo match" : "Logo match not confirmed", detail: "Approximate visual similarity score: " + logoScore + "%. This is a heuristic, not a definitive logo-recognition result." }])
    ],
    disclaimer: "Automated visual checks are approximate. They do not verify legal logo ownership, exact placement, or every design guideline; a human reviewer must confirm the creative."
  };
}
