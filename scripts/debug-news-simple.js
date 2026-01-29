
async function check() {
  try {
    const res = await fetch('http://localhost:3000/api/news');
    const data = await res.json();
    console.log('News items found:', data.length);
    data.forEach(item => {
      console.log(`ID: ${item.id}`);
      console.log(`Title: ${item.title}`);
      console.log(`Slug: ${item.slug}`);
      console.log(`Thumbnail: ${item.thumbnail === null ? 'NULL' : item.thumbnail === undefined ? 'UNDEFINED' : `"${item.thumbnail}"`}`);
      console.log('---');
    });
  } catch (e) {
    console.error(e);
  }
}

check();
