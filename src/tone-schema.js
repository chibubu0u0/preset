export const tonePairSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "style_cluster",
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
      description: "AI 自動歸納出的風格群組名稱，例如 Warm Soft Indoor、Cool Street Fade、Film Matte Tone。"
    },
    scene: {
      type: "string",
      description: "場景，例如 Cafe、Street、Indoor、Portrait、Landscape、Night、Food、Product。"
    },
    lighting: {
      type: "string",
      description: "光線，例如 Natural Light、Warm Indoor、Cloudy、Backlight、Low Light、Mixed Light、Night Light。"
    },
    subject: {
      type: "string",
      description: "主體，例如 Person、Object、Interior、Food、Building、Street Scene、Landscape。"
    },
    color_change_tags: {
      type: "array",
      items: { type: "string" },
      description: "色彩變化標籤，例如 Warm Highlight、Cool Shadow、Low Saturation、Lifted Black、Soft Contrast、Green Reduced、Film Grain。"
    },
    summary: {
      type: "string",
      description: "用繁體中文分析原圖到調色後的變化，重點放在色溫、對比、高光、陰影、飽和度、黑位、顆粒與整體情緒。"
    },
    training_ready: {
      type: "boolean",
      description: "這組前後圖是否適合放入未來調色訓練資料集。"
    },
    confidence_score: {
      type: "number",
      description: "0 到 100 的分析信心分數。"
    }
  }
};
