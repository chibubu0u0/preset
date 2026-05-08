import { config } from "./config.js";
import {
  getTitlePlainText,
  queryDataSource,
  retrieveDataSource,
  getFirstImageUrl,
} from "./notion.js";

async function main() {
  if (!config.notionDataSourceId) {
    throw new Error("請先在 .env 設定 NOTION_DATA_SOURCE_ID。可先執行 npm run get-data-source。 ");
  }

  const schema = await retrieveDataSource(config.notionDataSourceId);
  console.log(`Data source: ${schema.name || schema.id}`);

  const result = await queryDataSource(config.notionDataSourceId, {
    page_size: 3,
  });

  console.log(`\n讀到 ${result.results.length} 筆資料：\n`);

  for (const page of result.results) {
    const title = getTitlePlainText(page);
    const original = getFirstImageUrl(page, "Original Image") ? "有原圖" : "缺原圖";
    const edited = getFirstImageUrl(page, "Edited Image") ? "有成品圖" : "缺成品圖";
    console.log(`- ${title}｜${original}｜${edited}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
