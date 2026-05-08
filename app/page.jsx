'use client';

import { useMemo, useState } from 'react';

const MAX_LONG_EDGE = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_LONG_EDGE || 2500);
const IMAGE_QUALITY = Number(process.env.NEXT_PUBLIC_IMAGE_QUALITY || 0.82);

function stripExtension(name) {
  return name.replace(/\.[^/.]+$/, '');
}

function normalizeKey(name) {
  return stripExtension(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[_-]?(original|orig|before|raw|原圖)$/i, '')
    .replace(/[_-]?(edited|edit|after|調色後|成品)$/i, '')
    .replace(/^(original|orig|before|raw|原圖)[_-]?/i, '')
    .replace(/^(edited|edit|after|調色後|成品)[_-]?/i, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
}

function fileSizeLabel(file) {
  if (!file) return '';
  const mb = file.size / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

async function compressImage(file) {
  if (!file) throw new Error('缺少圖片檔案');
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} 不是圖片格式`);

  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageUrl;
    });

    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY);
    });

    if (!blob) throw new Error('圖片壓縮失敗');

    const baseName = stripExtension(file.name).replace(/[^a-zA-Z0-9_-]+/g, '-');
    return new File([blob], `${baseName}-ai.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function uploadToCloudinary(file, role) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET;
  const baseFolder = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER || process.env.CLOUDINARY_FOLDER || 'eric-tone-dataset';

  if (!cloudName) throw new Error('Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME');
  if (!uploadPreset) throw new Error('Missing NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET');

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  async function attempt(withFolder) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    if (withFolder) formData.append('folder', `${baseFolder}/${role}`);

    const res = await fetch(endpoint, { method: 'POST', body: formData });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: text } };
    }

    if (!res.ok) {
      const message = data?.error?.message || text || 'Cloudinary upload failed';
      throw new Error(message);
    }
    return data;
  }

  try {
    const data = await attempt(true);
    return data.secure_url;
  } catch (error) {
    if (String(error.message).toLowerCase().includes('folder')) {
      const data = await attempt(false);
      return data.secure_url;
    }
    throw error;
  }
}

async function analyzePair({ originalFile, editedFile, pairName, writeToNotion }) {
  const compressedOriginal = await compressImage(originalFile);
  const compressedEdited = await compressImage(editedFile);

  const [originalUrl, editedUrl] = await Promise.all([
    uploadToCloudinary(compressedOriginal, 'original'),
    uploadToCloudinary(compressedEdited, 'edited')
  ]);

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl, editedUrl, pairName, writeToNotion })
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || 'API 回傳格式不是 JSON');
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.error || '分析失敗');
  }

  return data;
}

function FilePicker({ title, description, multiple = false, files, onChange }) {
  return (
    <div className="drop">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        onChange={(e) => onChange(Array.from(e.target.files || []))}
      />
      {!multiple && files?.[0] && (
        <>
          <img className="preview" src={URL.createObjectURL(files[0])} alt={files[0].name} />
          <p className="small">{files[0].name}・{fileSizeLabel(files[0])}</p>
        </>
      )}
      {multiple && files?.length > 0 && <p className="small">已選擇 {files.length} 張</p>}
    </div>
  );
}

