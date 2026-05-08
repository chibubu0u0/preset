import { NextResponse } from "next/server";
import { analyzeTonePair } from "../../../lib/analyze";
import { uploadToCloudinary } from "../../../lib/cloudinary";
import { optionalNumberEnv } from "../../../lib/env";
import { createNotionTonePairPage } from "../../../lib/notion";

export const runtime = "nodejs";
export const maxDuration = 60;

type ApiResult = {
  ok: boolean;
  message?: string;
  data?: unknown;
  error?: string;
};

function json(payload: ApiResult, status = 200) {
  return NextResponse.json(payload, { status });
}

function validateImageFile(file: File | null, label: string) {
  if (!file) throw new Error(`缺少 ${label} 圖片`);
  if (!file.type.startsWith("image/")) throw new Error(`${label} 必須是圖片檔`);

  const maxUploadMb = optionalNumberEnv("MAX_UPLOAD_MB", 8);
  const maxBytes = maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`${label} 檔案太大，目前限制 ${maxUploadMb}MB`);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const original = formData.get("original") as File | null;
    const edited = formData.get("edited") as File | null;
    const writeToNotion = formData.get("writeToNotion") !== "false";

    validateImageFile(original, "原圖");
    validateImageFile(edited, "調色後");

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const photoId = `ET-${timestamp}`;

    const [originalUpload, editedUpload] = await Promise.all([
      uploadToCloudinary(original!, "original"),
      uploadToCloudinary(edited!, "edited")
    ]);

    const analysis = await analyzeTonePair(originalUpload.secure_url, editedUpload.secure_url);

    let notionPage = null;
    if (writeToNotion) {
      notionPage = await createNotionTonePairPage({
        photoId,
        originalUrl: originalUpload.secure_url,
        editedUrl: editedUpload.secure_url,
        analysis
      });
    }

    return json({
      ok: true,
      message: writeToNotion ? "分析完成，已寫入 Notion" : "分析完成，未寫入 Notion",
      data: {
        photoId,
        originalUrl: originalUpload.secure_url,
        editedUrl: editedUpload.secure_url,
        analysis,
        notionPageId: notionPage?.id || null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(error);
    return json({ ok: false, error: message }, 500);
  }
}
