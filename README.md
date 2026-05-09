# Chibubu Global Style Assistant

這版把首頁使用者工具改成「Chibubu 整體調色語言」模式：

- 不再要求使用者選 Style Family
- 會讀取 Notion 裡已整理的整體資料集
- 依照使用者照片產生保守的 Lightroom 建議數值
- 下載圖會使用較安全的 Canvas 調色參數，避免整張過暗、膚色髒掉或出現海報化斷層
- `/admin` 保留資料集後台、批次上傳與 Style Family 整理功能

## 部署注意

請不要上傳：

- `.env`
- `.env.local`
- `node_modules`
- `.next`
- zip 檔

Vercel 環境變數沿用前一版即可。可選調整：

```env
NEXT_PUBLIC_PREVIEW_STRENGTH=0.35
NEXT_PUBLIC_DOWNLOAD_MAX_EDGE=3000
NEXT_PUBLIC_ANALYSIS_MAX_EDGE=1600
NEXT_PUBLIC_ANALYSIS_JPEG_QUALITY=0.76
```

## 使用邏輯

首頁 `/`：使用者上傳單張照片，系統用整體資料集產生 Lightroom 建議與精緻下載圖。

後台 `/admin`：管理你的前後對照資料集、批次分析、AI 整理 Style Family。

## Lightroom-like visual recipe panel

This version adds a graphical Lightroom-inspired Develop panel for the generated recipe. It visualizes the AI-generated `web_preview_params` as sliders for Basic, Color, and Effects. It does not use Adobe branding and is not an official Adobe UI.

## Auto AI Strength 版

這版首頁不提供「預覽 / 下載強度」手動拉桿。AI 會在 `web_preview_params.preview_strength` 中自動判斷調色強度，前端用這個數值產生預覽和下載 JPG。

建議保留：

```env
NEXT_PUBLIC_DOWNLOAD_MAX_EDGE=3000
NEXT_PUBLIC_ANALYSIS_MAX_EDGE=1600
NEXT_PUBLIC_ANALYSIS_JPEG_QUALITY=0.76
```

`NEXT_PUBLIC_PREVIEW_STRENGTH` 只會當作 AI 未回傳 `preview_strength` 時的備用值。

## Metadata JSON / XMP JSON 支援

新版 `/admin` 支援在單筆與批次上傳時，額外選擇 `metadata.json` 或由工具轉出的 XMP JSON。檔名會用同一個 key 自動配對，例如：

```text
original/R0003481.jpg
edited/R0003481.jpg
metadata/R0003481.metadata.json
```

如果 metadata 內含 Lightroom / Camera Raw 的 `crs` 資料，系統會優先把它視為真實調整參數，而不是只靠圖片前後差異推測 Lightroom 數值。

### 建議新增 Notion 欄位

若要把解析後的真實 Lightroom 參數寫回 Notion，請新增：

| 欄位名稱 | 類型 |
|---|---|
| Parsed Lightroom Values | Text / Rich text |
| Has Real Lightroom Params | Checkbox |

然後在 Vercel Environment Variables 加上：

```env
NOTION_PARSED_LIGHTROOM_VALUES_PROPERTY=Parsed Lightroom Values
NOTION_HAS_REAL_LIGHTROOM_PARAMS_PROPERTY=Has Real Lightroom Params
```

如果沒有設定這兩個環境變數，系統仍然會使用 metadata 幫助 AI 分析，但不會額外寫入這兩個欄位。
