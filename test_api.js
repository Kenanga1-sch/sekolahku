const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch("http://127.0.0.1:8181/api/master/students?classId=hah1516t84ehrxvz97w6kdt0&limit=100&status=active");
    const json = await res.json();
    console.log("Status:", res.status);
    console.log("JSON Keys:", Object.keys(json));
    console.log("JSON success:", json.success);
    console.log("JSON error:", json.error);
    if (json.data) {
        console.log("JSON data keys:", Object.keys(json.data));
        console.log("JSON data total:", json.data.total);
        if (json.data.data) {
            console.log("JSON data.data length:", json.data.data.length);
        }
    } else {
        console.log("NO DATA FIELD!");
    }
  } catch (e) {
    console.error(e);
  }
}
test();
