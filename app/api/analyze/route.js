export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name, fallback) {
  return process.env[name] || fallback;
}

function richText(content) {
  return [
    {
      type: 'text',
      text: { content: String(content || '').slice(0, 1800) }
    }
  ];
}

function makePhotoId(pairName = '') {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0')
  ].join('');
  const suffix = String(pairName || '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-')
    .slice(0, 24);
  return suffix ? `ET-${stamp}-${suffix}` : `ET-${stamp}`;
}

function extractOutputText(data) {
  if (data.output_text) return data.output_text;

  const texts = [];
  function walk(node) {
    if (!node) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'object') {
      if (typeof node.text === 'string') texts.push(node.text);
      if (typeof node.content === 'string') texts.push(node.content);
      Object.values(node).forEach(walk);
    }
  }
  walk(data.output);
  return texts.join('\n').trim();
}

async function analyzeWithOpenAI({ originalUrl, editedUrl }) {
  const apiKey = requiredEnv('OPENAI_API_KEY');
  const model = optionalEnv('OPENAI_MODEL', 'gpt-4.1-mini');

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: [
      'style_cluster',
      'scene',
      'lighting',
      'subject',
      'color_change_tags',
      'summary',
      'confidence_score',
      'training_ready',
      'lightroom_recipe',
      'lightroom_basic_params',
      'lightroom_color_params',
      'tone_curve_notes',
      'web_preview_params'
    ],
    properties: {
      style_cluster: { type: 'string' },
      scene: { type: 'string' },
      lighting: { type: 'string' },
      subject: { type: 'string' },
      color_change_tags: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' },
      confidence_score: { type: 'number' },
      training_ready: { type: 'boolean' },
      lightroom_recipe: { type: 'string' },
      lightroom_basic_params: { type: 'string' },
      lightroom_color_params: { type: 'string' },
      tone_curve_notes: { type: 'string' },
      web_preview_params: {
        type: 'object',
        additionalProperties: false,
        required: [
          'exposure',
          'contrast',
          'highlights',
          'shadows',
          'whites',
          'blacks',
          'temperature',
          'tint',
          'vibrance',
          'saturation',
          'grain',
          'vignette',
          'fade',
          'warmth',
          'cool_shadows',
          'green_reduction'
        ],
        properties: {
          exposure: { type: 'number' },
          contrast: { type: 'number' },
          highlights: { type: 'number' },
          shadows: { type: 'number' },
          whites: { type: 'number' },
          blacks: { type: 'number' },
          temperature: { type: 'number' },
          tint: { type: 'number' },
          vibrance: { type: 'number' },
          saturation: { type: 'number' },
          grain: { type: 'number' },
          vignette: { type: 'number' },
          fade: { type: 'number' },
          warmth: { type: 'number' },
          cool_shadows: { type: 'number' },
          green_reduction: { type: 'number' }
        }
      }
    }
  };

  const prompt = `你是一位專業攝影調色分析助手。\n\n你會看到兩張照片：\n1. 原圖 Original Image\n2. 攝影師調色後 Edited Image\n\n請比較「原圖 → 調色後」的變化，目標是把攝影師的調色語言轉成可整理、可複製、可作為 Lightroom 建議的資料。\n\n分析重點：\n- 不要評論照片好壞，不要描述構圖故事。\n- 重點分析色溫、曝光、對比、高光、陰影、黑位、飽和度、HSL、膚色、天空、綠色、色彩情緒。\n- Lightroom 數值不是絕對精準複刻，而是「合理建議範圍」。\n- Web Preview Params 用 -100 到 100 或小數表示，供網頁 Canvas/WebGL 之後做近似預覽。\n- 請使用繁體中文。\n\n請輸出固定 JSON。`;

  const body = {
    model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: originalUrl, detail: 'high' },
          { type: 'input_image', image_url: editedUrl, detail: 'high' }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'lightroom_recipe_analysis',
        strict: true,
        schema
      }
    }
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI API returned non-JSON response: ${text.slice(0, 600)}`);
  }

  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${JSON.stringify(data).slice(0, 1200)}`);
  }

  const outputText = extractOutputText(data);
  if (!outputText) throw new Error('OpenAI response did not contain output_text');

  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error(`Could not parse OpenAI JSON output: ${outputText.slice(0, 1200)}`);
  }
}

