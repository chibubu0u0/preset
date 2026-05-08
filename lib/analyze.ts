import OpenAI from "openai";
import { optionalEnv, requiredEnv } from "./env";

export type TonePairAnalysis = {
  style_cluster: string;
  style_name_draft: string;
  scene: string;
  lighting: string;
  subject: string;
  color_change_tags: string[];
  summary: string;
  training_ready: boolean;
  confidence_score: number;
};

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
            text: `你是一位攝影調色分析助手。請比較兩張照片：第一張是原圖，第二張是攝影師調色後的版本。\n\n任務：\n1. 分析「原圖 → 調色後」發生了哪些影像與色彩變化。\n2. 自動判斷場景、光線、主體與色彩變化標籤。\n3. 不要評價照片好壞，不要改圖，只分析調色邏輯。\n4. 用繁體中文撰寫 summary。\n5. 請用穩定、可累積資料集的方式命名 style_cluster。若無法確定就用 Style Cluster 01 / 02 這種保守命名。`
          },
          { type: "input_image", image_url: originalUrl },
          { type: "input_image", image_url: editedUrl }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "tone_pair_analysis",
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
    confidence_score: Math.max(0, Math.min(100, Number(parsed.confidence_score) || 0))
  };
}
