import { NextResponse } from "next/server";
import { findTonePairPageByKey, normalizePhotoKey, updateLightroomMetadataForPage } from "@/lib/notion";
import { formatParsedLightroom, parseLightroomMetadata } from "@/lib/lightroom-metadata";

export const runtime = "nodejs";
export const maxDuration = 60;

type MetadataBackfillItem = {
  fileName: string;
  key?: string;
  metadataJson: unknown;
};

type MetadataBackfillRequest = {
  items?: MetadataBackfillItem[];
};

function hasUsefulLightroomValues(parsedText: string) {
  return /Vibrance:\s*[-\d]|Saturation:\s*[-\d]|Temperature:\s*[-\d]|Exposure2012:\s*[-\d]|ToneCurvePV2012:/i.test(parsedText);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MetadataBackfillRequest;
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];

    if (!items.length) {
      return NextResponse.json({ ok: false, error: "No metadata items provided." }, { status: 400 });
    }

    const results = [];

    for (const item of items) {
      const key = normalizePhotoKey(item.key || item.fileName || "");

      try {
        if (!key) throw new Error("無法從檔名判斷配對 key");

        const parsed = parseLightroomMetadata(item.metadataJson);
        const parsedText = formatParsedLightroom(parsed);
        const hasRealLightroomParams = parsed.source !== "unknown" && hasUsefulLightroomValues(parsedText);

        if (!hasRealLightroomParams) {
          throw new Error("這個 JSON 沒有讀到可用的 Lightroom / Camera Raw 參數");
        }

        const page = await findTonePairPageByKey(key);
        if (!page?.id) {
          results.push({
            fileName: item.fileName,
            key,
            status: "unmatched",
            message: "找不到對應的 Notion 資料列。請確認 Photo ID 是否包含檔名，例如 ET-...-dscf7930。"
          });
          continue;
        }

        await updateLightroomMetadataForPage(page.id, {
          parsedLightroomValues: parsedText,
          hasRealLightroomParams: true,
          metadataStatus: "已補"
        });

        results.push({
          fileName: item.fileName,
          key,
          status: "updated",
          pageId: page.id,
          rawFileName: parsed.rawFileName || null,
          camera: parsed.camera || null,
          message: "已寫入 Parsed Lightroom Values"
        });
      } catch (error: any) {
        results.push({
          fileName: item.fileName,
          key,
          status: "error",
          message: error?.message || "未知錯誤"
        });
      }
    }

    return NextResponse.json({
      ok: true,
      count: results.length,
      updated: results.filter((r) => r.status === "updated").length,
      unmatched: results.filter((r) => r.status === "unmatched").length,
      errors: results.filter((r) => r.status === "error").length,
      results
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
