import Database from 'better-sqlite3';
import path from 'path';

const pbPath = path.join(process.cwd(), 'pb_data', 'data.db');
const db = new Database(pbPath, { readonly: true });

console.log('--- USERS SAMPLE ---');
const user = db.prepare("SELECT * FROM users LIMIT 1").get();
console.log(user);

console.log('--- PROFILES SAMPLE ---');
try {
  const profile = db.prepare("SELECT * FROM profiles LIMIT 1").get();
  console.log(profile);
} catch (e) { console.log("No profiles table or empty"); }

console.log('--- SPMB REGISTRANTS COLUMNS ---');
const cols = db.prepare("PRAGMA table_info(spmb_registrants)").all();
cols.forEach((c: any) => console.log(c.name));
