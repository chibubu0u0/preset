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

export type LightroomColorTriplet = {
  hue: number;
  saturation: number;
  luminance: number;
};

export type LightroomValues = {
  basic: {
    temperature: number;
    tint: number;
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
    texture: number;
    clarity: number;
    dehaze: number;
    vibrance: number;
    saturation: number;
  };
  hsl: {
    red: LightroomColorTriplet;
    orange: LightroomColorTriplet;
    yellow: LightroomColorTriplet;
    green: LightroomColorTriplet;
    aqua: LightroomColorTriplet;
    blue: LightroomColorTriplet;
    purple: LightroomColorTriplet;
    magenta: LightroomColorTriplet;
  };
  color_grading: {
    shadows: LightroomColorTriplet;
    midtones: LightroomColorTriplet;
    highlights: LightroomColorTriplet;
    blending: number;
    balance: number;
  };
  effects: {
    grain_amount: number;
    grain_size: number;
    grain_roughness: number;
    vignette: number;
  };
  calibration: {
    red_primary_hue: number;
    red_primary_saturation: number;
    green_primary_hue: number;
    green_primary_saturation: number;
    blue_primary_hue: number;
    blue_primary_saturation: number;
  };
};

export type UserRecipeAnalysis = {
  photo_assessment: string;
  lightroom_recipe: string;
  lightroom_basic_params: string;
  lightroom_color_params: string;
  tone_curve_notes: string;
  usage_notes: string;
  confidence_explanation: string;
  confidence_breakdown: {
    style_match: number;
    technical_safety: number;
    lightroom_usability: number;
  };
  lightroom_values: LightroomValues;
  web_preview_params: Record<string, number | string | boolean>;
  confidence_score: number;
};

