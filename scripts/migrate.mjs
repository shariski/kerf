#!/usr/bin/env node
// Apply pending Drizzle migrations against $DATABASE_URL, then exit.
//
// Used in production by the `migrate` compose service:
//   docker compose --profile migrate run --rm migrate
//
// Drizzle's runtime migrator (drizzle-orm/postgres-js/migrator) reads
// the migrations folder + journal and applies pending SQL files inside
// a single transaction, recording state in __drizzle_migrations. We do
// NOT depend on drizzle-kit here — it is a devDependency and is not
// shipped in the runtime image. See DEPLOYMENT.md for the deploy flow.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

// max:1 — migrator should not open a pool. One connection, then close.
const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log("migrations applied");
} finally {
  await sql.end({ timeout: 5 });
}
