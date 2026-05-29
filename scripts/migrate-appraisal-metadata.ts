import dotenv from "dotenv";
import { pool } from "../src/db/pool";

dotenv.config();

function fixConnectionString(url: string | undefined): string | undefined {
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

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = fixConnectionString(process.env.DATABASE_URL);
}

async function runMigration() {
  console.log("=== RUNNING DATABASE APPRAISAL METADATA MIGRATION ===");
  try {
    const query = `
      UPDATE appraisals
      SET result = jsonb_set(
        jsonb_set(
          COALESCE(result, '{}'::jsonb),
          '{modelUsed}',
          to_jsonb(COALESCE(result->>'modelUsed', model_name))
        ),
        '{promptVersion}',
        to_jsonb(COALESCE(result->>'promptVersion', 'standard'))
      )
      WHERE status = 'complete';
    `;
    const res = await pool.query(query);
    console.log(`✓ Migration complete. Updated ${res.rowCount} appraisal records.`);
  } catch (err) {
    console.error("❌ Migration failed with error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
