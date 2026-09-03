import { db } from "../../src/db/index";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
console.log("Migration script starting...");
try {
  migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migration successful!");
} catch (e) {
  console.error("Migration failed:", e);
}
