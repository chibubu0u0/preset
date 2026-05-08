import { optionalEnv, requireEnv } from "./env";

export type ToneAnalysis = {
  style_cluster: string;
  raw_style_name: string;
  style_family: string;
  scene: string;
  lighting: string;
  subject: string;
  color_change_tags: string[];
  summary: string;
  lightroom_recipe: string;
  lightroom_basic_params: string;
  lightroom_color_params: string;
  tone_curve_notes: string;
  web_preview_params: Record<string, number | string | boolean>;
  training_ready: boolean;
  confidence_score: number;
};

export type StyleClassification = {
  style_family: string;
  raw_style_name: string;
  rationale: string;
  confidence_score: number;
};

const styleFamilyOptionsDefault = [
  "冷調自然",
  "冷調城市",
  "低光夜景",
  "暖調室內",
  "柔霧暖光",
  "底片褪色",
  "清透日常",
  "黑白顆粒",
  "待整理"
];

export function getStyleFamilies(): string[] {
  const env = process.env.STYLE_FAMILY_OPTIONS;
  if (!env) return styleFamilyOptionsDefault;
  const list = env.split(/[，,]/g).map((x) => x.trim()).filter(Boolean);
  return list.length ? list : styleFamilyOptionsDefault;
}

function extractOutputText(data: any): string {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
      if (content.type === "text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n");
}

async function responsesCreate(body: any): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`OpenAI API returned non-JSON response: ${text.slice(0, 300)}`);
  }
}

export async function analyzeTonePair(originalUrl: string, editedUrl: string): Promise<ToneAnalysis> {
  const model = optionalEnv("OPENAI_MODEL", "gpt-4.1-mini");
  const families = getStyleFamilies();

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "style_cluster",
      "raw_style_name",
      "style_family",
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
      style_cluster: { type: "string" },
      raw_style_name: { type: "string" },
      style_family: { type: "string", enum: families },
      scene: { type: "string" },
      lighting: { type: "string" },
      subject: { type: "string" },
      color_change_tags: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      lightroom_recipe: { type: "string" },
      lightroom_basic_params: { type: "string" },
      lightroom_color_params: { type: "string" },
      tone_curve_notes: { type: "string" },
      web_preview_params: {
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
          "grain",
          "vignette",
          "fade",
          "clarity"
        ],
        properties: {
          exposure: { type: "number" },
          contrast: { type: "number" },
          highlights: { type: "number" },
          shadows: { type: "number" },
          whites: { type: "number" },
          blacks: { type: "number" },
          temperature: { type: "number" },
          tint: { type: "number" },
          vibrance: { type: "number" },
          saturation: { type: "number" },
          grain: { type: "number" },
          vignette: { type: "number" },
          fade: { type: "number" },
          clarity: { type: "number" }
        }
      },
      training_ready: { type: "boolean" },
      confidence_score: { type: "number" }
    }
  };

  const data = await responsesCreate({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `你是一位攝影調色分析助手。請比較兩張照片：第一張是原圖，第二張是攝影師調色後版本。

任務：
1. 分析原圖到成品的調色差異。
2. 產生可讀的 Lightroom 建議數值。
3. 產生給網頁預覽用的 web_preview_params。
4. raw_style_name 可以自由命名，但 style_family 必須只能從以下固定分類選一個：${families.join("、")}。

請使用繁體中文。Lightroom 數值可用建議區間，不需宣稱 100% 等同 Lightroom。若不確定，style_family 選「待整理」。`
          },
          { type: "input_image", image_url: originalUrl, detail: optionalEnv("OPENAI_IMAGE_DETAIL", "low") },
          { type: "input_image", image_url: editedUrl, detail: optionalEnv("OPENAI_IMAGE_DETAIL", "low") }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "tone_pair_lightroom_recipe",
        strict: true,
        schema
      }
    }
  });

  const output = extractOutputText(data);
  if (!output) throw new Error("OpenAI response did not contain output text.");
  return JSON.parse(output) as ToneAnalysis;
}

