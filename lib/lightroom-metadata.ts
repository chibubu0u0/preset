export type ParsedLightroomMetadata = {
  source: "metadata_json" | "xmp_json" | "unknown";
  camera?: string;
  rawFileName?: string;
  creatorTool?: string;
  basic: Record<string, number | string | null>;
  hsl: Record<string, { hue: number | null; saturation: number | null; luminance: number | null }>;
  colorGrading: Record<string, number | string | null>;
  toneCurve: Record<string, any>;
  effects: Record<string, number | string | null>;
  calibration: Record<string, number | string | null>;
  raw: Record<string, any>;
};

const colors = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"] as const;
const lowerColor: Record<string, string> = {
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
  Aqua: "aqua",
  Blue: "blue",
  Purple: "purple",
  Magenta: "magenta"
};

function asNumber(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return asNumber(value[0]);
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pick(obj: Record<string, any>, key: string): any {
  if (!obj) return null;
  return obj[key] ?? null;
}

function cleanCrsKey(key: string): string {
  // Supports keys from exifr, our browser metadata extractor, and ExifTool -j -a -G1 -s.
  // Examples:
  // - Vibrance
  // - XMP-crs:Vibrance
  // - XMP-crs:HueAdjustmentRed
  // - crs:ToneCurvePV2012
  return key.includes(":") ? key.split(":").pop() || key : key;
}

function findCrs(metadata: any): Record<string, any> {
  if (!metadata) return {};

  // ExifTool -j returns an array. Use the first object.
  const source = Array.isArray(metadata) ? metadata[0] : metadata;
  if (!source || typeof source !== "object") return {};

  const crs = source?.parserResults?.exifr?.crs;
  if (crs && typeof crs === "object") return crs;

  // Browser metadata extractor format: { metadata: [{ keyPath, values }] }
  const out: Record<string, any> = {};
  const rows = Array.isArray(source?.metadata) ? source.metadata : [];
  for (const row of rows) {
    const key = row?.keyPath;
    const values = row?.values;
    if (!key || !Array.isArray(values) || !values.length) continue;
    out[cleanCrsKey(key)] = values.length === 1 ? values[0] : values;
  }

  // ExifTool flat object format with grouped keys, e.g. XMP-crs:Vibrance.
  for (const [rawKey, value] of Object.entries(source)) {
    if (!rawKey || rawKey === "SourceFile") continue;
    const lower = rawKey.toLowerCase();
    const looksLikeCrs = lower.includes("xmp-crs") || lower.includes("crs:");
    const ungroupedKey = cleanCrsKey(rawKey);
    const knownUngrouped = [
      "Temperature", "Tint", "Exposure2012", "Contrast2012", "Highlights2012", "Shadows2012",
      "Whites2012", "Blacks2012", "Texture", "Clarity2012", "Dehaze", "Vibrance", "Saturation",
      "ToneCurvePV2012", "ToneCurvePV2012Red", "ToneCurvePV2012Green", "ToneCurvePV2012Blue",
      "GrainAmount", "PostCropVignetteAmount", "VignetteAmount", "CameraProfile", "ProcessVersion",
      "RawFileName", "PreservedFileName", "WhiteBalance"
    ].includes(ungroupedKey) || colors.some((color) =>
      ungroupedKey === `HueAdjustment${color}` ||
      ungroupedKey === `SaturationAdjustment${color}` ||
      ungroupedKey === `LuminanceAdjustment${color}`
    );

    if (looksLikeCrs || knownUngrouped) {
      out[ungroupedKey] = value;
    }
  }

  return out;
}

export function parseLightroomMetadata(metadata: any): ParsedLightroomMetadata {
  const crs = findCrs(metadata);
  const source = Array.isArray(metadata) ? metadata[0] : metadata;
  const exifr = source?.parserResults?.exifr || {};
  const ifd0 = exifr?.ifd0 || {};
  const xmp = exifr?.xmp || {};

  const basic = {
    Temperature: asNumber(pick(crs, "Temperature")),
    Tint: asNumber(pick(crs, "Tint")),
    Exposure2012: asNumber(pick(crs, "Exposure2012")),
    Contrast2012: asNumber(pick(crs, "Contrast2012")),
    Highlights2012: asNumber(pick(crs, "Highlights2012")),
    Shadows2012: asNumber(pick(crs, "Shadows2012")),
    Whites2012: asNumber(pick(crs, "Whites2012")),
    Blacks2012: asNumber(pick(crs, "Blacks2012")),
    Texture: asNumber(pick(crs, "Texture")),
    Clarity2012: asNumber(pick(crs, "Clarity2012")),
    Dehaze: asNumber(pick(crs, "Dehaze")),
    Vibrance: asNumber(pick(crs, "Vibrance")),
    Saturation: asNumber(pick(crs, "Saturation")),
    WhiteBalance: pick(crs, "WhiteBalance")
  };

  const hsl: ParsedLightroomMetadata["hsl"] = {};
  for (const color of colors) {
    hsl[lowerColor[color]] = {
      hue: asNumber(pick(crs, `HueAdjustment${color}`)),
      saturation: asNumber(pick(crs, `SaturationAdjustment${color}`)),
      luminance: asNumber(pick(crs, `LuminanceAdjustment${color}`))
    };
  }

  const colorGrading = {
    SplitToningShadowHue: asNumber(pick(crs, "SplitToningShadowHue")),
    SplitToningShadowSaturation: asNumber(pick(crs, "SplitToningShadowSaturation")),
    SplitToningHighlightHue: asNumber(pick(crs, "SplitToningHighlightHue")),
    SplitToningHighlightSaturation: asNumber(pick(crs, "SplitToningHighlightSaturation")),
    SplitToningBalance: asNumber(pick(crs, "SplitToningBalance")),
    ColorGradeShadowLum: asNumber(pick(crs, "ColorGradeShadowLum")),
    ColorGradeMidtoneHue: asNumber(pick(crs, "ColorGradeMidtoneHue")),
    ColorGradeMidtoneSat: asNumber(pick(crs, "ColorGradeMidtoneSat")),
    ColorGradeMidtoneLum: asNumber(pick(crs, "ColorGradeMidtoneLum")),
    ColorGradeHighlightLum: asNumber(pick(crs, "ColorGradeHighlightLum")),
    ColorGradeBlending: asNumber(pick(crs, "ColorGradeBlending")),
    ColorGradeGlobalHue: asNumber(pick(crs, "ColorGradeGlobalHue")),
    ColorGradeGlobalSat: asNumber(pick(crs, "ColorGradeGlobalSat")),
    ColorGradeGlobalLum: asNumber(pick(crs, "ColorGradeGlobalLum"))
  };

  const toneCurve = {
    ToneCurveName2012: pick(crs, "ToneCurveName2012"),
    ToneCurvePV2012: pick(crs, "ToneCurvePV2012"),
    ToneCurvePV2012Red: pick(crs, "ToneCurvePV2012Red"),
    ToneCurvePV2012Green: pick(crs, "ToneCurvePV2012Green"),
    ToneCurvePV2012Blue: pick(crs, "ToneCurvePV2012Blue"),
    ParametricShadows: asNumber(pick(crs, "ParametricShadows")),
    ParametricDarks: asNumber(pick(crs, "ParametricDarks")),
    ParametricLights: asNumber(pick(crs, "ParametricLights")),
    ParametricHighlights: asNumber(pick(crs, "ParametricHighlights"))
  };

  const effects = {
    GrainAmount: asNumber(pick(crs, "GrainAmount")),
    PostCropVignetteAmount: asNumber(pick(crs, "PostCropVignetteAmount")),
    VignetteAmount: asNumber(pick(crs, "VignetteAmount")),
    Sharpness: asNumber(pick(crs, "Sharpness")),
    ColorNoiseReduction: asNumber(pick(crs, "ColorNoiseReduction")),
    LuminanceSmoothing: asNumber(pick(crs, "LuminanceSmoothing"))
  };

  const calibration = {
    RedHue: asNumber(pick(crs, "RedHue")),
    RedSaturation: asNumber(pick(crs, "RedSaturation")),
    GreenHue: asNumber(pick(crs, "GreenHue")),
    GreenSaturation: asNumber(pick(crs, "GreenSaturation")),
    BlueHue: asNumber(pick(crs, "BlueHue")),
    BlueSaturation: asNumber(pick(crs, "BlueSaturation")),
    CameraProfile: pick(crs, "CameraProfile"),
    ProcessVersion: pick(crs, "ProcessVersion")
  };

  return {
    source: Object.keys(crs).length ? "metadata_json" : "unknown",
    camera: [ifd0?.Make, ifd0?.Model].filter(Boolean).join(" ") || undefined,
    rawFileName: pick(crs, "RawFileName") || pick(crs, "PreservedFileName") || undefined,
    creatorTool: xmp?.CreatorTool || undefined,
    basic,
    hsl,
    colorGrading,
    toneCurve,
    effects,
    calibration,
    raw: crs
  };
}

export function formatParsedLightroom(metadata: ParsedLightroomMetadata): string {
  const lines: string[] = [];
  if (metadata.camera) lines.push(`Camera: ${metadata.camera}`);
  if (metadata.rawFileName) lines.push(`Raw File: ${metadata.rawFileName}`);
  if (metadata.creatorTool) lines.push(`Creator Tool: ${metadata.creatorTool}`);
  lines.push("\nBasic");
  for (const [key, value] of Object.entries(metadata.basic)) lines.push(`${key}: ${value ?? ""}`);
  lines.push("\nHSL");
  for (const [color, values] of Object.entries(metadata.hsl)) {
    lines.push(`${color}: H ${values.hue ?? ""}, S ${values.saturation ?? ""}, L ${values.luminance ?? ""}`);
  }
  lines.push("\nTone Curve");
  for (const [key, value] of Object.entries(metadata.toneCurve)) lines.push(`${key}: ${Array.isArray(value) ? value.join(" | ") : value ?? ""}`);
  lines.push("\nColor Grading");
  for (const [key, value] of Object.entries(metadata.colorGrading)) lines.push(`${key}: ${value ?? ""}`);
  lines.push("\nEffects");
  for (const [key, value] of Object.entries(metadata.effects)) lines.push(`${key}: ${value ?? ""}`);
  lines.push("\nCalibration");
  for (const [key, value] of Object.entries(metadata.calibration)) lines.push(`${key}: ${value ?? ""}`);
  return lines.join("\n");
}
