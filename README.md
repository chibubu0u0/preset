# Eric Tone Web Uploader

這是「方案 C」的第一版網頁原型：

> 上傳原圖 + 調色後圖片 → 圖片存到 Cloudinary → OpenAI Vision 分析前後調色差異 → 寫回 Notion 資料庫

目前這個版本的目標是幫你建立「可訓練的調色資料集」，還不是讓一般使用者上傳單張照片後直接套用你的風格。等資料集累積到一定數量後，再進入調色模型 / LUT / AI 微調階段。

## 功能

- 上傳 Original Image / Edited Image
- 上傳圖片到 Cloudinary
- 使用 OpenAI 進行前後圖調色差異分析
- 自動產生：
  - Style Cluster
  - 場景
  - 光線
  - 主體
  - 色彩變化標籤
  - 調色摘要
  - 信心分數
  - 是否適合進入訓練資料
- 可選擇是否寫入 Notion
- 自動新增 Notion 資料列

## 1. 安裝

```bash
npm install
```

## 2. 建立環境變數

建立 `.env.local`：

```bash
cp .env.example .env.local
```

然後填入：

```env
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4.1-mini

NOTION_API_KEY=secret_your_notion_integration_token
NOTION_DATA_SOURCE_ID=your_notion_data_source_id
NOTION_VERSION=2025-09-03

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
CLOUDINARY_FOLDER=eric-tone-dataset
```

## 3. 設定 Notion 欄位

請參考：

```text
docs/notion-properties.md
```

最重要欄位：

- Photo ID — Title
- Original Image — Files & media
- Edited Image — Files & media
- AI Status — Status
- AI Style Cluster — Select
- Scene Auto — Select
- Lighting Auto — Select
- Subject Auto — Select
- Color Change Tags — Multi-select
- AI Analysis Summary — Text / Rich text
- Confidence Score — Number
- Training Ready — Checkbox

## 4. 設定 Cloudinary

請參考：

```text
docs/cloudinary-setup.md
```

Prototype 可以用 unsigned upload preset。正式產品建議改成 signed upload。

## 5. 本機執行

```bash
npm run dev
```

打開：

```text
http://localhost:3000
```

## 6. 部署到 Vercel

1. 把專案 push 到 GitHub
2. 到 Vercel 新增專案
3. 選擇這個 repo
4. 在 Environment Variables 加上 `.env.example` 裡面的變數
5. Deploy

## 7. 常見錯誤

### Notion API error 403

通常是：

- Notion Integration 沒有被加入資料庫 Connections
- Integration 沒有 Insert Content 權限

### Notion property not found

Notion 欄位名稱與 `.env.local` 不一致。請確認大小寫與空格完全相同。

### Cloudinary upload failed

通常是：

- `CLOUDINARY_CLOUD_NAME` 錯誤
- `CLOUDINARY_UPLOAD_PRESET` 不是 unsigned
- 圖片檔案太大

### OpenAI returned empty analysis

確認：

- OpenAI API key 正確
- `OPENAI_MODEL` 是支援圖片輸入的模型
- Cloudinary 圖片 URL 可以公開讀取

## 下一階段

下一步可以加入：

- 使用者帳號
- 批次上傳
- Style Cluster 自動合併
- 從資料集產生 LUT / Preset
- 真正的「單張照片套用 Eric Tone」功能