export async function classifyStyleFamily(input: {
  aiStyleCluster?: string;
  summary?: string;
  tags?: string[];
  lightroomRecipe?: string;
  basicParams?: string;
  colorParams?: string;
  toneCurveNotes?: string;
}): Promise<StyleClassification> {
  const model = optionalEnv("OPENAI_MODEL", "gpt-4.1-mini");
  const families = getStyleFamilies();

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["style_family", "raw_style_name", "rationale", "confidence_score"],
    properties: {
      style_family: { type: "string", enum: families },
      raw_style_name: { type: "string" },
      rationale: { type: "string" },
      confidence_score: { type: "number" }
    }
  };

  const data = await responsesCreate({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `你是攝影調色資料庫整理助手。請根據以下既有分析文字，替這筆資料選擇一個正式 Style Family。

只能從以下選項選一個：${families.join("、")}

如果資訊不足或跨多種風格，請選「待整理」。不要創造新分類。

資料：
AI Style Cluster: ${input.aiStyleCluster || ""}
Summary: ${input.summary || ""}
Tags: ${(input.tags || []).join("、")}
Lightroom Recipe: ${input.lightroomRecipe || ""}
Basic Params: ${input.basicParams || ""}
Color Params: ${input.colorParams || ""}
Tone Curve Notes: ${input.toneCurveNotes || ""}`
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "style_family_classification",
        strict: true,
        schema
      }
    }
  });

  const output = extractOutputText(data);
  if (!output) throw new Error("OpenAI response did not contain output text.");
  return JSON.parse(output) as StyleClassification;
}

export type UserRecipeAnalysis = {
  photo_assessment: string;
  lightroom_recipe: string;
  lightroom_basic_params: string;
  lightroom_color_params: string;
  tone_curve_notes: string;
  usage_notes: string;
  web_preview_params: Record<string, number | string | boolean>;
  confidence_score: number;
};

export async function generateRecipeForUserPhoto(input: {
  imageUrl: string;
  styleFamily: string;
  examples: Array<{
    aiStyleCluster?: string;
    rawStyleName?: string;
    summary?: string;
    tags?: string[];
    lightroomRecipe?: string;
    basicParams?: string;
    colorParams?: string;
    toneCurveNotes?: string;
    webPreviewParams?: string;
  }>;
}): Promise<UserRecipeAnalysis> {
  const model = optionalEnv("OPENAI_MODEL", "gpt-4.1-mini");
  const examplesText = input.examples
    .slice(0, 8)
    .map((ex, idx) => {
      return `範例 ${idx + 1}
AI Style Cluster: ${ex.aiStyleCluster || ""}
Raw Style Name: ${ex.rawStyleName || ""}
Summary: ${ex.summary || ""}
Tags: ${(ex.tags || []).join("、")}
Lightroom Recipe: ${ex.lightroomRecipe || ""}
Basic Params: ${ex.basicParams || ""}
Color Params: ${ex.colorParams || ""}
Tone Curve: ${ex.toneCurveNotes || ""}
Web Preview Params: ${ex.webPreviewParams || ""}`;
    })
    .join("\n\n---\n\n");

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "photo_assessment",
      "lightroom_recipe",
      "lightroom_basic_params",
      "lightroom_color_params",
      "tone_curve_notes",
      "usage_notes",
      "web_preview_params",
      "confidence_score"
    ],
    properties: {
      photo_assessment: { type: "string" },
      lightroom_recipe: { type: "string" },
      lightroom_basic_params: { type: "string" },
      lightroom_color_params: { type: "string" },
      tone_curve_notes: { type: "string" },
      usage_notes: { type: "string" },
      web_preview_params: {
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
          "grain",
          "vignette",
          "fade",
          "clarity"
        ],
        properties: {
          exposure: { type: "number" },
          contrast: { type: "number" },
          highlights: { type: "number" },
          shadows: { type: "number" },
          whites: { type: "number" },
          blacks: { type: "number" },
          temperature: { type: "number" },
          tint: { type: "number" },
          vibrance: { type: "number" },
          saturation: { type: "number" },
          grain: { type: "number" },
          vignette: { type: "number" },
          fade: { type: "number" },
          clarity: { type: "number" }
        }
      },
      confidence_score: { type: "number" }
    }
  };

  const data = await responsesCreate({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `你是 Eric Tone Lightroom Assistant。請根據使用者上傳的照片，以及 Eric 已整理出的調色資料庫範例，產生一組適合這張照片的 Lightroom 建議數值。

選定風格：${input.styleFamily}

參考資料庫範例：
${examplesText || "目前沒有足夠範例，請用保守、自然的方式建議。"}

要求：
1. 不要聲稱這是精準 Lightroom 自動套用，只能說是建議值。
2. 根據使用者照片的曝光、光線、主體與風格範例調整數值。
3. 若照片不適合此風格，請在 usage_notes 裡提醒。
4. 使用繁體中文。
5. 數值請接近 Lightroom 調整邏輯，不要過度極端。`
          },
          { type: "input_image", image_url: input.imageUrl, detail: optionalEnv("OPENAI_IMAGE_DETAIL", "low") }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "user_lightroom_recipe",
        strict: true,
        schema
      }
    }
  });

  const output = extractOutputText(data);
  if (!output) throw new Error("OpenAI response did not contain output text.");
  return JSON.parse(output) as UserRecipeAnalysis;
}
