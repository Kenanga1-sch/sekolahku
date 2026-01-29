
async function check() {
  try {
    // Test the detail API directly
    const slug = 'sholat-dhuha-berjamaah';
    console.log(`Testing /api/news/${slug}...`);
    
    const res = await fetch(`http://localhost:3000/api/news/${slug}`);
    console.log(`Status: ${res.status}`);
    
    if (res.ok) {
      const data = await res.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const errorData = await res.text();
      console.log('Error response:', errorData);
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

check();
