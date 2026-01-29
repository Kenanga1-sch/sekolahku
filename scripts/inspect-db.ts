
import Database from "better-sqlite3";

const db = new Database("./data/sekolahku.db");

console.log("Checking loans table:");
const t1 = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='loans'").get();
console.log(t1 ? "loans Table exists." : "loans Table DOES NOT exist.");

console.log("Checking loan_installments table:");
const t2 = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='loan_installments'").get();
console.log(t2 ? "loan_installments Table exists." : "loan_installments Table DOES NOT exist.");
