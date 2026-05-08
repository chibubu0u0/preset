"use client";

import { useEffect, useMemo, useState } from "react";

type StyleItem = {
  name: string;
  count: number;
};

type RecipeResult = {
  ok: boolean;
  styleFamily: string;
  analysis?: {
    photo_assessment: string;
    lightroom_recipe: string;
    lightroom_basic_params: string;
    lightroom_color_params: string;
    tone_curve_notes: string;
    usage_notes: string;
    web_preview_params: Record<string, number | string | boolean>;
    confidence_score: number;
  };
  error?: string;
};

const maxEdge = Number(process.env.NEXT_PUBLIC_ANALYSIS_MAX_EDGE || 1600);
const jpegQuality = Number(process.env.NEXT_PUBLIC_ANALYSIS_JPEG_QUALITY || 0.76);
const defaultPreviewStrength = Number(process.env.NEXT_PUBLIC_PREVIEW_STRENGTH || 0.55);

type RenderOptions = {
  maxEdge: number;
  quality: number;
  strength: number;
  skinProtection?: boolean;
  addGrain?: boolean;
};

function normalizeName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/\s+/g, "-").slice(0, 60) || "photo";
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function getNumber(params: Record<string, any> | undefined, key: string, fallback = 0) {
  const value = Number(params?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function getHue01(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h /= 6;
  return h < 0 ? h + 1 : h;
}

function skinMask(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  const hue = getHue01(r, g, b) * 360;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const hueOk = hue < 55 || hue > 345;
  const channelOk = r > g * 0.92 && r > b * 1.05 && g > b * 0.82;
  const satOk = sat > 0.08 && sat < 0.58;
  const lumaOk = luma > 0.18 && luma < 0.92;
  return hueOk && channelOk && satOk && lumaOk ? 1 : 0;
}

function applyToneToImageData(imageData: ImageData, params: Record<string, any> | undefined, strength: number, options?: { skinProtection?: boolean; addGrain?: boolean }) {
  if (!params) return imageData;
  const data = imageData.data;
  const s = clamp(strength, 0.05, 1);

  const exposure = getNumber(params, "exposure") * s;
  const contrast = getNumber(params, "contrast") * s;
  const highlights = getNumber(params, "highlights") * s;
  const shadows = getNumber(params, "shadows") * s;
  const whites = getNumber(params, "whites") * s;
  const blacks = getNumber(params, "blacks") * s;
  const temperature = getNumber(params, "temperature") * s;
  const tint = getNumber(params, "tint") * s;
  const vibrance = getNumber(params, "vibrance") * s;
  const saturation = getNumber(params, "saturation") * s;
  const fade = getNumber(params, "fade") * s;
  const clarity = getNumber(params, "clarity") * s;
  const grain = Math.max(0, getNumber(params, "grain") * s);

  const exposureFactor = Math.pow(2, exposure);
  const contrastFactor = clamp(1 + contrast / 130, 0.62, 1.55);
  const tempShift = clamp(temperature / 4200, -0.11, 0.11);
  const tintShift = clamp(tint / 180, -0.08, 0.08);
  const baseSat = clamp(1 + saturation / 120, 0.55, 1.55);
  const clarityFactor = clamp(1 + clarity / 240, 0.85, 1.18);
  const fadeLift = clamp(fade / 100, 0, 0.16);

  for (let i = 0; i < data.length; i += 4) {
    const originalR = data[i] / 255;
    const originalG = data[i + 1] / 255;
    const originalB = data[i + 2] / 255;

    let r = originalR * exposureFactor;
    let g = originalG * exposureFactor;
    let b = originalB * exposureFactor;

    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const highMask = smoothstep(0.45, 0.96, luma);
    const whiteMask = smoothstep(0.72, 1.0, luma);
    const shadowMask = 1 - smoothstep(0.06, 0.56, luma);
    const blackMask = 1 - smoothstep(0.0, 0.32, luma);
    const midMask = 1 - Math.abs(luma - 0.5) * 2;

    const tonalOffset =
      (highlights / 100) * 0.22 * highMask +
      (whites / 100) * 0.14 * whiteMask +
      (shadows / 100) * 0.22 * shadowMask +
      (blacks / 100) * 0.13 * blackMask +
      fadeLift * blackMask * 0.75;

    r += tonalOffset;
    g += tonalOffset;
    b += tonalOffset;

    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const localContrast = contrastFactor + (clarityFactor - 1) * clamp(midMask, 0, 1);
    r = (r - 0.5) * localContrast + 0.5;
    g = (g - 0.5) * localContrast + 0.5;
    b = (b - 0.5) * localContrast + 0.5;

    // Temperature / tint. Keep this subtle so skin and flowers do not collapse.
    r += tempShift * 0.85 + tintShift * 0.38;
    g -= Math.abs(tintShift) * 0.16;
    b -= tempShift * 0.85;
    b += tintShift * 0.38;

    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const currentSat = clamp(max - min, 0, 1);
    const vibranceFactor = 1 + (vibrance / 135) * (1 - currentSat) * 0.9;
    const satFactor = clamp(baseSat * vibranceFactor, 0.45, 1.75);
    r = luma + (r - luma) * satFactor;
    g = luma + (g - luma) * satFactor;
    b = luma + (b - luma) * satFactor;

    // Gentle creamy fade instead of simply darkening the image.
    if (fadeLift > 0) {
      r = r * (1 - fadeLift * 0.22) + 0.93 * fadeLift * 0.22;
      g = g * (1 - fadeLift * 0.22) + 0.88 * fadeLift * 0.22;
      b = b * (1 - fadeLift * 0.22) + 0.78 * fadeLift * 0.22;
    }

    if (options?.addGrain && grain > 0) {
      const noise = (Math.random() - 0.5) * (grain / 100) * 0.055;
      r += noise;
      g += noise;
      b += noise;
    }

    if (options?.skinProtection !== false && skinMask(originalR, originalG, originalB)) {
      // Blend part of the original skin tone back in. This prevents grey/dirty skin.
      const protect = 0.36 * s;
      r = r * (1 - protect) + originalR * protect;
      g = g * (1 - protect) + originalG * protect;
      b = b * (1 - protect) + originalB * protect;
    }

    data[i] = Math.round(clamp(r) * 255);
    data[i + 1] = Math.round(clamp(g) * 255);
    data[i + 2] = Math.round(clamp(b) * 255);
  }

  return imageData;
}

function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number, previewStrength: number) {
  if (!strength) return;
  const alpha = Math.max(0, Math.min(0.22, Math.abs(strength) / 100 * 0.22 * previewStrength));
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.18,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("圖片載入失敗，請改用 JPG / PNG 再試一次。"));
    };
    img.src = url;
  });
}

