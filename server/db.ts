import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import fs from "fs";

// Open connection to SQLite DB (creates file if not exists)
export async function initDb() {
  // Ensure db directory exists
  const dbDir = path.join(process.cwd(), "server", "db");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "database.db");
  
  const db: any = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  }).catch((error) => {
    console.error("Database connection error:", error);
    throw error;
  });

  // Create users table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      emailAddress TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  return db;
}
