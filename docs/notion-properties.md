# Notion 欄位設定

請在你的 Notion Data Source 建立以下欄位。欄位名稱需要和 `.env.example` 裡面一致，或你也可以在 `.env.local` 改成自己的欄位名稱。

| 欄位名稱 | Notion 類型 | 說明 |
|---|---|---|
| Photo ID | Title | 每筆資料的編號，例如 `ET-20260508184312` |
| Original Image | Files & media | 原圖，網站會寫入 Cloudinary 外部圖片 URL |
| Edited Image | Files & media | 調色後圖片，網站會寫入 Cloudinary 外部圖片 URL |
| AI Status | Status | 建議選項：未開始、分析中、已完成、失敗 |
| AI Style Cluster | Select | AI 自動判斷的風格群組 |
| Scene Auto | Select | AI 自動判斷場景 |
| Lighting Auto | Select | AI 自動判斷光線 |
| Subject Auto | Select | AI 自動判斷主體 |
| Color Change Tags | Multi-select | AI 自動產生的色彩變化標籤 |
| AI Analysis Summary | Text / Rich text | AI 用繁中寫的調色差異摘要 |
| Confidence Score | Number | 信心分數 0–100 |
| Training Ready | Checkbox | 是否適合進入未來訓練資料集 |
| AI Error | Text / Rich text | 保留給錯誤訊息，目前 API 主要回傳在網頁上 |

## 注意

- Notion Integration 必須被加入這個資料庫的 Connections。
- Integration 需要 Insert Content 權限，因為這個網站會新增 Notion page。
- 如果你使用新的 Notion API 版本，請使用 Data Source ID，而不是只有 Database ID。