async function createNotionPage({ photoId, originalUrl, editedUrl, analysis }) {
  const notionApiKey = requiredEnv('NOTION_API_KEY');
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!dataSourceId && !databaseId) throw new Error('Missing NOTION_DATA_SOURCE_ID or NOTION_DATABASE_ID');

  const notionVersion = optionalEnv('NOTION_VERSION', '2025-09-03');
  const parent = dataSourceId ? { data_source_id: dataSourceId } : { database_id: databaseId };

  const p = {
    title: optionalEnv('NOTION_TITLE_PROPERTY', 'Photo ID'),
    original: optionalEnv('NOTION_ORIGINAL_IMAGE_PROPERTY', 'Original Image'),
    edited: optionalEnv('NOTION_EDITED_IMAGE_PROPERTY', 'Edited Image'),
    status: optionalEnv('NOTION_AI_STATUS_PROPERTY', 'AI Status'),
    style: optionalEnv('NOTION_STYLE_CLUSTER_PROPERTY', 'AI Style Cluster'),
    scene: optionalEnv('NOTION_SCENE_PROPERTY', 'Scene Auto'),
    lighting: optionalEnv('NOTION_LIGHTING_PROPERTY', 'Lighting Auto'),
    subject: optionalEnv('NOTION_SUBJECT_PROPERTY', 'Subject Auto'),
    tags: optionalEnv('NOTION_TAGS_PROPERTY', 'Color Change Tags'),
    summary: optionalEnv('NOTION_SUMMARY_PROPERTY', 'AI Analysis Summary'),
    confidence: optionalEnv('NOTION_CONFIDENCE_PROPERTY', 'Confidence Score'),
    training: optionalEnv('NOTION_TRAINING_READY_PROPERTY', 'Training Ready'),
    recipe: optionalEnv('NOTION_LIGHTROOM_RECIPE_PROPERTY', 'Lightroom Recipe'),
    basic: optionalEnv('NOTION_LIGHTROOM_BASIC_PARAMS_PROPERTY', 'Lightroom Basic Params'),
    color: optionalEnv('NOTION_LIGHTROOM_COLOR_PARAMS_PROPERTY', 'Lightroom Color Params'),
    curve: optionalEnv('NOTION_TONE_CURVE_NOTES_PROPERTY', 'Tone Curve Notes'),
    preview: optionalEnv('NOTION_WEB_PREVIEW_PARAMS_PROPERTY', 'Web Preview Params')
  };

  const properties = {
    [p.title]: { title: [{ text: { content: photoId } }] },
    [p.original]: { files: [{ name: `${photoId}-original`, external: { url: originalUrl } }] },
    [p.edited]: { files: [{ name: `${photoId}-edited`, external: { url: editedUrl } }] },
    [p.status]: { status: { name: '已完成' } },
    [p.style]: { select: { name: analysis.style_cluster || 'Unsorted' } },
    [p.scene]: { select: { name: analysis.scene || 'Unknown' } },
    [p.lighting]: { select: { name: analysis.lighting || 'Unknown' } },
    [p.subject]: { select: { name: analysis.subject || 'Unknown' } },
    [p.tags]: { multi_select: (analysis.color_change_tags || []).slice(0, 12).map((name) => ({ name })) },
    [p.summary]: { rich_text: richText(analysis.summary) },
    [p.confidence]: { number: Number(analysis.confidence_score || 0) },
    [p.training]: { checkbox: Boolean(analysis.training_ready) },
    [p.recipe]: { rich_text: richText(analysis.lightroom_recipe) },
    [p.basic]: { rich_text: richText(analysis.lightroom_basic_params) },
    [p.color]: { rich_text: richText(analysis.lightroom_color_params) },
    [p.curve]: { rich_text: richText(analysis.tone_curve_notes) },
    [p.preview]: { rich_text: richText(JSON.stringify(analysis.web_preview_params || {}, null, 2)) }
  };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      'Notion-Version': notionVersion,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ parent, properties })
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Notion API returned non-JSON response: ${text.slice(0, 600)}`);
  }

  if (!res.ok) {
    throw new Error(`Notion API error ${res.status}: ${JSON.stringify(data).slice(0, 1200)}`);
  }

  return data;
}

export async function POST(req) {
  try {
    const { originalUrl, editedUrl, pairName, writeToNotion = true } = await req.json();

    if (!originalUrl || !editedUrl) {
      return Response.json({ ok: false, error: 'Missing originalUrl or editedUrl' }, { status: 400 });
    }

    const analysis = await analyzeWithOpenAI({ originalUrl, editedUrl });
    const photoId = makePhotoId(pairName);

    let notionPage = null;
    if (writeToNotion) {
      notionPage = await createNotionPage({ photoId, originalUrl, editedUrl, analysis });
    }

    return Response.json({ ok: true, photoId, analysis, notionPageId: notionPage?.id || null });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error.message || 'Unknown error' }, { status: 500 });
  }
}
