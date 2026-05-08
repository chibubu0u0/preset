# Eric Tone Web Uploader — Lightroom Recipe Version

這是一個 Next.js / Vercel 原型，用來建立攝影調色資料集。

流程：

1. 上傳原圖與調色後圖片
2. 瀏覽器先自動壓縮成分析用小圖
3. 直接上傳到 Cloudinary
4. 將 Cloudinary 圖片 URL 交給 OpenAI Vision 分析
5. 產生調色分析、Lightroom Recipe、Tone Curve Notes、Web Preview Params
6. 可自動寫回 Notion Data Source

## Required Environment Variables

請在 Vercel Project → Settings → Environment Variables 建立：

```env
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4.1-mini

NOTION_API_KEY=secret-or-ntn-your-notion-integration-token
NOTION_DATA_SOURCE_ID=your-notion-data-source-id
NOTION_VERSION=2025-09-03

NOTION_TITLE_PROPERTY=Photo ID
NOTION_ORIGINAL_IMAGE_PROPERTY=Original Image
NOTION_EDITED_IMAGE_PROPERTY=Edited Image
NOTION_AI_STATUS_PROPERTY=AI Status
NOTION_STYLE_CLUSTER_PROPERTY=AI Style Cluster
NOTION_SCENE_PROPERTY=Scene Auto
NOTION_LIGHTING_PROPERTY=Lighting Auto
NOTION_SUBJECT_PROPERTY=Subject Auto
NOTION_TAGS_PROPERTY=Color Change Tags
NOTION_SUMMARY_PROPERTY=AI Analysis Summary
NOTION_CONFIDENCE_PROPERTY=Confidence Score
NOTION_TRAINING_READY_PROPERTY=Training Ready
NOTION_ERROR_PROPERTY=AI Error
NOTION_LIGHTROOM_RECIPE_PROPERTY=Lightroom Recipe
NOTION_LIGHTROOM_BASIC_PARAMS_PROPERTY=Lightroom Basic Params
NOTION_LIGHTROOM_COLOR_PARAMS_PROPERTY=Lightroom Color Params
NOTION_TONE_CURVE_NOTES_PROPERTY=Tone Curve Notes
NOTION_WEB_PREVIEW_PARAMS_PROPERTY=Web Preview Params

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=eric_tone_unsigned
NEXT_PUBLIC_CLOUDINARY_FOLDER=eric-tone-dataset

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_UPLOAD_PRESET=eric_tone_unsigned
CLOUDINARY_FOLDER=eric-tone-dataset
```

## Notion 欄位

請參考 `docs/notion-properties.md`。

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Deploy

1. Push to GitHub
2. Import repo into Vercel
3. Add Environment Variables
4. Redeploy

## 注意

- 這版會在瀏覽器端壓縮圖片，避免大圖直接撞到 Vercel request body limit。
- AI 產生的是 Lightroom 近似建議值，不是 100% 還原 Lightroom RAW engine。
- `Web Preview Params` 是給之後做 Canvas / WebGL 預覽用的 JSON。

## Batch Upload 版本

這版新增「批次上傳」模式，適合一次整理多組前後調色資料。

### 建議檔案整理方式

請準備兩組圖片：Original 與 Edited。檔名要能一一對應。

```text
original/
001.jpg
002.jpg
003.jpg

edited/
001.jpg
002.jpg
003.jpg
```

也支援這種命名：

```text
001_original.jpg
001_edited.jpg
002_original.jpg
002_edited.jpg
```

系統會自動忽略檔名最後的 `original / edited / before / after / 原圖 / 調色後` 等字樣來配對。

### 使用方式

1. 打開網站。
2. 切換到「批次上傳」。
3. 在 Original Images 選擇多張原圖。
4. 在 Edited Images 選擇多張調色後圖片。
5. 確認配對數量與未配對提醒。
6. 按「開始批次分析」。

系統會逐筆處理：

```text
壓縮分析用小圖
→ 上傳 Cloudinary
→ OpenAI 產生 Lightroom Recipe
→ 寫入 Notion
```

### 建議大小

每張建議先控制在 JPG、長邊 2000–3000px、1–3MB。系統會自動壓縮分析用圖片，但原始檔過大仍可能造成瀏覽器處理變慢。
