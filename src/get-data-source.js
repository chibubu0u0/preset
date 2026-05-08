import { config } from "./config.js";
import { retrieveDatabase } from "./notion.js";

async function main() {
  if (!config.notionDatabaseId) {
    throw new Error("請先在 .env 設定 NOTION_DATABASE_ID");
  }

  const database = await retrieveDatabase(config.notionDatabaseId);
  const title = database.title?.map((item) => item.plain_text).join("") || "(no title)";

  console.log(`Database: ${title}`);
  console.log("\nData sources:");

  const dataSources = database.data_sources || [];
  if (dataSources.length === 0) {
    console.log("找不到 data sources。請確認 Notion API version 與 database ID。 ");
    return;
  }

  for (const source of dataSources) {
    console.log(`- ${source.name || "(unnamed)"}: ${source.id}`);
  }

  console.log("\n請把要使用的 data source id 填到 .env 的 NOTION_DATA_SOURCE_ID。 ");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