export async function generateRecipeForUserPhoto(input: {
  imageUrl: string;
  styleFamily?: string;
  examples: Array<{
    aiStyleCluster?: string;
    rawStyleName?: string;
    styleFamily?: string;
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
    .slice(0, 14)
    .map((ex, idx) => {
      return `範例 ${idx + 1}
Style Family: ${ex.styleFamily || ""}
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

  const colorTripletSchema = {
    type: "object",
    additionalProperties: false,
    required: ["hue", "saturation", "luminance"],
    properties: {
      hue: { type: "number" },
      saturation: { type: "number" },
      luminance: { type: "number" }
    }
  };

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
      "confidence_explanation",
      "confidence_breakdown",
      "lightroom_values",
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
      confidence_explanation: { type: "string" },
      confidence_breakdown: {
        type: "object",
        additionalProperties: false,
        required: ["style_match", "technical_safety", "lightroom_usability"],
        properties: {
          style_match: { type: "number" },
          technical_safety: { type: "number" },
          lightroom_usability: { type: "number" }
        }
      },
      lightroom_values: {
        type: "object",
        additionalProperties: false,
        required: ["basic", "hsl", "color_grading", "effects", "calibration"],
        properties: {
          basic: {
            type: "object",
            additionalProperties: false,
            required: [
              "temperature", "tint", "exposure", "contrast", "highlights", "shadows",
              "whites", "blacks", "texture", "clarity", "dehaze", "vibrance", "saturation"
            ],
            properties: {
              temperature: { type: "number" }, tint: { type: "number" }, exposure: { type: "number" },
              contrast: { type: "number" }, highlights: { type: "number" }, shadows: { type: "number" },
              whites: { type: "number" }, blacks: { type: "number" }, texture: { type: "number" },
              clarity: { type: "number" }, dehaze: { type: "number" }, vibrance: { type: "number" },
              saturation: { type: "number" }
            }
          },
          hsl: {
            type: "object",
            additionalProperties: false,
            required: ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"],
            properties: {
              red: colorTripletSchema, orange: colorTripletSchema, yellow: colorTripletSchema, green: colorTripletSchema,
              aqua: colorTripletSchema, blue: colorTripletSchema, purple: colorTripletSchema, magenta: colorTripletSchema
            }
          },
          color_grading: {
            type: "object",
            additionalProperties: false,
            required: ["shadows", "midtones", "highlights", "blending", "balance"],
            properties: {
              shadows: colorTripletSchema, midtones: colorTripletSchema, highlights: colorTripletSchema,
              blending: { type: "number" }, balance: { type: "number" }
            }
          },
          effects: {
            type: "object",
            additionalProperties: false,
            required: ["grain_amount", "grain_size", "grain_roughness", "vignette"],
            properties: {
              grain_amount: { type: "number" }, grain_size: { type: "number" },
              grain_roughness: { type: "number" }, vignette: { type: "number" }
            }
          },
          calibration: {
            type: "object",
            additionalProperties: false,
            required: [
              "red_primary_hue", "red_primary_saturation",
              "green_primary_hue", "green_primary_saturation",
              "blue_primary_hue", "blue_primary_saturation"
            ],
            properties: {
              red_primary_hue: { type: "number" }, red_primary_saturation: { type: "number" },
              green_primary_hue: { type: "number" }, green_primary_saturation: { type: "number" },
              blue_primary_hue: { type: "number" }, blue_primary_saturation: { type: "number" }
            }
          }
        }
      },
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
          "clarity",
          "preview_strength"
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
          clarity: { type: "number" },
          preview_strength: { type: "number" }
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

調色方向：請不要用單一歸類硬套。請從 Eric 的整體資料集歸納「共同調色語言」，再依照使用者這張照片做保守調整。

參考資料庫範例：
${examplesText || "目前沒有足夠範例，請用保守、自然的方式建議。"}

要求：
1. 不要聲稱這是精準 Lightroom 自動套用，只能說是建議值。
2. 不要把照片重新變成某個分類；請學習 Eric 整體常見的色彩傾向，例如對比、黑位、陰影色彩、暖冷平衡、鮮豔度、飽和度與膚色處理。
3. Eric 的核心色彩邏輯：Vibrance 通常偏高，約 +45 到 +55；Saturation 通常是 Vibrance 的負一半，例如 Vibrance +50 時 Saturation 約 -25。這個規則非常重要，不要反過來。
4. 若照片有人像、膚色、花朵、霓虹、紅色或黃色高彩度物件，Vibrance 可保守降到 +35 到 +45，Saturation 約 -18 到 -23；仍要維持「高 Vibrance + 負 Saturation」的方向。
5. 優先用 HSL 控制特定顏色，不要只靠全域 Saturation。請完整給出 Red / Orange / Yellow / Green / Aqua / Blue / Purple / Magenta 的 Hue、Saturation、Luminance。
6. lightroom_values 是給使用者照著輸入 Lightroom 的完整建議值；web_preview_params 只是網頁下載預覽用的安全近似值，兩者不要混淆。
7. 若照片有人像，務必保護膚色，不要把臉壓暗、變灰或變髒。
8. web_preview_params 必須非常保守，避免整張過暗或出現海報化斷層。請遵守範圍：exposure -0.25 到 0.30、contrast -18 到 18、highlights -35 到 20、shadows -10 到 35、whites -20 到 15、blacks -10 到 28、temperature -450 到 450、tint -10 到 10、vibrance -12 到 18、saturation -15 到 8、grain 0 到 12、vignette -10 到 0、fade 0 到 18、clarity -10 到 10。
9. preview_strength 由 AI 自動判斷，範圍 0.20 到 0.55。若是人像、膚色、花朵、逆光或高光容易壞掉，請用 0.25 到 0.35；若是風景或低對比照片，可用 0.35 到 0.45；只有非常適合的照片才可接近 0.50。
10. confidence_explanation 要說明：這張照片與資料集的相似度、這組 Lightroom 值為什麼安全或不安全、哪些顏色需要注意。confidence_breakdown 的三個分數都用 0-100。
11. lightroom_basic_params、lightroom_color_params、tone_curve_notes、lightroom_recipe 都要用繁體中文，並包含具體數值。
12. 使用繁體中文。`
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
