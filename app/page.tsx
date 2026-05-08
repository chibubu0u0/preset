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

type PairStatus = "ready" | "compressing" | "uploading" | "analyzing" | "done" | "error";

type BatchPair = {
  id: string;
  key: string;
  original: File;
  edited: File;
  status: PairStatus;
  statusText: string;
  result?: ApiResponse["data"];
  error?: string;
};

type PairCandidate = {
  key: string;
  original?: File;
  edited?: File;
};

function getPublicEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少環境變數：${name}`);
  return value;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function sanitizeIdPart(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "pair";
}

function normalizePairKey(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, "")
    .replace(/[_-]?(original|orig|before|raw|原圖|未調色)$/i, "")
    .replace(/[_-]?(edited|edit|after|final|調色後|成品)$/i, "")
    .toLowerCase();
}

function createPhotoId(key: string, index: number) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `ET-${timestamp}-${String(index + 1).padStart(3, "0")}-${sanitizeIdPart(key)}`;
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

function MultiFilePicker({
  title,
  description,
  count,
  onChange
}: {
  title: string;
  description: string;
  count: number;
  onChange: (files: File[]) => void;
}) {
  return (
    <label className="multi-picker">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <span>{count > 0 ? `${count} 張` : "選擇多張"}</span>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => onChange(Array.from(event.target.files || []))}
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
  const maxLongEdge = 2200;
  const targetQuality = 0.8;
  const img = await loadImage(file);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);

  if (file.size <= 2.5 * 1024 * 1024 && longEdge <= maxLongEdge) {
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

async function analyzeUploadedUrls(params: {
  originalUrl: string;
  editedUrl: string;
  writeToNotion: boolean;
  photoId?: string;
}) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });

  const data = (await parseJsonResponse(res)) as ApiResponse;

  if (!res.ok || !data.ok || !data.data) {
    throw new Error(data.error || "分析失敗");
  }

  return data.data;
}

function RecipeBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="recipe-block">
      <h3>{title}</h3>
      <pre>{text}</pre>
    </div>
  );
}

function StatusPill({ status }: { status: PairStatus }) {
  const labels: Record<PairStatus, string> = {
    ready: "等待",
    compressing: "壓縮中",
    uploading: "上傳中",
    analyzing: "分析中",
    done: "完成",
    error: "失敗"
  };

  return <span className={`status-pill status-${status}`}>{labels[status]}</span>;
}

export default function Home() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [original, setOriginal] = useState<File | null>(null);
  const [edited, setEdited] = useState<File | null>(null);
  const [writeToNotion, setWriteToNotion] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [originalFiles, setOriginalFiles] = useState<File[]>([]);
  const [editedFiles, setEditedFiles] = useState<File[]>([]);
  const [batchPairs, setBatchPairs] = useState<BatchPair[]>([]);
  const [missingPairs, setMissingPairs] = useState<PairCandidate[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const batchSummary = useMemo(() => {
    const done = batchPairs.filter((pair) => pair.status === "done").length;
    const failed = batchPairs.filter((pair) => pair.status === "error").length;
    return { total: batchPairs.length, done, failed };
  }, [batchPairs]);

  function buildBatchPairs(nextOriginalFiles = originalFiles, nextEditedFiles = editedFiles) {
    const map = new Map<string, PairCandidate>();

    for (const file of nextOriginalFiles) {
      const key = normalizePairKey(file.name);
      const current = map.get(key) || { key };
      current.original = file;
      map.set(key, current);
    }

    for (const file of nextEditedFiles) {
      const key = normalizePairKey(file.name);
      const current = map.get(key) || { key };
      current.edited = file;
      map.set(key, current);
    }

    const paired: BatchPair[] = [];
    const missing: PairCandidate[] = [];

    Array.from(map.values())
      .sort((a, b) => a.key.localeCompare(b.key, "zh-Hant"))
      .forEach((candidate, index) => {
        if (candidate.original && candidate.edited) {
          paired.push({
            id: `${candidate.key}-${index}`,
            key: candidate.key,
            original: candidate.original,
            edited: candidate.edited,
            status: "ready",
            statusText: "已配對，等待分析"
          });
        } else {
          missing.push(candidate);
        }
      });

    setBatchPairs(paired);
    setMissingPairs(missing);
  }

  function handleOriginalFiles(files: File[]) {
    setOriginalFiles(files);
    buildBatchPairs(files, editedFiles);
  }

  function handleEditedFiles(files: File[]) {
    setEditedFiles(files);
    buildBatchPairs(originalFiles, files);
  }

  function updatePair(id: string, updates: Partial<BatchPair>) {
    setBatchPairs((pairs) => pairs.map((pair) => (pair.id === id ? { ...pair, ...updates } : pair)));
  }

  async function processOnePair(pair: BatchPair, index: number) {
    updatePair(pair.id, { status: "compressing", statusText: "正在準備分析用小圖…", error: undefined });
    const analysisOriginal = await compressImageForAnalysis(pair.original);
    const analysisEdited = await compressImageForAnalysis(pair.edited);

    updatePair(pair.id, { status: "uploading", statusText: "正在上傳到 Cloudinary…" });
    const originalUpload = await uploadToCloudinary(analysisOriginal, "original");
    const editedUpload = await uploadToCloudinary(analysisEdited, "edited");

    updatePair(pair.id, { status: "analyzing", statusText: "正在產生 Lightroom Recipe…" });
    const data = await analyzeUploadedUrls({
      originalUrl: originalUpload.secure_url,
      editedUrl: editedUpload.secure_url,
      writeToNotion,
      photoId: createPhotoId(pair.key, index)
    });

    updatePair(pair.id, {
      status: "done",
      statusText: `完成：${data.photoId}`,
      result: data
    });
  }

  async function handleBatchSubmit() {
    if (batchPairs.length === 0) {
      setError("請先選擇 Original Images 與 Edited Images，並確認檔名可以配對。");
      return;
    }

    setBatchRunning(true);
    setError(null);
    setResult(null);

    for (let index = 0; index < batchPairs.length; index += 1) {
      const latestPair = batchPairs[index];
      if (!latestPair || latestPair.status === "done") continue;

      try {
        await processOnePair(latestPair, index);
      } catch (err) {
        updatePair(latestPair.id, {
          status: "error",
          statusText: "處理失敗",
          error: err instanceof Error ? err.message : "未知錯誤"
        });
      }
    }

    setBatchRunning(false);
  }

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
      const data = await analyzeUploadedUrls({
        originalUrl: originalUpload.secure_url,
        editedUrl: editedUpload.secure_url,
        writeToNotion
      });

      setResult(data);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  const latestCompleted = result || [...batchPairs].reverse().find((pair) => pair.result)?.result || null;

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div className="card">
            <div className="badge">Eric Tone AI · Lightroom Recipe Engine</div>
            <h1>上傳前後圖，讓 AI 幫你整理調色風格與 Lightroom 建議。</h1>
            <p>
              這版支援單筆與批次上傳。批次模式會依照檔名自動配對 Original / Edited，逐筆上傳 Cloudinary、產生 Lightroom Recipe，並可寫回 Notion。
            </p>
          </div>

          <div className="card steps">
            <div className="step">
              <strong>01 · Pair</strong>
              <p>批次模式請讓原圖與調色後的檔名一致，例如 original/001.jpg 對 edited/001.jpg。</p>
            </div>
            <div className="step">
              <strong>02 · Recipe</strong>
              <p>AI 比較每一組照片，產生 Lightroom 建議數值、曲線說明與色彩標籤。</p>
            </div>
            <div className="step">
              <strong>03 · Save</strong>
              <p>逐筆寫回 Notion，慢慢累積成你的調色資料集。</p>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="mode-tabs">
            <button className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>單筆上傳</button>
            <button className={mode === "batch" ? "active" : ""} onClick={() => setMode("batch")}>批次上傳</button>
          </div>

          {mode === "single" ? (
            <>
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
            </>
          ) : (
            <>
              <h2>批次新增調色資料</h2>
              <p>請分別選擇多張原圖與多張調色後圖片。系統會用檔名自動配對，例如 001.jpg 對 001.jpg，也支援 001_original.jpg 對 001_edited.jpg。</p>

              <div className="batch-picker-grid">
                <MultiFilePicker
                  title="Original Images 原圖"
                  description="可一次選擇多張未調色照片"
                  count={originalFiles.length}
                  onChange={handleOriginalFiles}
                />
                <MultiFilePicker
                  title="Edited Images 調色後"
                  description="可一次選擇多張完成調色照片"
                  count={editedFiles.length}
                  onChange={handleEditedFiles}
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
                <button className="primary-button" disabled={batchRunning || batchPairs.length === 0} onClick={handleBatchSubmit}>
                  {batchRunning ? "批次處理中…" : `開始批次分析 ${batchPairs.length} 組`}
                </button>
              </div>

              <div className="batch-summary">
                <div className="metric">
                  <small>已配對</small>
                  <strong>{batchSummary.total}</strong>
                </div>
                <div className="metric">
                  <small>完成</small>
                  <strong>{batchSummary.done}</strong>
                </div>
                <div className="metric">
                  <small>失敗</small>
                  <strong>{batchSummary.failed}</strong>
                </div>
              </div>

              {missingPairs.length > 0 && (
                <div className="card result warning">
                  <strong>有 {missingPairs.length} 組檔名沒有成功配對</strong>
                  <p>請確認 original 與 edited 裡面是否都有同名檔案。</p>
                  <div className="tags">
                    {missingPairs.slice(0, 12).map((pair) => (
                      <span className="tag" key={pair.key}>{pair.key}</span>
                    ))}
                  </div>
                </div>
              )}

              {batchPairs.length > 0 && (
                <div className="batch-list">
                  {batchPairs.map((pair, index) => (
                    <div className="batch-row" key={pair.id}>
                      <div>
                        <strong>{String(index + 1).padStart(2, "0")} · {pair.key}</strong>
                        <p>{pair.original.name} / {pair.edited.name}</p>
                        <small>{formatBytes(pair.original.size)} + {formatBytes(pair.edited.size)}</small>
                      </div>
                      <div className="batch-row-status">
                        <StatusPill status={pair.status} />
                        <p>{pair.error || pair.statusText}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

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

          {latestCompleted && (
            <div className="result">
              <div className="card">
                <h2>最近完成：{latestCompleted.photoId}</h2>
                <p>{latestCompleted.analysis.summary}</p>
                <div className="tags">
                  {latestCompleted.analysis.color_change_tags.map((tag) => (
                    <span className="tag" key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <div className="result-grid">
                <div className="metric">
                  <small>Style Cluster</small>
                  <strong>{latestCompleted.analysis.style_cluster}</strong>
                </div>
                <div className="metric">
                  <small>Scene</small>
                  <strong>{latestCompleted.analysis.scene}</strong>
                </div>
                <div className="metric">
                  <small>Lighting</small>
                  <strong>{latestCompleted.analysis.lighting}</strong>
                </div>
                <div className="metric">
                  <small>Confidence</small>
                  <strong>{latestCompleted.analysis.confidence_score}</strong>
                </div>
              </div>

              <div className="card recipe-card">
                <h2>Lightroom 建議數值</h2>
                <RecipeBlock title="完整 Recipe" text={latestCompleted.analysis.lightroom_recipe} />
                <RecipeBlock title="Basic Params" text={latestCompleted.analysis.lightroom_basic_params} />
                <RecipeBlock title="Color Params" text={latestCompleted.analysis.lightroom_color_params} />
                <RecipeBlock title="Tone Curve Notes" text={latestCompleted.analysis.tone_curve_notes} />
                <RecipeBlock title="Web Preview Params" text={JSON.stringify(latestCompleted.analysis.web_preview_params, null, 2)} />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
