import { config } from "./config.js";
import { analyzeTonePair } from "./openai-tone-analyzer.js";
import {
  buildPendingFilter,
  buildRichTextProperty,
  buildStatusProperty,
  getFirstImageUrl,
  getTitlePlainText,
  getPropertyType,
  hasProperty,
  queryDataSource,
  retrieveDataSource,
  updatePage,
} from "./notion.js";

function compactProperties(properties) {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== null && value !== undefined));
}

async function updateAIStatus(schema, pageId, statusName, errorMessage = "") {
  const statusProperty = buildStatusProperty(schema, "AI Status", statusName);
  if (!statusProperty) {
    throw new Error("AI Status 欄位必須是 Status 或 Select 類型");
  }

  const properties = {
    "AI Status": statusProperty,
  };

  const errorProperty = buildRichTextProperty(schema, "AI Error", errorMessage);
  if (errorProperty) properties["AI Error"] = errorProperty;

  if (!config.dryRun) await updatePage(pageId, properties);
}

function buildAnalysisProperties(schema, analysis) {
  const properties = {};

  const doneStatus = buildStatusProperty(schema, "AI Status", config.status.done);
  if (doneStatus) properties["AI Status"] = doneStatus;

  if (hasProperty(schema, "AI Style Cluster") && getPropertyType(schema, "AI Style Cluster") === "select") {
    properties["AI Style Cluster"] = { select: { name: analysis.style_cluster } };
  }

  if (hasProperty(schema, "Scene Auto") && getPropertyType(schema, "Scene Auto") === "select") {
    properties["Scene Auto"] = { select: { name: analysis.scene } };
  }

  if (hasProperty(schema, "Lighting Auto") && getPropertyType(schema, "Lighting Auto") === "select") {
    properties["Lighting Auto"] = { select: { name: analysis.lighting } };
  }

  if (hasProperty(schema, "Subject Auto") && getPropertyType(schema, "Subject Auto") === "select") {
    properties["Subject Auto"] = { select: { name: analysis.subject } };
  }

  if (hasProperty(schema, "Color Change Tags") && getPropertyType(schema, "Color Change Tags") === "multi_select") {
    properties["Color Change Tags"] = {
      multi_select: analysis.color_change_tags.map((tag) => ({ name: tag })),
    };
  }

  const summary = buildRichTextProperty(schema, "AI Analysis Summary", analysis.summary);
  if (summary) properties["AI Analysis Summary"] = summary;

  if (hasProperty(schema, "Confidence Score") && getPropertyType(schema, "Confidence Score") === "number") {
    properties["Confidence Score"] = { number: analysis.confidence_score };
  }

  if (hasProperty(schema, "Training Ready") && getPropertyType(schema, "Training Ready") === "checkbox") {
    properties["Training Ready"] = { checkbox: Boolean(analysis.training_ready) };
  }

  return compactProperties(properties);
}

async function main() {
  if (!config.notionDataSourceId) {
    throw new Error("請先在 .env 設定 NOTION_DATA_SOURCE_ID。可先執行 npm run get-data-source。 ");
  }

  const schema = await retrieveDataSource(config.notionDataSourceId);
  const filter = buildPendingFilter(schema, config.status.pending);

  const pending = await queryDataSource(config.notionDataSourceId, {
    page_size: config.maxRowsPerRun,
    filter,
  });

  console.log(`找到 ${pending.results.length} 筆待分析資料`);
  if (config.dryRun) console.log("目前是 DRY_RUN，不會寫回 Notion。\n");

  for (const page of pending.results) {
    const title = getTitlePlainText(page);
    console.log(`\n開始分析：${title}`);

    try {
      await updateAIStatus(schema, page.id, config.status.processing);

      const originalUrl = getFirstImageUrl(page, "Original Image");
      const editedUrl = getFirstImageUrl(page, "Edited Image");

      if (!originalUrl || !editedUrl) {
        throw new Error("缺少 Original Image 或 Edited Image");
      }

      const analysis = await analyzeTonePair({ originalUrl, editedUrl });
      console.log(JSON.stringify(analysis, null, 2));

      const updateProperties = buildAnalysisProperties(schema, analysis);
      if (!config.dryRun) await updatePage(page.id, updateProperties);

      console.log(`完成：${title}`);
    } catch (error) {
      console.error(`失敗：${title}`);
      console.error(error.message);

      try {
        await updateAIStatus(schema, page.id, config.status.failed, error.message);
      } catch (statusError) {
        console.error("寫入失敗狀態時也失敗：", statusError.message);
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
