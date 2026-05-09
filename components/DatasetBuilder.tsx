"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "single" | "batch" | "metadata" | "classify";
type JobStatus = "pending" | "uploading" | "analyzing" | "done" | "error";

type BatchPair = {
  key: string;
  original: File;
  edited: File;
  metadata?: File;
  status: JobStatus;
  message?: string;
  result?: any;
};

type MetadataJob = {
  key: string;
  file: File;
  status: JobStatus;
  message?: string;
  result?: any;
};

const maxEdge = Number(process.env.NEXT_PUBLIC_ANALYSIS_MAX_EDGE || 1600);
const jpegQuality = Number(process.env.NEXT_PUBLIC_ANALYSIS_JPEG_QUALITY || 0.76);

function normalizeName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  return base
    .replace(/[._\-\s]*(metadata|xmp|json)$/i, "")
    .replace(/[_\-\s]*(original|orig|before|raw|原圖)$/i, "")
    .replace(/[_\-\s]*(edited|edit|after|調色後|成品)$/i, "")
    .trim();
}

function makePhotoId(prefix = "ET") {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${d}${hh}${mm}${ss}-${rand}`;
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

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("圖片壓縮失敗"))),
      "image/jpeg",
      jpegQuality
    );
  });

  return blob;
}

async function uploadToCloudinary(file: File, label: "original" | "edited") {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const folder = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER || "eric-tone-dataset";

  if (!cloudName) throw new Error("Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  if (!uploadPreset) throw new Error("Missing NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET");

  const compressed = await resizeForAnalysis(file);
  const formData = new FormData();
  formData.append("file", compressed, `${normalizeName(file.name)}_${label}.jpg`);
  formData.append("upload_preset", uploadPreset);
  if (folder) formData.append("folder", `${folder}/${label}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Cloudinary upload failed");
  }
  return data.secure_url as string;
}


