import { NextResponse } from "next/server";
import { listStyleFamilyCounts } from "@/lib/notion";
import { getStyleFamilies } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const counts = await listStyleFamilyCounts();
    const countMap = new Map(counts.map((item) => [item.name, item.count]));
    const styles = getStyleFamilies()
      .filter((name) => name !== "待整理")
      .map((name) => ({ name, count: countMap.get(name) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hant"));

    return NextResponse.json({ ok: true, styles });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unknown error", styles: [] }, { status: 500 });
  }
}
