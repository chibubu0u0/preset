const required = [
  "OPENAI_API_KEY",
  "NOTION_API_KEY",
  "NOTION_DATA_SOURCE_ID",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_UPLOAD_PRESET"
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

if (!ok) {
  console.error("\nPlease create .env.local or set these variables in Vercel.");
  process.exit(1);
}

console.log("\nAll required environment variables are present.");
