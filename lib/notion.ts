import { optionalEnv, requireEnv } from "./env";
import { asPrettyJson, normalizeTags, sanitizeSelectName, truncate } from "./text";
import type { StyleClassification, ToneAnalysis } from "./openai";

const NOTION_BASE = "https://api.notion.com/v1";

export function propNames() {
  return {
    title: optionalEnv("NOTION_TITLE_PROPERTY", "Photo ID"),
    original: optionalEnv("NOTION_ORIGINAL_IMAGE_PROPERTY", "Original Image"),
    edited: optionalEnv("NOTION_EDITED_IMAGE_PROPERTY", "Edited Image"),
    status: optionalEnv("NOTION_AI_STATUS_PROPERTY", "AI Status"),
    styleCluster: optionalEnv("NOTION_STYLE_CLUSTER_PROPERTY", "AI Style Cluster"),
    scene: optionalEnv("NOTION_SCENE_PROPERTY", "Scene Auto"),
    lighting: optionalEnv("NOTION_LIGHTING_PROPERTY", "Lighting Auto"),
    subject: optionalEnv("NOTION_SUBJECT_PROPERTY", "Subject Auto"),
    tags: optionalEnv("NOTION_TAGS_PROPERTY", "Color Change Tags"),
    summary: optionalEnv("NOTION_SUMMARY_PROPERTY", "AI Analysis Summary"),
    confidence: optionalEnv("NOTION_CONFIDENCE_PROPERTY", "Confidence Score"),
    trainingReady: optionalEnv("NOTION_TRAINING_READY_PROPERTY", "Training Ready"),
    error: optionalEnv("NOTION_ERROR_PROPERTY", "AI Error"),
    lightroomRecipe: optionalEnv("NOTION_LIGHTROOM_RECIPE_PROPERTY", "Lightroom Recipe"),
    lightroomBasic: optionalEnv("NOTION_LIGHTROOM_BASIC_PARAMS_PROPERTY", "Lightroom Basic Params"),
    lightroomColor: optionalEnv("NOTION_LIGHTROOM_COLOR_PARAMS_PROPERTY", "Lightroom Color Params"),
    toneCurve: optionalEnv("NOTION_TONE_CURVE_NOTES_PROPERTY", "Tone Curve Notes"),
    webPreview: optionalEnv("NOTION_WEB_PREVIEW_PARAMS_PROPERTY", "Web Preview Params"),
    rawStyleName: optionalEnv("NOTION_RAW_STYLE_NAME_PROPERTY", "AI Raw Style Name"),
    styleFamily: optionalEnv("NOTION_STYLE_FAMILY_PROPERTY", "Style Family")
  };
}

async function notionRequest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv("NOTION_API_KEY")}`,
      "Notion-Version": optionalEnv("NOTION_VERSION", "2025-09-03"),
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Notion API error: ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

function richText(content: string) {
  return { rich_text: [{ text: { content: truncate(content) } }] };
}

function titleText(content: string) {
  return { title: [{ text: { content: truncate(content, 200) } }] };
}

function select(name: string) {
  return { select: { name: sanitizeSelectName(name) } };
}

function status(name: string) {
  return { status: { name: sanitizeSelectName(name) } };
}

function multiSelect(tags: string[] | string | undefined) {
  return { multi_select: normalizeTags(tags).map((name) => ({ name })) };
}

function externalFile(name: string, url: string) {
  return {
    files: [
      {
        name,
        type: "external",
        external: { url }
      }
    ]
  };
}

export async function createTonePairPage(input: {
  photoId: string;
  originalUrl: string;
  editedUrl: string;
  analysis: ToneAnalysis;
}) {
  const p = propNames();
  const a = input.analysis;

  const properties: Record<string, any> = {
    [p.title]: titleText(input.photoId),
    [p.original]: externalFile(`${input.photoId}_original`, input.originalUrl),
    [p.edited]: externalFile(`${input.photoId}_edited`, input.editedUrl),
    [p.status]: status("已完成"),
    [p.styleCluster]: select(a.style_cluster || a.raw_style_name),
    [p.scene]: select(a.scene),
    [p.lighting]: select(a.lighting),
    [p.subject]: select(a.subject),
    [p.tags]: multiSelect(a.color_change_tags),
    [p.summary]: richText(a.summary),
    [p.confidence]: { number: Number(a.confidence_score || 0) },
    [p.trainingReady]: { checkbox: Boolean(a.training_ready) },
    [p.lightroomRecipe]: richText(a.lightroom_recipe),
    [p.lightroomBasic]: richText(a.lightroom_basic_params),
    [p.lightroomColor]: richText(a.lightroom_color_params),
    [p.toneCurve]: richText(a.tone_curve_notes),
    [p.webPreview]: richText(asPrettyJson(a.web_preview_params)),
    [p.rawStyleName]: richText(a.raw_style_name || a.style_cluster),
    [p.styleFamily]: select(a.style_family || "待整理")
  };

  return notionRequest("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { data_source_id: requireEnv("NOTION_DATA_SOURCE_ID") },
      properties
    })
  });
}

function getRichText(page: any, prop: string): string {
  const value = page.properties?.[prop];
  if (!value) return "";
  if (Array.isArray(value.rich_text)) return value.rich_text.map((t: any) => t.plain_text || t.text?.content || "").join("");
  if (Array.isArray(value.title)) return value.title.map((t: any) => t.plain_text || t.text?.content || "").join("");
  return "";
}

function getSelect(page: any, prop: string): string {
  const value = page.properties?.[prop];
  return value?.select?.name || value?.status?.name || "";
}

function getMultiSelect(page: any, prop: string): string[] {
  const value = page.properties?.[prop];
  return Array.isArray(value?.multi_select) ? value.multi_select.map((x: any) => x.name).filter(Boolean) : [];
}

export function pageToClassificationInput(page: any) {
  const p = propNames();
  return {
    aiStyleCluster: getSelect(page, p.styleCluster),
    summary: getRichText(page, p.summary),
    tags: getMultiSelect(page, p.tags),
    lightroomRecipe: getRichText(page, p.lightroomRecipe),
    basicParams: getRichText(page, p.lightroomBasic),
    colorParams: getRichText(page, p.lightroomColor),
    toneCurveNotes: getRichText(page, p.toneCurve)
  };
}

export async function queryUnclassifiedPages(limit = 25) {
  const p = propNames();
  const dataSourceId = requireEnv("NOTION_DATA_SOURCE_ID");

  // Query only pages where Style Family is empty. If the property is not filterable due to schema mismatch,
  // the caller will see a clear Notion API error and can check the property type/name.
  const body = {
    page_size: Math.min(Math.max(limit, 1), 100),
    filter: {
      property: p.styleFamily,
      select: { is_empty: true }
    }
  };

  const data = await notionRequest(`/data_sources/${dataSourceId}/query`, {
    method: "POST",
    body: JSON.stringify(body)
  });

  return data.results || [];
}

export async function updateStyleFamily(pageId: string, classification: StyleClassification) {
  const p = propNames();
  const properties: Record<string, any> = {
    [p.styleFamily]: select(classification.style_family),
    [p.rawStyleName]: richText(classification.raw_style_name)
  };

  // Append rationale into AI Error only when it is useful for debugging? Keep existing AI Error clean.
  return notionRequest(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties })
  });
}