async function resizeForAnalysis(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("只能上傳圖片檔案");
  const blob = await renderToneBlob(file, undefined, {
    maxEdge,
    quality: jpegQuality,
    strength: 0,
    skinProtection: false,
    addGrain: false
  });
  return blob;
}

async function uploadToCloudinary(file: File) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const folder = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER || "eric-tone-user-uploads";

  if (!cloudName) throw new Error("Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  if (!uploadPreset) throw new Error("Missing NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET");

  const compressed = await resizeForAnalysis(file);
  const formData = new FormData();
  formData.append("file", compressed, `${normalizeName(file.name)}_user.jpg`);
  formData.append("upload_preset", uploadPreset);
  if (folder) formData.append("folder", `${folder}/user`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Cloudinary upload failed");
  return data.secure_url as string;
}

async function renderToneBlob(file: File, params: Record<string, any> | undefined, options: RenderOptions) {
  const img = await loadImageFromFile(file);
  const scale = Math.min(1, options.maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 初始化失敗");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  if (params && options.strength > 0) {
    const imageData = ctx.getImageData(0, 0, width, height);
    applyToneToImageData(imageData, params, options.strength, {
      skinProtection: options.skinProtection,
      addGrain: options.addGrain
    });
    ctx.putImageData(imageData, 0, 0);
    drawVignette(ctx, width, height, getNumber(params, "vignette"), options.strength);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("輸出 JPG 失敗"))),
      "image/jpeg",
      options.quality
    );
  });
}

async function blobToObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

