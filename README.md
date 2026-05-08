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
