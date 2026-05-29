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

const dbUrl = fixConnectionString(process.env.DATABASE_URL);
console.log("Original URL:", process.env.DATABASE_URL);
console.log("Fixed URL:", dbUrl);

const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log("Attempting to connect to Supabase PostgreSQL database...");
    const client = await pool.connect();
    console.log("✓ Connection successful!");
    
    const res = await client.query("SELECT NOW()");
    console.log("Database time:", res.rows[0].now);
    
    client.release();
  } catch (err) {
    console.error("❌ Failed to connect to database:", err);
  } finally {
    await pool.end();
  }
}

testConnection();
