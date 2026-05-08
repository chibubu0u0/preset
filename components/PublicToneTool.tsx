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

function normalizeName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/\s+/g, "-").slice(0, 60) || "photo";
}

async function resizeForAnalysis(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("只能上傳圖片檔案");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 初始化失敗");
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("圖片壓縮失敗"))),
      "image/jpeg",
      jpegQuality
    );
  });
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

function cssFilter(params?: Record<string, any>) {
  if (!params) return "none";
  const exposure = Number(params.exposure || 0);
  const contrast = Number(params.contrast || 0);
  const saturation = Number(params.saturation || 0);
  const vibrance = Number(params.vibrance || 0);
  const brightness = Math.max(0.55, Math.min(1.55, 1 + exposure * 0.35));
  const contrastValue = Math.max(0.55, Math.min(1.55, 1 + contrast / 140));
  const saturationValue = Math.max(0.45, Math.min(1.6, 1 + (saturation + vibrance * 0.5) / 120));
  return `brightness(${brightness}) contrast(${contrastValue}) saturate(${saturationValue})`;
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
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecipeResult | null>(null);

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

  const selectedStyle = useMemo(() => styles.find((s) => s.name === styleFamily), [styles, styleFamily]);

  async function run() {
    if (!file || !styleFamily) return;
    setError("");
    setResult(null);
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
      setStatus("完成");
    } catch (err: any) {
      setStatus("失敗");
      setError(err?.message || "未知錯誤");
    }
  }

  return (
    <main className="container public-container">
      <div className="hero card">
        <div>
          <span className="badge">Eric Tone Lightroom Assistant</span>
          <h1>把你的照片轉成 Eric 的調色建議</h1>
          <p>
            上傳一張 JPG / PNG，選擇一個 Style Family，系統會根據已整理的調色資料庫產生 Lightroom 建議數值與網頁預覽參數。
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
              <span className="small">建議長邊 2000–3000px 以內；上傳前會自動壓縮分析用版本。</span>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
                <span className="small">近似預覽</span>
                <img src={previewUrl} alt="Edited preview" style={{ filter: cssFilter(result?.analysis?.web_preview_params) }} />
              </div>
            </div>
          ) : (
            <p>上傳照片後會出現預覽。</p>
          )}
          <p className="small">網頁預覽是依據參數做近似效果，不會 100% 等同 Lightroom。</p>
        </section>
      </div>

      <ResultPanel result={result} />
    </main>
  );
}
