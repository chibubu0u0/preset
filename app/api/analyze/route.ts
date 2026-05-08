import { NextResponse } from "next/server";
import { analyzeTonePair } from "../../../lib/analyze";
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

function validateUrl(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`缺少 ${label} URL`);
  }

  try {
    const url = new URL(value);
    if (!url.protocol.startsWith("http")) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error(`${label} URL 格式不正確`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const originalUrl = validateUrl(body.originalUrl, "原圖");
    const editedUrl = validateUrl(body.editedUrl, "調色後");
    const writeToNotion = body.writeToNotion !== false;

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const photoId = typeof body.photoId === "string" && body.photoId.trim()
      ? body.photoId.trim()
      : `ET-${timestamp}`;

    const analysis = await analyzeTonePair(originalUrl, editedUrl);

    let notionPage = null;
    if (writeToNotion) {
      notionPage = await createNotionTonePairPage({
        photoId,
        originalUrl,
        editedUrl,
        analysis
      });
    }

    return json({
      ok: true,
      message: writeToNotion ? "分析完成，已寫入 Notion" : "分析完成，未寫入 Notion",
      data: {
        photoId,
        originalUrl,
        editedUrl,
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
