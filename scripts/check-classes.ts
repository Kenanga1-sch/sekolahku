
import Database from "better-sqlite3";

const db = new Database("data/sekolahku.db");

try {
    const count = db.prepare("SELECT count(*) as c FROM student_classes").get() as { c: number };
    console.log("Total classes:", count.c);
    
    if (count.c > 0) {
        const classes = db.prepare("SELECT * FROM student_classes LIMIT 5").all();
        console.log("Sample classes:", classes);
    } else {
        console.log("Table is empty.");
    }
} catch (e) {
    console.error(e);
}
