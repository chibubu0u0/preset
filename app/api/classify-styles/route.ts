import { NextResponse } from "next/server";
import { classifyStyleFamily } from "@/lib/openai";
import { countUnclassifiedPages, pageToClassificationInput, queryUnclassifiedPages, updateStyleFamily } from "@/lib/notion";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClassifyRequest = {
  limit?: number;
};

export async function GET() {
  try {
    const remaining = await countUnclassifiedPages();
    return NextResponse.json({ ok: true, remaining });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ClassifyRequest;
    const requestedLimit = typeof body.limit === "number" ? body.limit : 5;
    const limit = Math.min(Math.max(requestedLimit, 1), 15);
    const pages = await queryUnclassifiedPages(limit);

    const results: Array<{
      pageId: string;
      ok: boolean;
      styleFamily?: string;
      rawStyleName?: string;
      confidenceScore?: number;
      error?: string;
    }> = [];

    for (const page of pages) {
      try {
        const input = pageToClassificationInput(page);
        const classification = await classifyStyleFamily(input);
        await updateStyleFamily(page.id, classification);
        results.push({
          pageId: page.id,
          ok: true,
          styleFamily: classification.style_family,
          rawStyleName: classification.raw_style_name,
          confidenceScore: classification.confidence_score
        });
      } catch (error: any) {
        results.push({ pageId: page.id, ok: false, error: error?.message || "Unknown error" });
      }
    }

    const remaining = await countUnclassifiedPages();
    return NextResponse.json({ ok: true, count: results.length, remaining, results });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
