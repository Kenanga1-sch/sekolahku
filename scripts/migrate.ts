import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db';

async function main() {
  console.log('Running migrations...');
  try {
    // This will run migrations on the database, skipping the ones already applied
    await migrate(db, { migrationsFolder: './db/migrations' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
