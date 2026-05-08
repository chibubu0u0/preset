# Cloudinary 設定

這個原型用 Cloudinary 當圖片空間，原因是 Notion 的外部圖片欄位需要一個可公開讀取的圖片 URL，而 Cloudinary 很適合做圖片上傳測試。

## 需要的資訊

在 `.env.local` 或 Vercel 環境變數填：

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=你的_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=你的_unsigned_upload_preset
NEXT_PUBLIC_CLOUDINARY_FOLDER=eric-tone-dataset
```

## 建立 Unsigned Upload Preset

1. 登入 Cloudinary
2. 到 Settings / Upload
3. 新增 Upload preset
4. Signing Mode 選 Unsigned
5. 設定 folder 或讓程式用 `NEXT_PUBLIC_CLOUDINARY_FOLDER`
6. 複製 preset 名稱到 `.env.local`

## 原型安全提醒

Unsigned preset 適合 prototype。正式產品建議改成 signed upload，避免別人濫用你的上傳額度。
