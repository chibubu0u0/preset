# Eric Tone Dataset Builder — Style Family Edition

這是一個 Next.js / Vercel 原型，用來：

1. 上傳原圖 + 調色後圖片
2. 直接從瀏覽器上傳到 Cloudinary
3. 用 OpenAI Vision 分析調色差異
4. 產生 Lightroom Recipe / Web Preview Params
5. 寫回 Notion
6. 針對既有資料執行「AI 整理 Style Family」

---

## 新增功能

這版新增一個後台頁籤：

```text
AI 整理 Style Family
```

它會讀取 Notion 中 `Style Family` 空白的資料，根據既有欄位：

- AI Style Cluster
- AI Analysis Summary
- Color Change Tags
- Lightroom Recipe
- Lightroom Basic Params
- Lightroom Color Params
- Tone Curve Notes

讓 AI 從固定分類中選一個正式分類，並寫回 `Style Family`。

---

## Notion 欄位需求

請確認 Notion database / data source 至少有這些欄位：

| 欄位名稱 | 類型 |
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
| AI Raw Style Name | Text / Rich text |
| Style Family | Select |

`Style Family` 建議 Select 選項：

```text
冷調自然
冷調城市
低光夜景
暖調室內
柔霧暖光
底片褪色
清透日常
黑白顆粒
待整理
```

`AI Status` 建議 Status 選項：

```text
未開始
進行中
已完成
失敗
```

---

## Vercel Environment Variables

把 `.env.example` 裡的變數填到：

```text
Vercel → Project → Settings → Environment Variables
```

必填：

```env
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_DETAIL=low

NOTION_API_KEY=ntn_xxxxx
NOTION_DATA_SOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_VERSION=2025-09-03

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=eric_tone_unsigned
NEXT_PUBLIC_CLOUDINARY_FOLDER=eric-tone-dataset
```

新增的 Style Family 相關變數：

```env
NOTION_RAW_STYLE_NAME_PROPERTY=AI Raw Style Name
NOTION_STYLE_FAMILY_PROPERTY=Style Family
STYLE_FAMILY_OPTIONS=冷調自然,冷調城市,低光夜景,暖調室內,柔霧暖光,底片褪色,清透日常,黑白顆粒,待整理
```

---

## 部署

```bash
npm install
npm run build
```

部署到 Vercel 時，如果 install 很久，可以在 Vercel Build Settings 把 Install Command 改成：

```bash
npm install --no-audit --no-fund
```

---

## 使用流程

### 單筆上傳

1. 選原圖
2. 選調色後圖片
3. 按開始分析
4. 寫回 Notion

### 批次上傳

建議檔名一一對應：

```text
original/001.jpg
edited/001.jpg

original/002.jpg
edited/002.jpg
```

### AI 整理 Style Family

1. 確認 Notion 有 `Style Family` 欄位
2. 確認 Select 選項已建立
3. 到頁籤「AI 整理 Style Family」
4. 選一次處理 10 / 25 / 50 筆
5. 按開始整理未分類資料

建議一次先跑 25 筆；跑完再按一次，直到沒有空白資料。
