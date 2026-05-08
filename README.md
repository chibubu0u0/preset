# Eric Tone Web Uploader — Clean Batch Version

這是乾淨版的 Next.js 專案，適合直接整包上傳到 GitHub 再部署到 Vercel。

它包含：

- 單筆上傳：Original Image + Edited Image
- 批次上傳：多張 Original + 多張 Edited，依檔名自動配對
- 前端壓縮圖片：避免大圖撞到 Vercel Function payload limit
- 瀏覽器直接上傳 Cloudinary
- 後端只接收 Cloudinary URL
- OpenAI Vision 分析前後調色差異
- 產生 Lightroom Recipe / Basic Params / Color Params / Tone Curve Notes / Web Preview Params
- 寫入 Notion Data Source

---

## GitHub 上傳注意

請只上傳這個資料夾裡的內容，不要上傳：

```txt
node_modules
.next
.env
.env.local
*.zip
```

`.gitignore` 已經有設定好。

---

## Vercel Environment Variables

請在 Vercel 專案：

```txt
Settings → Environment Variables
```

加入：

```env
OPENAI_API_KEY=你的_OpenAI_API_Key
OPENAI_MODEL=gpt-4.1-mini

NOTION_API_KEY=你的_Notion_Integration_Secret
NOTION_DATA_SOURCE_ID=你的_Notion_Data_Source_ID
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

CLOUDINARY_CLOUD_NAME=你的_cloud_name
CLOUDINARY_UPLOAD_PRESET=eric_tone_unsigned
CLOUDINARY_FOLDER=eric-tone-dataset
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=你的_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=eric_tone_unsigned
NEXT_PUBLIC_CLOUDINARY_FOLDER=eric-tone-dataset

NEXT_PUBLIC_MAX_IMAGE_LONG_EDGE=2500
NEXT_PUBLIC_IMAGE_QUALITY=0.82
```

> `NEXT_PUBLIC_` 開頭的 Cloudinary 變數會被前端使用。Cloud Name 和 unsigned preset 不是 secret。不要把 API Secret 放到 NEXT_PUBLIC。

---

## Notion 欄位需求

資料庫需要有這些欄位，名稱建議完全一致：

| 欄位 | 類型 |
|---|---|
| Photo ID | Title |
| Original Image | Files & media |
| Edited Image | Files & media |
| AI Status | Status |
| AI Style Cluster | Select |
| Scene Auto | Select |
| Lighting Auto | Select |
| Subject Auto | Select |
| Color Change Tags | Multi-select |
| AI Analysis Summary | Text / Rich text |
| Confidence Score | Number |
| Training Ready | Checkbox |
| AI Error | Text / Rich text |
| Lightroom Recipe | Text / Rich text |
| Lightroom Basic Params | Text / Rich text |
| Lightroom Color Params | Text / Rich text |
| Tone Curve Notes | Text / Rich text |
| Web Preview Params | Text / Rich text |

AI Status 至少需要有：

```txt
未開始
進行中
已完成
失敗
```

目前網站成功寫入時會使用 `已完成`。

---

## 批次上傳命名方式

推薦兩個資料夾：

```txt
original/
001.jpg
002.jpg
003.jpg

edited/
001.jpg
002.jpg
003.jpg
```

網頁上切到「批次上傳」，分別選擇多張 original 和 edited 圖片即可。系統會依照檔名自動配對。

也支援：

```txt
001_original.jpg
001_edited.jpg
002_original.jpg
002_edited.jpg
```

---

## 建議圖片規格

目前這個工具目標是建立調色資料集，不是保存原始大圖。建議：

```txt
JPG
長邊 2000–3000px
每張 1–3MB
sRGB
```

程式會在瀏覽器端自動壓縮成分析用圖片，再上傳 Cloudinary。

---

## 本機開發

```bash
npm install
npm run dev
```

---

## 抓 Notion Data Source ID

建立 `.env.local`：

```env
NOTION_API_KEY=你的_Notion_Integration_Secret
NOTION_DATABASE_ID=你的_Notion_Database_ID
NOTION_VERSION=2025-09-03
```

執行：

```bash
npm run get-data-source
```

---

## Vercel 部署如果卡在 Installing dependencies

請檢查 GitHub repo 是否誤上傳：

```txt
node_modules
.next
*.zip
.env
.env.local
```

如果有，刪掉後重新 commit，並在 Vercel 選擇 Redeploy without Build Cache。
