require('dotenv/config');

const NOTION_VERSION = process.env.NOTION_VERSION || '2025-09-03';

async function main() {
  const token = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!token) throw new Error('Missing NOTION_API_KEY in .env.local or .env');
  if (!databaseId) throw new Error('Missing NOTION_DATABASE_ID in .env.local or .env');

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    }
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const title = data.title?.map((t) => t.plain_text).join('') || '(no title)';
  console.log('Database title:');
  console.log(title);
  console.log('\nData sources:');
  console.log(JSON.stringify(data.data_sources || [], null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
