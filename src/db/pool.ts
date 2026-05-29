import pg from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

function fixConnectionString(url?: string): string | undefined {
  if (!url) return url;
  if (url.includes("%3F")) return url;

  try {
    const match = url.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.*)@([^@]+)$/);
    if (match) {
      const [_, proto, user, pwd, hostDb] = match;
      const encodedPwd = encodeURIComponent(pwd);
      return `${proto}${user}:${encodedPwd}@${hostDb}`;
    }
  } catch (err) {
    console.error("Failed to auto-encode database URL password:", err);
  }
  return url;
}

const rawDbUrl = process.env.DATABASE_URL;
const dbUrl = fixConnectionString(rawDbUrl);

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl ? { rejectUnauthorized: false } : undefined,
});

export async function initDatabase() {
  if (!dbUrl) {
    console.warn("⚠️ DATABASE_URL is not defined. PostgreSQL integration is offline.");
    return;
  }

  console.log("Connecting to PostgreSQL database to initialize schema...");
  const client = await pool.connect();
  try {
    // Check if the 'users' table already exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;
    const checkRes = await client.query(checkTableQuery);
    const tableExists = checkRes.rows[0].exists;

    if (!tableExists) {
      console.log("Schema 'users' table not found. Initializing database schema from schema.sql...");
      const schemaPath = path.join(process.cwd(), "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, "utf8");
        await client.query(schemaSql);
        console.log("✓ Database schema initialized successfully!");
      } else {
        console.error("❌ schema.sql file not found in workspace root. Skipping database setup.");
      }
    } else {
      console.log("✓ PostgreSQL database schema is already initialized.");
    }
  } catch (err) {
    console.error("❌ Failed to initialize database schema:", err);
    throw err;
  } finally {
    client.release();
  }
}
