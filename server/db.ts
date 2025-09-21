import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { error } from "console";

// Open connection to SQLite DB (creates file if not exists)
export async function initDb() {



  
  const db: any = await open({
    filename: "./server/db/database.db",
    driver: sqlite3.Database,
  }).catch(error => {
    console.log(error);
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
