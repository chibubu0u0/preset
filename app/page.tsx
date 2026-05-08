"use client";

import { useMemo, useState } from "react";

type Analysis = {
  style_cluster: string;
  style_name_draft: string;
  scene: string;
  lighting: string;
  subject: string;
  color_change_tags: string[];
  summary: string;
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

export default function Home() {
  const [original, setOriginal] = useState<File | null>(null);
  const [edited, setEdited] = useState<File | null>(null);
  const [writeToNotion, setWriteToNotion] = useState(true);
  const [loading, setLoading] = useState(false);
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
      const formData = new FormData();
      formData.append("original", original);
      formData.append("edited", edited);
      formData.append("writeToNotion", String(writeToNotion));

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data.error || "分析失敗");
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div className="card">
            <div className="badge">Eric Tone AI · Dataset Uploader</div>
            <h1>上傳前後圖，讓 AI 幫你整理調色風格。</h1>
            <p>
              這是方案 C 的第一版原型：你只要上傳原圖與調色後圖片，系統會把圖片上傳到雲端、交給 AI 分析調色差異，並可自動寫回 Notion 資料庫。
            </p>
          </div>

          <div className="card steps">
            <div className="step">
              <strong>01 · Upload</strong>
              <p>上傳原圖與你調色後的成品圖。</p>
            </div>
            <div className="step">
              <strong>02 · Analyze</strong>
              <p>AI 比較兩張圖，判斷色溫、對比、場景、光線與色彩標籤。</p>
            </div>
            <div className="step">
              <strong>03 · Save</strong>
              <p>結果寫回 Notion，慢慢累積成你的調色資料集。</p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>新增一組調色資料</h2>
          <p>建議先使用 JPG / PNG，每張圖控制在 8MB 以內。你可以先取消寫入 Notion，只測試 AI 分析。</p>

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
              {loading ? "分析中，請稍候…" : "開始分析"}
            </button>
          </div>

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
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
