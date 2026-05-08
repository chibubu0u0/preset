import "dotenv/config";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export const config = {
  notionApiKey: requiredEnv("NOTION_API_KEY"),
  notionDatabaseId: process.env.NOTION_DATABASE_ID?.trim() || "",
  notionDataSourceId: process.env.NOTION_DATA_SOURCE_ID?.trim() || "",
  notionVersion: process.env.NOTION_VERSION?.trim() || "2025-09-03",

  openaiApiKey: requiredEnv("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",

  maxRowsPerRun: Number.parseInt(process.env.MAX_ROWS_PER_RUN || "3", 10),
  dryRun: process.env.DRY_RUN === "true",

  status: {
    pending: process.env.STATUS_PENDING || "未開始",
    processing: process.env.STATUS_PROCESSING || "分析中",
    done: process.env.STATUS_DONE || "已完成",
    failed: process.env.STATUS_FAILED || "失敗",
  },
};
