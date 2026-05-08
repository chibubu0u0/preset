import { notionProperties, optionalEnv, requiredEnv } from "./env";
import type { TonePairAnalysis } from "./analyze";

async function notionRequest(path: string, init: RequestInit) {
  const notionVersion = optionalEnv("NOTION_VERSION", "2025-09-03");
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requiredEnv("NOTION_API_KEY")}`,
      "Notion-Version": notionVersion,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Notion API error ${res.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

function richText(content: string) {
  return [{ type: "text", text: { content: content.slice(0, 1900) } }];
}

function externalFile(name: string, url: string) {
  return {
    name,
    type: "external",
    external: { url }
  };
}

export async function createNotionTonePairPage(params: {
  photoId: string;
  originalUrl: string;
  editedUrl: string;
  analysis: TonePairAnalysis;
}) {
  const dataSourceId = requiredEnv("NOTION_DATA_SOURCE_ID");
  const p = notionProperties;

  const properties: Record<string, unknown> = {
    [p.title]: {
      title: richText(params.photoId)
    },
    [p.originalImage]: {
      files: [externalFile(`${params.photoId}-original`, params.originalUrl)]
    },
    [p.editedImage]: {
      files: [externalFile(`${params.photoId}-edited`, params.editedUrl)]
    },
    [p.aiStatus]: {
      status: { name: "已完成" }
    },
    [p.styleCluster]: {
      select: { name: params.analysis.style_cluster }
    },
    [p.scene]: {
      select: { name: params.analysis.scene }
    },
    [p.lighting]: {
      select: { name: params.analysis.lighting }
    },
    [p.subject]: {
      select: { name: params.analysis.subject }
    },
    [p.tags]: {
      multi_select: params.analysis.color_change_tags.map((tag) => ({ name: tag }))
    },
    [p.summary]: {
      rich_text: richText(params.analysis.summary)
    },
    [p.confidence]: {
      number: params.analysis.confidence_score
    },
    [p.trainingReady]: {
      checkbox: params.analysis.training_ready
    }
  };

  return notionRequest("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: {
        type: "data_source_id",
        data_source_id: dataSourceId
      },
      properties,
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: richText("AI 調色分析") }
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: richText(params.analysis.summary) }
        }
      ]
    })
  });
}
