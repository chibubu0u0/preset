import { NextResponse } from "next/server";
import { analyzeTonePair } from "@/lib/openai";
import { createTonePairPage } from "@/lib/notion";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeRequest = {
  photoId?: string;
  originalUrl?: string;
  editedUrl?: string;
  writeToNotion?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeRequest;
    const originalUrl = body.originalUrl;
    const editedUrl = body.editedUrl;
    const photoId = body.photoId || `ET-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

    if (!originalUrl || !editedUrl) {
      return NextResponse.json({ error: "Missing originalUrl or editedUrl." }, { status: 400 });
    }

    const analysis = await analyzeTonePair(originalUrl, editedUrl);
    let notionPageId: string | null = null;

    if (body.writeToNotion !== false) {
      const page = await createTonePairPage({ photoId, originalUrl, editedUrl, analysis });
      notionPageId = page.id || null;
    }

    return NextResponse.json({ ok: true, photoId, analysis, notionPageId });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