async function downloadEditedPreview(file: File, params: Record<string, any> | undefined, styleFamily: string, previewStrength: number) {
  if (!params) throw new Error("還沒有可下載的調色參數，請先產生 Lightroom 建議。");
  const maxDownloadEdge = Number(process.env.NEXT_PUBLIC_DOWNLOAD_MAX_EDGE || 3000);
  const blob = await renderToneBlob(file, params, {
    maxEdge: maxDownloadEdge,
    quality: 0.94,
    strength: previewStrength,
    skinProtection: true,
    addGrain: true
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeStyle = styleFamily.replace(/[\\/:*?"<>|\s]+/g, "-");
  link.href = url;
  link.download = `eric-tone-${safeStyle || "preview"}-refined.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ResultPanel({ result }: { result: RecipeResult | null }) {
  if (!result?.analysis) return null;
  const a = result.analysis;
  return (
    <div className="card stack">
      <div className="row">
        <h2>Lightroom 建議配方</h2>
        <span className="badge">{result.styleFamily}</span>
      </div>
      <p>{a.photo_assessment}</p>
      <section>
        <h3>完整建議</h3>
        <pre>{a.lightroom_recipe}</pre>
      </section>
      <div className="grid">
        <section>
          <h3>Basic</h3>
          <pre>{a.lightroom_basic_params}</pre>
        </section>
        <section>
          <h3>Color / HSL</h3>
          <pre>{a.lightroom_color_params}</pre>
        </section>
      </div>
      <section>
        <h3>Tone Curve</h3>
        <pre>{a.tone_curve_notes}</pre>
      </section>
      <section>
        <h3>使用提醒</h3>
        <p>{a.usage_notes}</p>
      </section>
      <details>
        <summary>Web Preview Params</summary>
        <pre>{JSON.stringify(a.web_preview_params, null, 2)}</pre>
      </details>
    </div>
  );
}

export default function PublicToneTool() {
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [styleFamily, setStyleFamily] = useState("冷調自然");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string>("");
  const [status, setStatus] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("");
  const [previewStatus, setPreviewStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecipeResult | null>(null);
  const [previewStrength, setPreviewStrength] = useState(defaultPreviewStrength);

  useEffect(() => {
    fetch("/api/styles")
      .then((res) => res.json())
      .then((data) => {
        const items = Array.isArray(data.styles) ? data.styles : [];
        setStyles(items);
        if (!styleFamily && items[0]?.name) setStyleFamily(items[0].name);
      })
      .catch(() => {
        // keep UI usable even if styles cannot be loaded
      });
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    async function buildEditedPreview() {
      if (!file || !result?.analysis?.web_preview_params) {
        setEditedPreviewUrl("");
        return;
      }
      setPreviewStatus("正在產生精緻預覽…");
      try {
        const blob = await renderToneBlob(file, result.analysis.web_preview_params, {
          maxEdge: 1400,
          quality: 0.88,
          strength: previewStrength,
          skinProtection: true,
          addGrain: false
        });
        objectUrl = await blobToObjectUrl(blob);
        if (!cancelled) {
          setEditedPreviewUrl(objectUrl);
          setPreviewStatus("");
        }
      } catch (err: any) {
        if (!cancelled) {
          setEditedPreviewUrl("");
          setPreviewStatus("");
          setError(err?.message || "精緻預覽產生失敗");
        }
      }
    }

    buildEditedPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, result, previewStrength]);

  const selectedStyle = useMemo(() => styles.find((s) => s.name === styleFamily), [styles, styleFamily]);

  async function run() {
    if (!file || !styleFamily) return;
    setError("");
    setDownloadStatus("");
    setPreviewStatus("");
    setResult(null);
    setEditedPreviewUrl("");
    try {
      setStatus("上傳分析用圖片…");
      const imageUrl = await uploadToCloudinary(file);
      setStatus("AI 產生 Lightroom 建議中…");
      const res = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, styleFamily })
      });
      const text = await res.text();
      let data: RecipeResult;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`伺服器回傳非 JSON：${text.slice(0, 180)}`);
      }
      if (!res.ok || data.ok === false) throw new Error(data.error || "產生失敗");
      setResult(data);
      setStatus("完成，可以下載精緻預覽 JPG");
    } catch (err: any) {
      setStatus("失敗");
      setError(err?.message || "未知錯誤");
    }
  }

  async function downloadPreview() {
    if (!file) return;
    setError("");
    setDownloadStatus("正在產生精緻下載檔…");
    try {
      await downloadEditedPreview(file, result?.analysis?.web_preview_params, styleFamily, previewStrength);
      setDownloadStatus("下載已開始");
    } catch (err: any) {
      setDownloadStatus("");
      setError(err?.message || "下載失敗");
    }
  }

  return (
    <main className="container public-container">
      <div className="hero card">
        <div>
          <span className="badge">Eric Tone Lightroom Assistant</span>
          <h1>把你的照片轉成 Eric 的調色建議</h1>
          <p>
            上傳一張 JPG / PNG，選擇一個 Style Family，系統會根據已整理的調色資料庫產生 Lightroom 建議數值與精緻預覽圖。
          </p>
        </div>
        <a className="badge" href="/admin">Admin</a>
      </div>

      <div className="grid">
        <section className="card stack">
          <h2>1. 選擇照片</h2>
          <label className="drop">
            <div className="stack">
              <strong>{file ? file.name : "上傳使用者照片"}</strong>
              <span className="small">建議使用 JPG / PNG；上傳前會自動壓縮分析用版本，下載會使用較高解析輸出。</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] || null;
                  setFile(nextFile);
                  setResult(null);
                  setEditedPreviewUrl("");
                  setError("");
                }}
              />
            </div>
          </label>

          <h2>2. 選擇風格</h2>
          <select className="select-large" value={styleFamily} onChange={(e) => setStyleFamily(e.target.value)}>
            {styles.length ? (
              styles.map((style) => (
                <option key={style.name} value={style.name}>
                  {style.name}（{style.count}）
                </option>
              ))
            ) : (
              <>
                <option value="冷調自然">冷調自然</option>
                <option value="冷調城市">冷調城市</option>
                <option value="低光夜景">低光夜景</option>
                <option value="暖調室內">暖調室內</option>
                <option value="柔霧暖光">柔霧暖光</option>
                <option value="底片褪色">底片褪色</option>
                <option value="清透日常">清透日常</option>
                <option value="黑白顆粒">黑白顆粒</option>
              </>
            )}
          </select>
          {selectedStyle && <p className="small">目前資料庫中有 {selectedStyle.count} 筆可參考資料。</p>}

          <div className="stack compact-stack">
            <label className="small" htmlFor="preview-strength">預覽 / 下載強度：{Math.round(previewStrength * 100)}%</label>
            <input
              id="preview-strength"
              type="range"
              min="25"
              max="85"
              step="5"
              value={Math.round(previewStrength * 100)}
              onChange={(e) => setPreviewStrength(Number(e.target.value) / 100)}
            />
            <span className="small">建議 45–65%。人像或暖色照片不要拉太高，會比較自然。</span>
          </div>

          <button disabled={!file || !styleFamily || status.includes("中")} onClick={run}>產生 Lightroom 建議</button>
          {status && <strong>{status}</strong>}
          {error && <p className="status-error">{error}</p>}
        </section>

        <section className="card stack">
          <h2>預覽</h2>
          {previewUrl ? (
            <div className="preview-grid">
              <div>
                <span className="small">原圖</span>
                <img src={previewUrl} alt="Original preview" />
              </div>
              <div>
                <span className="small">精緻預覽</span>
                {editedPreviewUrl ? (
                  <img src={editedPreviewUrl} alt="Edited preview" />
                ) : (
                  <div className="preview-placeholder">{previewStatus || "產生建議後會顯示精緻預覽"}</div>
                )}
              </div>
            </div>
          ) : (
            <p>上傳照片後會出現預覽。</p>
          )}
          <p className="small">
            這版會用 Canvas 做像素級調整，包含曝光、明暗部、色溫、飽和、淡化黑位、暗角與膚色保護；仍是網頁近似效果，不會 100% 等同 Lightroom。
          </p>
          <button className="download-button" disabled={!file || !result?.analysis || !!previewStatus} onClick={downloadPreview}>
            下載精緻調色 JPG
          </button>
          {downloadStatus && <strong className="status-ok">{downloadStatus}</strong>}
        </section>
      </div>

      <ResultPanel result={result} />
    </main>
  );
}