async function readMetadataJson(file?: File | null) {
  if (!file) return null;
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${file.name} 不是有效的 JSON 檔案`);
  }
}

function FileBox({ label, multiple, onChange, accept = "image/*" }: { label: string; multiple?: boolean; onChange: (files: File[]) => void; accept?: string }) {
  return (
    <label className="drop">
      <div className="stack">
        <strong>{label}</strong>
        <span className="small">建議 JPG，長邊 1200–1600px 分析最快；大圖會在前端自動壓縮。</span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => onChange(Array.from(e.target.files || []))}
        />
      </div>
    </label>
  );
}

function ResultBlock({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="card stack">
      <h2>分析結果</h2>
      {data.analysis ? (
        <>
          <div>
            <span className="badge">Style Family</span>
            <pre>{data.analysis.style_family}</pre>
          </div>
          <div>
            <span className="badge">Lightroom Recipe</span>
            <pre>{data.analysis.lightroom_recipe}</pre>
          </div>
          <div>
            <span className="badge">Web Preview Params</span>
            <pre>{JSON.stringify(data.analysis.web_preview_params, null, 2)}</pre>
          </div>
        </>
      ) : (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}

async function analyzePair(original: File, edited: File, writeToNotion: boolean, setMessage?: (msg: string) => void, metadata?: File | null) {
  setMessage?.("上傳原圖到 Cloudinary…");
  const originalUrl = await uploadToCloudinary(original, "original");
  setMessage?.("上傳調色後圖片到 Cloudinary…");
  const editedUrl = await uploadToCloudinary(edited, "edited");
  setMessage?.(metadata ? "讀取 Lightroom metadata…" : "AI 分析中…");
  const metadataJson = await readMetadataJson(metadata);
  setMessage?.("AI 分析中…");

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      photoId: makePhotoId(),
      originalUrl,
      editedUrl,
      writeToNotion,
      metadataJson
    })
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : { error: await res.text() };
  if (!res.ok || data?.ok === false) throw new Error(data?.error || "分析失敗");
  return data;
}

export default function DatasetBuilder() {
  const [tab, setTab] = useState<Tab>("single");
  const [singleOriginal, setSingleOriginal] = useState<File | null>(null);
  const [singleEdited, setSingleEdited] = useState<File | null>(null);
  const [singleMetadata, setSingleMetadata] = useState<File | null>(null);
  const [writeToNotion, setWriteToNotion] = useState(true);
  const [singleStatus, setSingleStatus] = useState("");
  const [singleResult, setSingleResult] = useState<any>(null);
  const [singleError, setSingleError] = useState("");

  const [originalFiles, setOriginalFiles] = useState<File[]>([]);
  const [editedFiles, setEditedFiles] = useState<File[]>([]);
  const [metadataFiles, setMetadataFiles] = useState<File[]>([]);
  const [jobs, setJobs] = useState<BatchPair[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const [metadataOnlyFiles, setMetadataOnlyFiles] = useState<File[]>([]);
  const [metadataJobs, setMetadataJobs] = useState<MetadataJob[]>([]);
  const [metadataRunning, setMetadataRunning] = useState(false);
  const [metadataSummary, setMetadataSummary] = useState<any>(null);

  const [classifyLimit, setClassifyLimit] = useState(5);
  const [classifyStatus, setClassifyStatus] = useState("");
  const [classifyResult, setClassifyResult] = useState<any>(null);
  const [classifyError, setClassifyError] = useState("");
  const [unclassifiedCount, setUnclassifiedCount] = useState<number | null>(null);
  const [countStatus, setCountStatus] = useState("");

  const pairedPreview = useMemo(() => {
    const editedMap = new Map(editedFiles.map((file) => [normalizeName(file.name), file]));
    const metadataMap = new Map(metadataFiles.map((file) => [normalizeName(file.name), file]));
    const pairs: BatchPair[] = [];
    const missingEdited: string[] = [];

    for (const original of originalFiles) {
      const key = normalizeName(original.name);
      const edited = editedMap.get(key);
      if (edited) {
        pairs.push({ key, original, edited, metadata: metadataMap.get(key), status: "pending" });
      } else {
        missingEdited.push(original.name);
      }
    }

    const originalKeys = new Set(originalFiles.map((file) => normalizeName(file.name)));
    const missingOriginal = editedFiles.filter((file) => !originalKeys.has(normalizeName(file.name))).map((file) => file.name);

    return { pairs, missingEdited, missingOriginal };
  }, [originalFiles, editedFiles, metadataFiles]);

  async function runSingle() {
    if (!singleOriginal || !singleEdited) return;
    setSingleError("");
    setSingleResult(null);
    try {
      const result = await analyzePair(singleOriginal, singleEdited, writeToNotion, setSingleStatus, singleMetadata);
      setSingleStatus("分析完成");
      setSingleResult(result);
    } catch (error: any) {
      setSingleStatus("失敗");
      setSingleError(error?.message || "未知錯誤");
    }
  }

  async function prepareBatch() {
    setJobs(pairedPreview.pairs);
  }

  async function runBatch() {
    const initialJobs = jobs.length ? jobs : pairedPreview.pairs;
    if (!initialJobs.length) return;
    setBatchRunning(true);
    const nextJobs = initialJobs.map((job) => ({ ...job, status: "pending" as JobStatus, message: "等待中" }));
    setJobs(nextJobs);

    for (let i = 0; i < nextJobs.length; i++) {
      setJobs((current) => current.map((job, idx) => (idx === i ? { ...job, status: "uploading", message: "準備上傳" } : job)));
      try {
        const result = await analyzePair(nextJobs[i].original, nextJobs[i].edited, writeToNotion, (message) => {
          setJobs((current) => current.map((job, idx) => (idx === i ? { ...job, message } : job)));
        }, nextJobs[i].metadata);
        setJobs((current) =>
          current.map((job, idx) =>
            idx === i ? { ...job, status: "done", message: "完成", result } : job
          )
        );
      } catch (error: any) {
        setJobs((current) =>
          current.map((job, idx) =>
            idx === i ? { ...job, status: "error", message: error?.message || "失敗" } : job
          )
        );
      }
    }
    setBatchRunning(false);
  }

  const metadataPreview = useMemo(() => {
    return metadataOnlyFiles.map((file) => ({
      key: normalizeName(file.name),
      file,
      status: "pending" as JobStatus,
      message: "等待中"
    }));
  }, [metadataOnlyFiles]);

  async function runMetadataBackfill() {
    const initialJobs = metadataJobs.length ? metadataJobs : metadataPreview;
    if (!initialJobs.length) return;
    setMetadataRunning(true);
    setMetadataSummary(null);
    const nextJobs = initialJobs.map((job) => ({ ...job, status: "pending" as JobStatus, message: "等待中" }));
    setMetadataJobs(nextJobs);

    for (let i = 0; i < nextJobs.length; i++) {
      setMetadataJobs((current) => current.map((job, idx) => (idx === i ? { ...job, status: "analyzing", message: "讀取 JSON 並尋找 Notion 資料列" } : job)));
      try {
        const metadataJson = await readMetadataJson(nextJobs[i].file);
        const res = await fetch("/api/metadata-backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{
              fileName: nextJobs[i].file.name,
              key: nextJobs[i].key,
              metadataJson
            }]
          })
        });

        const text = await res.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(`伺服器回傳非 JSON 內容：${text.slice(0, 180)}`);
        }
        if (!res.ok || data?.ok === false) throw new Error(data?.error || "補 metadata 失敗");
        const itemResult = data.results?.[0] || data;
        if (itemResult.status !== "updated") throw new Error(itemResult.message || "沒有更新成功");

        setMetadataJobs((current) =>
          current.map((job, idx) =>
            idx === i ? { ...job, status: "done", message: itemResult.message || "完成", result: itemResult } : job
          )
        );
      } catch (error: any) {
        setMetadataJobs((current) =>
          current.map((job, idx) =>
            idx === i ? { ...job, status: "error", message: error?.message || "失敗" } : job
          )
        );
      }
    }

    setMetadataRunning(false);
    setMetadataSummary({ done: true });
  }

  async function refreshUnclassifiedCount() {
    setCountStatus("讀取中…");
    try {
      const res = await fetch("/api/classify-styles", { method: "GET" });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`伺服器回傳非 JSON 內容：${text.slice(0, 180)}`);
      }
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "讀取未分類數量失敗");
      setUnclassifiedCount(Number(data.remaining || 0));
      setCountStatus("已更新");
    } catch (error: any) {
      setCountStatus(error?.message || "讀取失敗");
    }
  }

  useEffect(() => {
    if (tab === "classify" && unclassifiedCount === null) {
      refreshUnclassifiedCount();
    }
  }, [tab, unclassifiedCount]);

  async function runStyleClassify() {
    setClassifyError("");
    setClassifyResult(null);
    setClassifyStatus("AI 正在整理 Style Family…");
    try {
      const res = await fetch("/api/classify-styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: classifyLimit })
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`伺服器回傳非 JSON 內容，通常是 Vercel 函式逾時或崩潰：${text.slice(0, 180)}`);
      }
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "分類失敗");
      setClassifyStatus(`完成：處理 ${data.count} 筆，尚未分類 ${typeof data.remaining === "number" ? data.remaining : "?"} 筆`);
      if (typeof data.remaining === "number") setUnclassifiedCount(data.remaining);
      setClassifyResult(data);
    } catch (error: any) {
      setClassifyStatus("失敗");
      setClassifyError(error?.message || "未知錯誤");
    }
  }

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1>Chibubu Tone Admin</h1>
          <p>管理資料集、批次分析前後圖，並整理 Style Family。一般使用者前台在 /。</p>
        </div>
        <a className="badge" href="/">前往使用者前台</a>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "single" ? "active" : ""}`} onClick={() => setTab("single")}>單筆上傳</button>
        <button className={`tab ${tab === "batch" ? "active" : ""}`} onClick={() => setTab("batch")}>批次上傳</button>
        <button className={`tab ${tab === "metadata" ? "active" : ""}`} onClick={() => setTab("metadata")}>只補 Metadata</button>
        <button className={`tab ${tab === "classify" ? "active" : ""}`} onClick={() => setTab("classify")}>AI 整理 Style Family</button>
      </div>

      <label className="row card" style={{ marginBottom: 16 }}>
        <span>
          <strong>分析完成後寫入 Notion</strong>
          <br />
          <span className="small">關掉時只會分析，不會新增資料。</span>
        </span>
        <input type="checkbox" checked={writeToNotion} onChange={(e) => setWriteToNotion(e.target.checked)} />
      </label>

      {tab === "single" && (
        <div className="stack">
          <div className="grid">
            <FileBox label="Original Image 原圖" onChange={(files) => setSingleOriginal(files[0] || null)} />
            <FileBox label="Edited Image 調色後" onChange={(files) => setSingleEdited(files[0] || null)} />
            <FileBox label="Metadata JSON / XMP JSON（可選）" accept=".json,application/json" onChange={(files) => setSingleMetadata(files[0] || null)} />
          </div>
          {singleMetadata && <p className="small">已選擇 metadata：{singleMetadata.name}。系統會優先參考真實 Lightroom 參數。</p>}
          <div className="row card">
            <div>
              <strong>{singleStatus || "等待上傳"}</strong>
              {singleError && <p className="status-error">{singleError}</p>}
            </div>
            <button disabled={!singleOriginal || !singleEdited || singleStatus.includes("AI")} onClick={runSingle}>開始分析</button>
          </div>
          <ResultBlock data={singleResult} />
        </div>
      )}

      {tab === "batch" && (
        <div className="stack">
          <div className="grid">
            <FileBox label="Original Images 原圖，多選" multiple onChange={setOriginalFiles} />
            <FileBox label="Edited Images 調色後，多選" multiple onChange={setEditedFiles} />
            <FileBox label="Metadata JSON / XMP JSON（可選，多選）" accept=".json,application/json" multiple onChange={setMetadataFiles} />
          </div>
          <div className="card stack">
            <div className="row">
              <div>
                <h2>配對檢查</h2>
                <p>系統會用檔名配對，例如 original/001.jpg 對 edited/001.jpg；若有 metadata/001.json，會一起套用真實 Lightroom 參數。</p>
              </div>
              <button className="secondary" onClick={prepareBatch}>更新配對清單</button>
            </div>
            <p>已配對：{pairedPreview.pairs.length} 組；其中 {pairedPreview.pairs.filter((p) => p.metadata).length} 組含 metadata JSON。</p>
            {pairedPreview.missingEdited.length > 0 && <p className="status-error">缺少調色後：{pairedPreview.missingEdited.join("、")}</p>}
            {pairedPreview.missingOriginal.length > 0 && <p className="status-error">缺少原圖：{pairedPreview.missingOriginal.join("、")}</p>}
            <button disabled={!pairedPreview.pairs.length || batchRunning} onClick={runBatch}>開始批次分析</button>
          </div>
          {(jobs.length > 0 || pairedPreview.pairs.length > 0) && (
            <div className="card">
              <h2>批次進度</h2>
              <table className="table">
                <thead>
                  <tr><th>檔名 key</th><th>Metadata</th><th>狀態</th><th>訊息</th></tr>
                </thead>
                <tbody>
                  {(jobs.length ? jobs : pairedPreview.pairs).map((job) => (
                    <tr key={job.key}>
                      <td>{job.key}</td>
                      <td>{job.metadata ? "有" : "—"}</td>
                      <td className={job.status === "done" ? "status-ok" : job.status === "error" ? "status-error" : ""}>{job.status}</td>
                      <td>{job.message || "等待中"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {tab === "metadata" && (
        <div className="stack">
          <div className="card stack">
            <h2>只上傳 Metadata JSON，自動配對既有資料</h2>
            <p>
              這個功能不會重新上傳原圖 / 成品圖，也不會重新做圖片分析。
              它會用 JSON 檔名去找 Notion 裡既有的 Photo ID，例如
              <code> DSCF7930.metadata.json </code>會尋找包含 <code>dscf7930</code> 的資料列，
              然後寫入 Parsed Lightroom Values 與 Has Real Lightroom Params。
            </p>
            <FileBox label="Metadata JSON / XMP JSON，多選" accept=".json,application/json" multiple onChange={setMetadataOnlyFiles} />
            <p>已選擇：{metadataPreview.length} 個 JSON。</p>
            <div className="row">
              <button className="secondary" onClick={() => setMetadataJobs(metadataPreview)}>更新配對清單</button>
              <button disabled={!metadataPreview.length || metadataRunning} onClick={runMetadataBackfill}>開始補到既有 Notion 資料</button>
            </div>
            <p className="small">建議一次先補 10～20 個 JSON。若出現找不到資料列，請確認 Photo ID 內有包含原始檔名。</p>
          </div>
          {(metadataJobs.length > 0 || metadataPreview.length > 0) && (
            <div className="card">
              <h2>Metadata 補資料進度</h2>
              <table className="table">
                <thead>
                  <tr><th>檔名 key</th><th>JSON 檔名</th><th>狀態</th><th>訊息</th></tr>
                </thead>
                <tbody>
                  {(metadataJobs.length ? metadataJobs : metadataPreview).map((job) => (
                    <tr key={`${job.key}-${job.file.name}`}>
                      <td>{job.key}</td>
                      <td>{job.file.name}</td>
                      <td className={job.status === "done" ? "status-ok" : job.status === "error" ? "status-error" : ""}>{job.status}</td>
                      <td>{job.message || "等待中"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {metadataSummary && <p className="status-ok">補資料流程已結束。</p>}
            </div>
          )}
        </div>
      )}

      {tab === "classify" && (
        <div className="stack">
          <div className="card stack">
            <h2>AI 整理 Style Family</h2>
            <p>
              這個功能不會重新看圖片，只會讀 Notion 裡既有的 AI 分析文字，將 Style Family 空白的資料歸類到固定分類。
              建議一次先處理 5 筆，避免 Vercel 函式逾時；處理完可以再按一次。
            </p>
            <div className="mini-card row">
              <div>
                <span className="small">目前 Style Family 尚未分類</span>
                <strong className="count-number">{unclassifiedCount === null ? "—" : unclassifiedCount}</strong>
                <span className="small">筆</span>
                {countStatus && <div className="small">{countStatus}</div>}
              </div>
              <button className="secondary" onClick={refreshUnclassifiedCount}>重新計算</button>
            </div>
            <div className="row">
              <label>
                每次處理筆數：{" "}
                <select value={classifyLimit} onChange={(e) => setClassifyLimit(Number(e.target.value))}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </select>
              </label>
              <button onClick={runStyleClassify}>開始整理未分類資料</button>
            </div>
            <strong>{classifyStatus || "等待執行"}</strong>
            {classifyError && <p className="status-error">{classifyError}</p>}
          </div>
          <ResultBlock data={classifyResult} />
        </div>
      )}
    </main>
  );
}
