import OpenAI from "openai";
import { optionalEnv, requiredEnv } from "./env";

export type WebPreviewParams = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  clarity: number;
  fade: number;
  grain: number;
  vignette: number;
};

export type TonePairAnalysis = {
  style_cluster: string;
  style_name_draft: string;
  scene: string;
  lighting: string;
  subject: string;
  color_change_tags: string[];
  summary: string;
  lightroom_recipe: string;
  lightroom_basic_params: string;
  lightroom_color_params: string;
  tone_curve_notes: string;
  web_preview_params: WebPreviewParams;
  training_ready: boolean;
  confidence_score: number;
};

const webPreviewParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "exposure",
    "contrast",
    "highlights",
    "shadows",
    "whites",
    "blacks",
    "temperature",
    "tint",
    "vibrance",
    "saturation",
    "clarity",
    "fade",
    "grain",
    "vignette"
  ],
  properties: {
    exposure: { type: "number", description: "Approximate Lightroom Exposure adjustment, usually -2.0 to +2.0." },
    contrast: { type: "number", description: "Approximate Lightroom Contrast adjustment, -100 to +100." },
    highlights: { type: "number", description: "Approximate Lightroom Highlights adjustment, -100 to +100." },
    shadows: { type: "number", description: "Approximate Lightroom Shadows adjustment, -100 to +100." },
    whites: { type: "number", description: "Approximate Lightroom Whites adjustment, -100 to +100." },
    blacks: { type: "number", description: "Approximate Lightroom Blacks adjustment, -100 to +100." },
    temperature: { type: "number", description: "Approximate Lightroom Temperature delta in Kelvin-like relative units, e.g. -800 to +800." },
    tint: { type: "number", description: "Approximate Lightroom Tint adjustment, -50 to +50." },
    vibrance: { type: "number", description: "Approximate Lightroom Vibrance adjustment, -100 to +100." },
    saturation: { type: "number", description: "Approximate Lightroom Saturation adjustment, -100 to +100." },
    clarity: { type: "number", description: "Approximate Lightroom Clarity adjustment, -100 to +100." },
    fade: { type: "number", description: "Custom web preview fade / lifted black strength, 0 to 100." },
    grain: { type: "number", description: "Approximate grain strength, 0 to 100." },
    vignette: { type: "number", description: "Approximate vignette adjustment, -100 to +100." }
  }
} as const;

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "style_cluster",
    "style_name_draft",
    "scene",
    "lighting",
    "subject",
    "color_change_tags",
    "summary",
    "lightroom_recipe",
    "lightroom_basic_params",
    "lightroom_color_params",
    "tone_curve_notes",
    "web_preview_params",
    "training_ready",
    "confidence_score"
  ],
  properties: {
    style_cluster: {
      type: "string",
      description: "Stable cluster label, e.g. Style Cluster 01, Warm Soft Indoor, Cool Street Fade."
    },
    style_name_draft: {
      type: "string",
      description: "A human-friendly draft name for this color style."
    },
    scene: {
      type: "string",
      description: "Cafe, Street, Indoor, Portrait, Landscape, Night, Food, Product, etc."
    },
    lighting: {
      type: "string",
      description: "Natural Light, Warm Indoor, Cloudy, Backlight, Low Light, Mixed Light, etc."
    },
    subject: {
      type: "string",
      description: "Person, Object, Interior, Food, Building, Street Scene, etc."
    },
    color_change_tags: {
      type: "array",
      items: { type: "string" },
      description: "Color/editing tags such as Warm Highlight, Cool Shadow, Low Saturation, Lifted Black."
    },
    summary: {
      type: "string",
      description: "Traditional Chinese explanation of the color grading changes from original to edited image."
    },
    lightroom_recipe: {
      type: "string",
      description: "Traditional Chinese Lightroom recipe. Use readable sections and approximate values."
    },
    lightroom_basic_params: {
      type: "string",
      description: "Traditional Chinese Lightroom Basic panel suggestions: exposure, contrast, highlights, shadows, whites, blacks, texture/clarity/dehaze if relevant."
    },
    lightroom_color_params: {
      type: "string",
      description: "Traditional Chinese Lightroom color suggestions: white balance, tint, vibrance/saturation, HSL, color grading."
    },
    tone_curve_notes: {
      type: "string",
      description: "Traditional Chinese tone curve description, e.g. lifted blacks, compressed highlights, soft midtones."
    },
    web_preview_params: webPreviewParamsSchema,
    training_ready: {
      type: "boolean",
      description: "Whether this pair is likely useful for later training / clustering."
    },
    confidence_score: {
      type: "number",
      description: "0 to 100 confidence score."
    }
  }
} as const;

function clamp(value: unknown, min: number, max: number, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeWebPreviewParams(params: Partial<WebPreviewParams> | undefined): WebPreviewParams {
  return {
    exposure: clamp(params?.exposure, -2, 2),
    contrast: clamp(params?.contrast, -100, 100),
    highlights: clamp(params?.highlights, -100, 100),
    shadows: clamp(params?.shadows, -100, 100),
    whites: clamp(params?.whites, -100, 100),
    blacks: clamp(params?.blacks, -100, 100),
    temperature: clamp(params?.temperature, -1200, 1200),
    tint: clamp(params?.tint, -80, 80),
    vibrance: clamp(params?.vibrance, -100, 100),
    saturation: clamp(params?.saturation, -100, 100),
    clarity: clamp(params?.clarity, -100, 100),
    fade: clamp(params?.fade, 0, 100),
    grain: clamp(params?.grain, 0, 100),
    vignette: clamp(params?.vignette, -100, 100)
  };
}

export async function analyzeTonePair(originalUrl: string, editedUrl: string): Promise<TonePairAnalysis> {
  const openai = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
  const model = optionalEnv("OPENAI_MODEL", "gpt-4.1-mini");

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `你是一位攝影調色分析助手，也懂 Lightroom 調色工作流。請比較兩張照片：第一張是原圖，第二張是攝影師調色後的版本。\n\n任務：\n1. 分析「原圖 → 調色後」發生了哪些影像與色彩變化。\n2. 自動判斷場景、光線、主體與色彩變化標籤。\n3. 產生一份「可給攝影師參考」的 Lightroom 建議數值，但請明確理解這只是近似值，不是完全還原 Lightroom 的 RAW 演算法。\n4. 產生 web_preview_params，讓網頁可以用 Canvas/WebGL 做近似預覽。數值要保守，避免過度調整。\n5. 不要評價照片好壞，不要重新創作圖片，只分析調色邏輯。\n6. summary、Lightroom 建議、曲線說明都用繁體中文。\n7. 請用穩定、可累積資料集的方式命名 style_cluster。若無法確定就用 Style Cluster 01 / 02 這種保守命名。`
          },
          { type: "input_image", image_url: originalUrl, detail: "high" },
          { type: "input_image", image_url: editedUrl, detail: "high" }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "tone_pair_analysis_with_lightroom_recipe",
        strict: true,
        schema
      }
    }
  });

  const output = response.output_text;
  if (!output) {
    throw new Error("OpenAI returned an empty analysis response.");
  }

  const parsed = JSON.parse(output) as TonePairAnalysis;
  return {
    ...parsed,
    color_change_tags: Array.isArray(parsed.color_change_tags) ? parsed.color_change_tags.slice(0, 12) : [],
    web_preview_params: normalizeWebPreviewParams(parsed.web_preview_params),
    confidence_score: Math.max(0, Math.min(100, Number(parsed.confidence_score) || 0))
  };
}