function ResultBlock({ result }) {
  if (!result) return null;
  const a = result.analysis;
  return (
    <div className="result">
      <h2>分析完成：{result.photoId}</h2>
      <p>{a.summary}</p>

      <div className="tags">
        {(a.color_change_tags || []).map((tag) => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>

      <h3>Lightroom Recipe</h3>
      <pre>{a.lightroom_recipe}</pre>

      <h3>Basic Params</h3>
      <pre>{a.lightroom_basic_params}</pre>

      <h3>Color Params</h3>
      <pre>{a.lightroom_color_params}</pre>

      <h3>Tone Curve Notes</h3>
      <pre>{a.tone_curve_notes}</pre>

      <h3>Web Preview Params</h3>
      <pre>{JSON.stringify(a.web_preview_params, null, 2)}</pre>
    </div>
  );
}

export default function HomePage() {
  const [mode, setMode] = useState('single');
  const [originalFiles, setOriginalFiles] = useState([]);
  const [editedFiles, setEditedFiles] = useState([]);
  const [writeToNotion, setWriteToNotion] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [batchStatuses, setBatchStatuses] = useState({});
  const [batchResults, setBatchResults] = useState([]);

  const pairs = useMemo(() => {
    const originals = new Map(originalFiles.map((file) => [normalizeKey(file.name), file]));
    const edited = new Map(editedFiles.map((file) => [normalizeKey(file.name), file]));
    const keys = [...new Set([...originals.keys(), ...edited.keys()])].sort();
    return keys.map((key) => ({ key, original: originals.get(key), edited: edited.get(key) }));
  }, [originalFiles, editedFiles]);

  const validPairs = pairs.filter((pair) => pair.original && pair.edited);
  const unmatched = pairs.filter((pair) => !pair.original || !pair.edited);

  async function handleSingle() {
    setBusy(true);
    setError('');
    setMessage('準備上傳與分析...');
    setResult(null);

    try {
      if (!originalFiles[0] || !editedFiles[0]) throw new Error('請選擇原圖與調色後圖片');
      const data = await analyzePair({
        originalFile: originalFiles[0],
        editedFile: editedFiles[0],
        pairName: normalizeKey(originalFiles[0].name) || 'single',
        writeToNotion
      });
      setResult(data);
      setMessage(writeToNotion ? '分析完成，已寫入 Notion。' : '分析完成，未寫入 Notion。');
    } catch (e) {
      setError(e.message || '發生未知錯誤');
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  async function handleBatch() {
    setBusy(true);
    setError('');
    setMessage(`準備批次分析 ${validPairs.length} 組照片...`);
    setBatchResults([]);
    const statuses = {};
    validPairs.forEach((pair) => { statuses[pair.key] = { status: 'waiting', label: '等待中' }; });
    setBatchStatuses(statuses);

    try {
      if (!validPairs.length) throw new Error('沒有找到可配對的照片。請確認 original / edited 檔名一致。');

      const results = [];
      for (const pair of validPairs) {
        setBatchStatuses((prev) => ({ ...prev, [pair.key]: { status: 'running', label: '分析中' } }));
        try {
          const data = await analyzePair({
            originalFile: pair.original,
            editedFile: pair.edited,
            pairName: pair.key,
            writeToNotion
          });
          results.push(data);
          setBatchResults((prev) => [...prev, data]);
          setBatchStatuses((prev) => ({ ...prev, [pair.key]: { status: 'done', label: '已完成' } }));
        } catch (e) {
          setBatchStatuses((prev) => ({ ...prev, [pair.key]: { status: 'error', label: e.message || '失敗' } }));
        }
      }
      setMessage('批次處理結束。請查看每一列狀態與 Notion 資料庫。');
    } catch (e) {
      setError(e.message || '批次分析失敗');
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div className="eyebrow">Eric Tone AI</div>
          <h1>調色資料集<br />上傳後台</h1>
          <p className="subtitle">
            上傳「原圖 + 調色後」照片，AI 會分析你的調色邏輯，產生 Lightroom 建議數值、色彩標籤與網頁預覽參數，並可寫入 Notion。
          </p>
        </section>

        <section className="panel">
          <div className="tabs">
            <button className={`tab ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>單筆上傳</button>
            <button className={`tab ${mode === 'batch' ? 'active' : ''}`} onClick={() => setMode('batch')}>批次上傳</button>
          </div>

          {mode === 'single' ? (
            <>
              <div className="grid2">
                <FilePicker
                  title="Original Image"
                  description="請選擇原圖。建議 JPG、長邊約 2000–3000px。"
                  files={originalFiles}
                  onChange={setOriginalFiles}
                />
                <FilePicker
                  title="Edited Image"
                  description="請選擇你調色後的版本。"
                  files={editedFiles}
                  onChange={setEditedFiles}
                />
              </div>

              <div className="actions">
                <label className="checkbox">
                  <input type="checkbox" checked={writeToNotion} onChange={(e) => setWriteToNotion(e.target.checked)} />
                  分析完成後寫入 Notion
                </label>
                <button className="primary" disabled={busy} onClick={handleSingle}>{busy ? '處理中...' : '開始分析'}</button>
              </div>
              <ResultBlock result={result} />
            </>
          ) : (
            <>
              <div className="grid2">
                <FilePicker
                  title="Original Images"
                  description="一次選擇多張原圖。檔名需與調色後圖片相同，例如 001.jpg。"
                  multiple
                  files={originalFiles}
                  onChange={setOriginalFiles}
                />
                <FilePicker
                  title="Edited Images"
                  description="一次選擇多張調色後圖片。系統會依照檔名自動配對。"
                  multiple
                  files={editedFiles}
                  onChange={setEditedFiles}
                />
              </div>

              <div className="notice">
                找到 {validPairs.length} 組可配對照片。{unmatched.length > 0 ? `有 ${unmatched.length} 筆未配對，請檢查檔名。` : '目前沒有未配對檔案。'}
              </div>

              <div className="batch-list">
                {pairs.map((pair) => {
                  const status = batchStatuses[pair.key];
                  return (
                    <div key={pair.key} className="batch-row">
                      <span>{pair.original ? `原圖：${pair.original.name}` : '缺少原圖'}</span>
                      <span>{pair.edited ? `調色後：${pair.edited.name}` : '缺少調色後'}</span>
                      <span className={`status-pill ${status?.status || ''}`}>{status?.label || (pair.original && pair.edited ? '可分析' : '未配對')}</span>
                    </div>
                  );
                })}
              </div>

              <div className="actions">
                <label className="checkbox">
                  <input type="checkbox" checked={writeToNotion} onChange={(e) => setWriteToNotion(e.target.checked)} />
                  每筆分析完成後寫入 Notion
                </label>
                <button className="primary" disabled={busy || !validPairs.length} onClick={handleBatch}>{busy ? '批次處理中...' : `開始批次分析 ${validPairs.length} 組`}</button>
              </div>

              {batchResults.length > 0 && (
                <div className="result">
                  <h2>批次結果</h2>
                  <p>已完成 {batchResults.length} 組。</p>
                  {batchResults.slice(-3).map((item) => <ResultBlock key={item.photoId} result={item} />)}
                </div>
              )}
            </>
          )}

          {message && <div className="success">{message}</div>}
          {error && <div className="error"><strong>發生錯誤</strong><br />{error}</div>}
        </section>
      </div>
    </main>
  );
}
