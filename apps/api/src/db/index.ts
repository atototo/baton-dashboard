import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as relations from "./relations.js";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema: { ...schema, ...relations } });

export { schema };
