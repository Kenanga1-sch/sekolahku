
const { db } = require('./db/index.ts'); // This won't work directly with TS files in node without tsx
// Let's use fetch again but print cleaner

async function check() {
  try {
    const res = await fetch('http://localhost:3000/api/news');
    const data = await res.json();
    console.log('News items found:', data.length);
    data.forEach(item => {
      console.log(`ID: ${item.id}`);
      console.log(`Title: ${item.title}`);
      console.log(`Thumbnail: ${item.thumbnail === null ? 'NULL' : item.thumbnail === undefined ? 'UNDEFINED' : `"${item.thumbnail}"`}`);
      console.log('---');
    });
  } catch (e) {
    console.error(e);
  }
}

check();
