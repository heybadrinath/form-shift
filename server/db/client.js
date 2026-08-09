import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";
import { AppError } from "../errors.js";

let cachedConnection;

export function getDatabase(env = process.env) {
  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("postgres")) {
    throw new AppError(
      "server_misconfigured",
      "Database persistence is not configured.",
      503,
    );
  }

  if (!cachedConnection || cachedConnection.databaseUrl !== databaseUrl) {
    const client = neon(databaseUrl);
    cachedConnection = {
      databaseUrl,
      db: drizzle({ client, schema }),
    };
  }
  return cachedConnection.db;
}
