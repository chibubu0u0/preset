export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] && process.env[name]!.trim() !== "" ? process.env[name]! : fallback;
}

export function optionalNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const notionProperties = {
  title: optionalEnv("NOTION_TITLE_PROPERTY", "Photo ID"),
  originalImage: optionalEnv("NOTION_ORIGINAL_IMAGE_PROPERTY", "Original Image"),
  editedImage: optionalEnv("NOTION_EDITED_IMAGE_PROPERTY", "Edited Image"),
  aiStatus: optionalEnv("NOTION_AI_STATUS_PROPERTY", "AI Status"),
  styleCluster: optionalEnv("NOTION_STYLE_CLUSTER_PROPERTY", "AI Style Cluster"),
  scene: optionalEnv("NOTION_SCENE_PROPERTY", "Scene Auto"),
  lighting: optionalEnv("NOTION_LIGHTING_PROPERTY", "Lighting Auto"),
  subject: optionalEnv("NOTION_SUBJECT_PROPERTY", "Subject Auto"),
  tags: optionalEnv("NOTION_TAGS_PROPERTY", "Color Change Tags"),
  summary: optionalEnv("NOTION_SUMMARY_PROPERTY", "AI Analysis Summary"),
  confidence: optionalEnv("NOTION_CONFIDENCE_PROPERTY", "Confidence Score"),
  trainingReady: optionalEnv("NOTION_TRAINING_READY_PROPERTY", "Training Ready"),
  error: optionalEnv("NOTION_ERROR_PROPERTY", "AI Error"),
  lightroomRecipe: optionalEnv("NOTION_LIGHTROOM_RECIPE_PROPERTY", "Lightroom Recipe"),
  lightroomBasicParams: optionalEnv("NOTION_LIGHTROOM_BASIC_PARAMS_PROPERTY", "Lightroom Basic Params"),
  lightroomColorParams: optionalEnv("NOTION_LIGHTROOM_COLOR_PARAMS_PROPERTY", "Lightroom Color Params"),
  toneCurveNotes: optionalEnv("NOTION_TONE_CURVE_NOTES_PROPERTY", "Tone Curve Notes"),
  webPreviewParams: optionalEnv("NOTION_WEB_PREVIEW_PARAMS_PROPERTY", "Web Preview Params")
};
