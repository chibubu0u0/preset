# Notion Properties

請在你的 Notion data source 裡建立以下欄位。欄位名稱要和 Vercel Environment Variables 對應。

| Property | Type |
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
| Lightroom Recipe | Text / Rich text |
| Lightroom Basic Params | Text / Rich text |
| Lightroom Color Params | Text / Rich text |
| Tone Curve Notes | Text / Rich text |
| Web Preview Params | Text / Rich text |
| Confidence Score | Number |
| Training Ready | Checkbox |
| AI Error | Text / Rich text |

## AI Status options

請建立這四種狀態，文字必須一致：

- 未開始
- 進行中
- 已完成
- 失敗

## Vercel Environment Variables

```env
NOTION_LIGHTROOM_RECIPE_PROPERTY=Lightroom Recipe
NOTION_LIGHTROOM_BASIC_PARAMS_PROPERTY=Lightroom Basic Params
NOTION_LIGHTROOM_COLOR_PARAMS_PROPERTY=Lightroom Color Params
NOTION_TONE_CURVE_NOTES_PROPERTY=Tone Curve Notes
NOTION_WEB_PREVIEW_PARAMS_PROPERTY=Web Preview Params
```
