import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

function fixConnectionString(url) {
  if (!url) return url;
  if (url.includes('%3F')) return url;
  
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

const pool = new Pool({
  connectionString: fixConnectionString(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // 1. Group by model_name in appraisals table
    const modelGroupRes = await pool.query(`
      SELECT model_name, COUNT(*) 
      FROM appraisals 
      GROUP BY model_name;
    `);
    console.log("Appraisals grouped by database model_name column:");
    console.log(modelGroupRes.rows);

    // 2. Sample some results to see if modelUsed or promptVersion are inside
    const sampleRes = await pool.query(`
      SELECT result->>'modelUsed' as model_used, result->>'promptVersion' as prompt_version, COUNT(*)
      FROM appraisals
      GROUP BY result->>'modelUsed', result->>'promptVersion';
    `);
    console.log("Appraisals grouped by result JSONB keys:");
    console.log(sampleRes.rows);
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
