import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';

async function main() {
    console.log('Running migrations...');
    
    const dbPath = path.join(process.cwd(), 'data', 'sekolahku.db');
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);

    // Use absolute path for migrations folder to be safe
    const migrationsFolder = path.join(process.cwd(), 'db', 'migrations');
    console.log(`Reading migrations from: ${migrationsFolder}`);
    
    await migrate(db, { migrationsFolder });
    console.log('Migrations migrated successfully!');
    process.exit(0);
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
