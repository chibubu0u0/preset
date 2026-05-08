# Eric Tone Notion AI

這是一個可以放到 GitHub 的最小專案：

**Notion 前後照片資料庫 → OpenAI Vision 分析調色差異 → 寫回 Notion 欄位**

你的使用流程會是：

```text
在 Notion 上傳 Original Image + Edited Image
↓
AI Status 設為「未開始」
↓
執行 npm run analyze
↓
AI 自動分析調色差異
↓
把風格群組、場景、光線、色彩變化、摘要寫回 Notion
```

---

## 0. 先準備 Notion 欄位

你的 Notion 資料庫至少需要這 3 個欄位：

| 欄位名稱 | 類型 | 必要 |
|---|---|---|
| Original Image | Files & media | 是 |
| Edited Image | Files & media | 是 |
| AI Status | Status 或 Select | 是 |

建議再新增這些欄位，程式會自動寫回：

| 欄位名稱 | 類型 |
|---|---|
| AI Style Cluster | Select |
| Scene Auto | Select |
| Lighting Auto | Select |
| Subject Auto | Select |
| Color Change Tags | Multi-select |
| AI Analysis Summary | Text / Rich text |
| Confidence Score | Number |
| Training Ready | Checkbox |
| AI Error | Text / Rich text |

`AI Status` 建議選項：

```text
未開始
分析中
已完成
失敗
```

> 注意：欄位名稱請盡量跟上面一模一樣，包含空格與大小寫。

---

## 1. 安裝

```bash
npm install
```

---

## 2. 建立環境變數

複製範例檔：

```bash
cp .env.example .env
```

然後打開 `.env`，填入：

```env
NOTION_API_KEY=你的 Notion integration token
OPENAI_API_KEY=你的 OpenAI API key
```

你的 Database ID 已經先填好了：

```env
NOTION_DATABASE_ID=35adce93-dbef-80fa-896a-f05f4c3a3048
```

---

## 3. 將 Notion Integration 加到資料庫

到你的 Notion 資料庫頁面：

```text
右上角 ⋯
→ Connections
→ Add connection
→ 選你建立的 integration
```

不需要把 Notion 頁面公開，但一定要把 integration 加到資料庫。

---

## 4. 取得 Data Source ID

執行：

```bash
npm run get-data-source
```

你會看到類似：

```text
Data sources:
- AI 自動分類版: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

把那串 ID 填回 `.env`：

```env
NOTION_DATA_SOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## 5. 測試能不能讀到 Notion

```bash
npm run test-notion
```

成功的話，你會看到前幾筆資料的簡短資訊。

---

## 6. 先用 Dry Run 測試

Dry run 不會寫回 Notion，只會印出分析結果：

```bash
npm run analyze:dry
```

---

## 7. 正式分析並寫回 Notion

```bash
npm run analyze
```

程式會只處理 `AI Status = 未開始` 的資料。

---

## 8. 常見錯誤

### object_not_found

通常代表 Notion integration 沒有被加入資料庫。

請到 Notion 資料庫右上角 `⋯ → Connections → Add connection`。

### unauthorized

通常是 `NOTION_API_KEY` 錯了，或 integration 權限不足。

### 缺少 Original Image 或 Edited Image

代表該列沒有上傳其中一張照片。

### AI Status 寫入失敗

請確認 Notion 裡有這些狀態選項：

```text
未開始
分析中
已完成
失敗
```

---

## 9. 安全提醒

請不要把 `.env` 上傳到 GitHub。這個專案已經有 `.gitignore`，會自動忽略 `.env`。
