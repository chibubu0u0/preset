const required = [
  "OPENAI_API_KEY",
  "NOTION_API_KEY",
  "NOTION_DATA_SOURCE_ID",
  "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
  "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET"
];

const recommended = [
  "NOTION_LIGHTROOM_RECIPE_PROPERTY",
  "NOTION_LIGHTROOM_BASIC_PARAMS_PROPERTY",
  "NOTION_LIGHTROOM_COLOR_PARAMS_PROPERTY",
  "NOTION_TONE_CURVE_NOTES_PROPERTY",
  "NOTION_WEB_PREVIEW_PARAMS_PROPERTY"
];

let ok = true;
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing: ${name}`);
    ok = false;
  } else {
    console.log(`OK: ${name}`);
  }
}

for (const name of recommended) {
  if (!process.env[name]) {
    console.warn(`Recommended: ${name}`);
  }
}

if (!ok) {
  console.error("\nPlease create .env.local or set these variables in Vercel.");
  process.exit(1);
}

console.log("\nAll required environment variables are present.");
