import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pg from "pg";
import { initDatabase, pool } from "../src/db/pool";
import { saveCatalogueItems } from "../src/db/queries";

dotenv.config();

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USER_RECORDS_DIR = path.join(DATA_DIR, "user_records");

async function migrate() {
  console.log("=== STARTING DATA MIGRATION TO SUPABASE PostgreSQL ===");

  // Initialize pool and database tables
  await initDatabase();

  if (!fs.existsSync(USERS_FILE)) {
    console.log("No local data/users.json found. Skipping user migration.");
    process.exit(0);
  }

  const usersRaw = fs.readFileSync(USERS_FILE, "utf-8");
  const users = JSON.parse(usersRaw || "[]");
  console.log(`Found ${users.length} users to migrate.`);

  for (const localUser of users) {
    const email = localUser.username.trim().toLowerCase();
    const password = localUser.password;

    console.log(`\nMigrating user: ${email}...`);

    // Insert user into PostgreSQL (on conflict do nothing / get existing)
    let userId: string;
    try {
      const res = await pool.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id",
        [email, password]
      );
      userId = res.rows[0].id;
      console.log(`✓ User record resolved: ID ${userId}`);
    } catch (err) {
      console.error(`❌ Failed to migrate user ${email}:`, err);
      continue;
    }

    // Load user's catalog list
    const userFolder = path.join(USER_RECORDS_DIR, localUser.username);
    const catalogsListFile = path.join(userFolder, "catalogs_list.json");

    if (!fs.existsSync(catalogsListFile)) {
      console.log(`No catalogues list found for ${email}. Creating default catalogue.`);
      try {
        await pool.query(
          "INSERT INTO catalogues (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [userId, "Default Catalogue"]
        );
      } catch (err) {
        console.error("Failed to create default catalog:", err);
      }
      continue;
    }

    try {
      const catalogsListRaw = fs.readFileSync(catalogsListFile, "utf-8");
      const listData = JSON.parse(catalogsListRaw || "{}");
      const catalogsArray = listData.catalogs || [];

      console.log(`Found ${catalogsArray.length} catalogues for ${email}.`);

      for (const cat of catalogsArray) {
        const catId = cat.id; // e.g. "default" or "13216"
        const catName = cat.name;
        const catTimestamp = cat.timestamp || new Date();

        console.log(`- Migrating catalogue: "${catName}" (${catId})...`);

        // Resolve or create catalog in catalogues table
        let dbCatalogId = catId;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = uuidRegex.test(catId);

        if (!isValidUuid) {
          // If the ID is a 5-digit number or "default", we must insert it into catalogues.
          // Wait! Since catalogues.id is a UUID, we must generate a new UUID or use a deterministic UUID,
          // or just generate a random UUID and register it!
          // Let's generate a random UUID.
          const uuidRes = await pool.query(
            "INSERT INTO catalogues (user_id, name, created_at) VALUES ($1, $2, $3) RETURNING id",
            [userId, catName, catTimestamp]
          );
          dbCatalogId = uuidRes.rows[0].id;
        } else {
          // If it is already a UUID, insert it directly
          await pool.query(
            "INSERT INTO catalogues (id, user_id, name, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING id",
            [dbCatalogId, userId, catName, catTimestamp]
          );
        }

        console.log(`  ✓ Database Catalogue ID resolved: ${dbCatalogId}`);

        // Read specific catalog items file
        const itemsFile = path.join(userFolder, "catalogs", `${catId}.json`);
        if (!fs.existsSync(itemsFile)) {
          console.log(`  No items JSON file found for catalog "${catName}" at path ${itemsFile}. Skipping items.`);
          continue;
        }

        const itemsRaw = fs.readFileSync(itemsFile, "utf-8");
        const items = JSON.parse(itemsRaw || "[]");
        console.log(`  Found ${items.length} history items to import.`);

        if (items.length > 0) {
          await saveCatalogueItems(userId, dbCatalogId, items);
          console.log(`  ✓ Successfully migrated ${items.length} items to database.`);
        }
      }
    } catch (err) {
      console.error(`❌ Failed to migrate catalogues for ${email}:`, err);
    }
  }

  console.log("\n=== DATA MIGRATION COMPLETED SUCCESSFULLY ===");
  await pool.end();
  process.exit(0);
}

migrate().catch(async (err) => {
  console.error("❌ Migration failed with error:", err);
  await pool.end();
  process.exit(1);
});
