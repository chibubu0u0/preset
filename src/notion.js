import { config } from "./config.js";

export async function notionRequest(path, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${config.notionApiKey}`,
      "Notion-Version": config.notionVersion,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`Notion API error ${response.status}: ${JSON.stringify(data, null, 2)}`);
  }

  return data;
}

export async function retrieveDatabase(databaseId) {
  return notionRequest(`/databases/${databaseId}`);
}

export async function retrieveDataSource(dataSourceId) {
  return notionRequest(`/data_sources/${dataSourceId}`);
}

export async function queryDataSource(dataSourceId, body) {
  return notionRequest(`/data_sources/${dataSourceId}/query`, {
    method: "POST",
    body,
  });
}

export async function updatePage(pageId, properties) {
  return notionRequest(`/pages/${pageId}`, {
    method: "PATCH",
    body: { properties },
  });
}

export function getTitlePlainText(page) {
  const titleProp = Object.values(page.properties || {}).find((prop) => prop.type === "title");
  return titleProp?.title?.map((item) => item.plain_text).join("") || "(untitled)";
}

export function getPropertyType(schema, propertyName) {
  return schema?.properties?.[propertyName]?.type;
}

export function hasProperty(schema, propertyName) {
  return Boolean(schema?.properties?.[propertyName]);
}

export function buildStatusProperty(schema, propertyName, value) {
  const type = getPropertyType(schema, propertyName);

  if (type === "status") {
    return { status: { name: value } };
  }

  if (type === "select") {
    return { select: { name: value } };
  }

  return null;
}

export function buildRichTextProperty(schema, propertyName, value) {
  if (!hasProperty(schema, propertyName)) return null;

  const type = getPropertyType(schema, propertyName);
  const content = String(value || "").slice(0, 1800);

  if (type === "rich_text") {
    return { rich_text: [{ text: { content } }] };
  }

  return null;
}

export function getFirstImageUrl(page, propertyName) {
  const prop = page.properties?.[propertyName];
  if (!prop) return null;

  if (prop.type === "files") {
    const file = prop.files?.[0];
    if (!file) return null;

    if (file.type === "file") return file.file?.url || null;
    if (file.type === "external") return file.external?.url || null;
  }

  if (prop.type === "url") {
    return prop.url || null;
  }

  if (prop.type === "rich_text") {
    return prop.rich_text?.map((item) => item.plain_text).join("").trim() || null;
  }

  return null;
}

export function buildPendingFilter(schema, statusName) {
  const statusType = getPropertyType(schema, "AI Status");

  if (statusType === "status") {
    return {
      property: "AI Status",
      status: { equals: statusName },
    };
  }

  if (statusType === "select") {
    return {
      property: "AI Status",
      select: { equals: statusName },
    };
  }

  throw new Error("AI Status 欄位必須是 Notion 的 Status 或 Select 類型");
}
