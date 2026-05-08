import OpenAI from "openai";
import { config } from "./config.js";
import { tonePairSchema } from "./tone-schema.js";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

function extractOutputText(response) {
  if (response.output_text) return response.output_text;

  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

export async function analyzeTonePair({ originalUrl, editedUrl }) {
  const response = await openai.responses.create({
    model: config.openaiModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
你是一位攝影調色分析助手。

請比較兩張照片：
第一張是原圖。
第二張是攝影師調色後的版本。

你的任務不是評價照片好不好，而是分析「原圖 → 調色後」的色彩與影像處理邏輯。

請特別觀察：
- 色溫是否變暖或變冷
- 高光是否被壓低、奶油化、柔化
- 陰影是否偏青、偏綠、加深或變柔
- 對比是否提高或降低
- 黑位是否抬高，是否有霧面感
- 飽和度是否降低或局部保留
- 膚色是否被保護
- 是否有顆粒、底片感、復古感
- 場景、光線、主體

請輸出固定 JSON，不要輸出多餘文字。
            `.trim(),
          },
          { type: "input_image", image_url: originalUrl },
          { type: "input_image", image_url: editedUrl },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "tone_pair_analysis",
        strict: true,
        schema: tonePairSchema,
      },
    },
  });

  const outputText = extractOutputText(response);
  return JSON.parse(outputText);
}
