"use client";

import { useMemo, useState } from "react";

type WebPreviewParams = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  clarity: number;
  fade: number;
  grain: number;
  vignette: number;
};

type Analysis = {
  style_cluster: string;
  style_name_draft: string;
  scene: string;
  lighting: string;
  subject: string;
  color_change_tags: string[];
  summary: string;
  lightroom_recipe: string;
  lightroom_basic_params: string;
  lightroom_color_params: string;
  tone_curve_notes: string;
  web_preview_params: WebPreviewParams;
  training_ready: boolean;
  confidence_score: number;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  data?: {
    photoId: string;
    originalUrl: string;
    editedUrl: string;
    analysis: Analysis;
    notionPageId: string | null;
  };
};

type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
};

function getPublicEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少環境變數：${name}`);
  return value;
}

function FileDropzone({
  title,
  description,
  file,
  onChange
}: {
  title: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  return (
    <label className="dropzone">
      {previewUrl ? (
        <img className="preview" src={previewUrl} alt={title} />
      ) : (
        <div className="dropzone-inner">
          <div className="dropzone-title">{title}</div>
          <p>{description}</p>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </label>
  );
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 300) || `Request failed with ${res.status}`);
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("圖片讀取失敗，請換成 JPG / PNG 再試一次。"));
    };
    img.src = url;
  });
}

async function compressImageForAnalysis(file: File): Promise<File> {
  const maxLongEdge = 2500;
  const targetQuality = 0.82;
  const img = await loadImage(file);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);

  if (file.size <= 3.5 * 1024 * 1024 && longEdge <= maxLongEdge) {
    return file;
  }

  const scale = Math.min(1, maxLongEdge / longEdge);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("瀏覽器不支援圖片壓縮處理。");

  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("圖片壓縮失敗，請換一張圖再試。"));
        else resolve(result);
      },
      "image/jpeg",
      targetQuality
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}-analysis.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now()
  });
}

async function uploadToCloudinary(file: File, label: "original" | "edited"): Promise<CloudinaryUploadResult> {
  const cloudName = getPublicEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  const uploadPreset = getPublicEnv("NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET");
  const rootFolder = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER || "eric-tone-dataset";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `${rootFolder}/${label}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed: ${data?.error?.message || JSON.stringify(data)}`);
  }

  return data as CloudinaryUploadResult;
}

function RecipeBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="recipe-block">
      <h3>{title}</h3>
      <pre>{text}</pre>
    </div>
  );
}

export default function Home() {
  const [original, setOriginal] = useState<File | null>(null);
  const [edited, setEdited] = useState<File | null>(null);
  const [writeToNotion, setWriteToNotion] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!original || !edited) {
      setError("請先上傳原圖與調色後圖片。");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      setStatus("正在準備分析用小圖…");
      const analysisOriginal = await compressImageForAnalysis(original);
      const analysisEdited = await compressImageForAnalysis(edited);

      setStatus("正在上傳原圖到 Cloudinary…");
      const originalUpload = await uploadToCloudinary(analysisOriginal, "original");

      setStatus("正在上傳調色後圖片到 Cloudinary…");
      const editedUpload = await uploadToCloudinary(analysisEdited, "edited");

      setStatus("圖片已上傳，正在交給 AI 產生 Lightroom 建議…");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalUrl: originalUpload.secure_url,
          editedUrl: editedUpload.secure_url,
          writeToNotion
        })
      });

      const data = (await parseJsonResponse(res)) as ApiResponse;

      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data.error || "分析失敗");
      }

      setResult(data.data);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div className="card">
            <div className="badge">Eric Tone AI · Lightroom Recipe Engine</div>
            <h1>上傳前後圖，讓 AI 幫你整理調色風格與 Lightroom 建議。</h1>
            <p>
              這版會先在瀏覽器把圖片壓成分析用小圖，再直接上傳到 Cloudinary，接著交給 AI 分析調色差異，產生 Lightroom Recipe、Tone Curve Notes 與 Web Preview Params，並可自動寫回 Notion。
            </p>
          </div>

          <div className="card steps">
            <div className="step">
              <strong>01 · Upload</strong>
              <p>上傳原圖與你調色後的成品圖。</p>
            </div>
            <div className="step">
              <strong>02 · Recipe</strong>
              <p>AI 比較兩張圖，產生 Lightroom 建議數值與色彩標籤。</p>
            </div>
            <div className="step">
              <strong>03 · Save</strong>
              <p>結果寫回 Notion，慢慢累積成你的調色資料集。</p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>新增一組調色資料</h2>
          <p>建議先使用 JPG / PNG。此版本會自動壓縮分析用圖片，原始高解析成品未來可另外儲存。</p>

          <div className="upload-grid">
            <FileDropzone
              title="Original Image 原圖"
              description="點擊或拖曳上傳未調色的照片"
              file={original}
              onChange={setOriginal}
            />
            <FileDropzone
              title="Edited Image 調色後"
              description="點擊或拖曳上傳你完成調色的版本"
              file={edited}
              onChange={setEdited}
            />
          </div>

          <div className="controls">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={writeToNotion}
                onChange={(event) => setWriteToNotion(event.target.checked)}
              />
              分析完成後寫入 Notion
            </label>
            <button className="primary-button" disabled={loading} onClick={handleSubmit}>
              {loading ? "處理中，請稍候…" : "開始分析"}
            </button>
          </div>

          {status && (
            <div className="card result">
              <strong>{status}</strong>
            </div>
          )}

          {error && (
            <div className="card result error">
              <strong>發生錯誤</strong>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="result">
              <div className="card">
                <h2>分析完成：{result.photoId}</h2>
                <p>{result.analysis.summary}</p>
                <div className="tags">
                  {result.analysis.color_change_tags.map((tag) => (
                    <span className="tag" key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <div className="result-grid">
                <div className="metric">
                  <small>Style Cluster</small>
                  <strong>{result.analysis.style_cluster}</strong>
                </div>
                <div className="metric">
                  <small>Scene</small>
                  <strong>{result.analysis.scene}</strong>
                </div>
                <div className="metric">
                  <small>Lighting</small>
                  <strong>{result.analysis.lighting}</strong>
                </div>
                <div className="metric">
                  <small>Confidence</small>
                  <strong>{result.analysis.confidence_score}</strong>
                </div>
              </div>

              <div className="card recipe-card">
                <h2>Lightroom 建議數值</h2>
                <RecipeBlock title="完整 Recipe" text={result.analysis.lightroom_recipe} />
                <RecipeBlock title="Basic Params" text={result.analysis.lightroom_basic_params} />
                <RecipeBlock title="Color Params" text={result.analysis.lightroom_color_params} />
                <RecipeBlock title="Tone Curve Notes" text={result.analysis.tone_curve_notes} />
                <RecipeBlock title="Web Preview Params" text={JSON.stringify(result.analysis.web_preview_params, null, 2)} />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
