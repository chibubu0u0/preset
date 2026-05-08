# Eric Tone Public + Admin

這版包含兩個入口：

- `/`：使用者前台。使用者上傳一張照片，選擇 Style Family，產生 Lightroom 建議數值與近似預覽。
- `/admin`：資料集後台。保留單筆 / 批次上傳、Lightroom Recipe 分析、Style Family 二次分類、未分類數量顯示。

## 部署方式

1. 解壓縮 zip。
2. 刪掉 GitHub repo 裡舊檔案。
3. 上傳這版所有檔案。
4. 不要上傳 `.env.local`、`.env`、`node_modules`、`.next`、zip 檔。
5. 到 Vercel 重新部署。

## Vercel Environment Variables

保留原本的：

```env
OPENAI_API_KEY=你的_OpenAI_API_Key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_DETAIL=low

NOTION_API_KEY=你的_Notion_secret
NOTION_DATA_SOURCE_ID=你的_Notion_Data_Source_ID
NOTION_VERSION=2025-09-03

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=你的_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=eric_tone_unsigned
NEXT_PUBLIC_CLOUDINARY_FOLDER=eric-tone-dataset

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

NOTION_RAW_STYLE_NAME_PROPERTY=AI Raw Style Name
NOTION_STYLE_FAMILY_PROPERTY=Style Family
STYLE_FAMILY_OPTIONS=冷調自然,冷調城市,低光夜景,暖調室內,柔霧暖光,底片褪色,清透日常,黑白顆粒,待整理
```

## Notion 欄位需求

同一個資料庫至少需要：

- Photo ID：Title
- Original Image：Files & media
- Edited Image：Files & media
- AI Status：Status，選項包含 未開始 / 進行中 / 已完成 / 失敗
- AI Style Cluster：Select
- Scene Auto：Select
- Lighting Auto：Select
- Subject Auto：Select
- Color Change Tags：Multi-select
- AI Analysis Summary：Text / Rich text
- Lightroom Recipe：Text / Rich text
- Lightroom Basic Params：Text / Rich text
- Lightroom Color Params：Text / Rich text
- Tone Curve Notes：Text / Rich text
- Web Preview Params：Text / Rich text
- Confidence Score：Number
- Training Ready：Checkbox
- AI Error：Text / Rich text
- AI Raw Style Name：Text / Rich text
- Style Family：Select

Style Family 選項建議：

- 冷調自然
- 冷調城市
- 低光夜景
- 暖調室內
- 柔霧暖光
- 底片褪色
- 清透日常
- 黑白顆粒
- 待整理

## 使用者前台邏輯

前台不會重新訓練模型，而是：

1. 從 Notion 讀取目前 Style Family 的數量。
2. 使用者選擇風格並上傳照片。
3. 系統讀取該風格下的代表資料文字。
4. OpenAI 根據照片 + 代表資料產生 Lightroom 建議值。
5. 前台顯示建議文字與近似預覽。

## 注意

- 前台預覽只是用網頁參數近似，不能 100% 等同 Lightroom。
- 建議繼續使用小圖做分析，上傳前會自動壓縮。
- `/admin` 目前是原型後台，若要公開網站，建議後續再加真正的登入或 Vercel Password Protection。

## Public download preview

The public page now includes a **下載調色後預覽 JPG** button. After a user uploads a photo and generates a Lightroom recipe, the browser creates a local JPG download based on the same conservative web preview parameters. This file is an approximate preview, not a full Lightroom render.

Optional environment variable:

```env
NEXT_PUBLIC_DOWNLOAD_MAX_EDGE=2400
```

This limits the longest edge of the downloaded preview JPG.
