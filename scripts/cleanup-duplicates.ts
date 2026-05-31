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

const extractOriginalFilename = (fileName: string): string => {
  if (!fileName) return "";
  const primaryIdx = fileName.indexOf("_Primary_Artwork");
  if (primaryIdx !== -1) {
    return fileName.substring(0, primaryIdx);
  }
  const artworkIdx = fileName.indexOf("_Artwork_");
  if (artworkIdx !== -1) {
    return fileName.substring(0, artworkIdx);
  }
  return fileName;
};

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(`=== DATABASE DUPLICATE CLEANUP (${commit ? "COMMIT MODE" : "DRY RUN MODE"}) ===`);

  try {
    // 1. Fetch all active items, images, and appraisals
    const query = `
      SELECT
        it.id AS item_id,
        it.user_id,
        it.lot_id,
        it.catalogue_id,
        it.created_at AS item_created_at,
        i.storage_key AS image_url,
        i.original_filename AS image_file_name,
        a.id AS appraisal_id,
        a.created_at AS appraisal_created_at,
        a.result AS report
      FROM items it
      LEFT JOIN images i ON i.item_id = it.id AND i.image_type = 'primary'
      LEFT JOIN appraisals a ON a.item_id = it.id AND a.status = 'complete'
      WHERE it.deleted_at IS NULL
      ORDER BY it.created_at ASC;
    `;
    const res = await pool.query(query);
    console.log(`Found ${res.rows.length} total active items in the database.`);

    // 2. Group items by user_id + original_filename + appraisal method (prompt version + model used)
    const groups: Record<string, any[]> = {};
    for (const row of res.rows) {
      if (!row.image_file_name) continue;
      const origName = extractOriginalFilename(row.image_file_name).toLowerCase();
      
      const report = row.report || {};
      const approach = report.promptVersion || "standard";
      const model = report.modelUsed || "gemini-2.5-flash";
      const methodKey = `${approach}-${model}`.toLowerCase();

      const groupKey = `${row.user_id}_${origName}_${methodKey}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(row);
    }

    let duplicateCount = 0;
    let itemsToSoftDelete: string[] = [];
    const updatesToPerform: { itemId: string; catalogueId: string | null; lotId: string | null }[] = [];

    // 3. For each group, find duplicates
    for (const [key, group] of Object.entries(groups)) {
      if (group.length <= 1) continue;

      console.log(`\nDuplicate Group: ${key}`);
      console.log(`Contains ${group.length} records:`);
      group.forEach((item, idx) => {
        console.log(`  [${idx}] ItemID: ${item.item_id}, ImgName: ${item.image_file_name}, Catalog: ${item.catalogue_id || "None"}, Lot: ${item.lot_id || "None"}, Appraised At: ${item.appraisal_created_at}`);
      });

      // Selection rules for keeping:
      // - Prioritize item that has a catalogue_id
      // - Prioritize item that has a lot_id
      // - Otherwise keep the earliest (first in order by created_at)
      let keepIndex = 0;
      for (let i = 0; i < group.length; i++) {
        const currentBest = group[keepIndex];
        const candidate = group[i];
        
        const currentScore = (currentBest.catalogue_id ? 2 : 0) + (currentBest.lot_id ? 1 : 0);
        const candidateScore = (candidate.catalogue_id ? 2 : 0) + (candidate.lot_id ? 1 : 0);

        if (candidateScore > currentScore) {
          keepIndex = i;
        }
      }

      const keptItem = group[keepIndex];
      console.log(`--> KEEPING: [${keepIndex}] ItemID: ${keptItem.item_id}`);

      // We might want to merge catalog/lot info from duplicates if the kept item lacks it
      let finalCatalogId = keptItem.catalogue_id;
      let finalLotId = keptItem.lot_id;

      for (let i = 0; i < group.length; i++) {
        if (i === keepIndex) continue;
        const dupItem = group[i];
        duplicateCount++;
        itemsToSoftDelete.push(dupItem.item_id);

        if (!finalCatalogId && dupItem.catalogue_id) {
          finalCatalogId = dupItem.catalogue_id;
        }
        if (!finalLotId && dupItem.lot_id) {
          finalLotId = dupItem.lot_id;
        }
      }

      if (finalCatalogId !== keptItem.catalogue_id || finalLotId !== keptItem.lot_id) {
        updatesToPerform.push({
          itemId: keptItem.item_id,
          catalogueId: finalCatalogId,
          lotId: finalLotId
        });
        console.log(`--> MERGING metadata to kept item: Catalog: ${finalCatalogId}, Lot: ${finalLotId}`);
      }
    }

    console.log(`\n=== CLEANUP SUMMARY ===`);
    console.log(`Total duplicate items identified to soft-delete: ${duplicateCount}`);
    console.log(`Total items to update/merge metadata: ${updatesToPerform.length}`);

    if (commit) {
      if (duplicateCount > 0 || updatesToPerform.length > 0) {
        console.log("\nExecuting cleanup queries...");
        
        // Start transaction
        await pool.query("BEGIN");

        // A. Update items where metadata is merged
        for (const update of updatesToPerform) {
          await pool.query(
            "UPDATE items SET catalogue_id = $1, lot_id = $2 WHERE id = $3",
            [update.catalogueId, update.lotId, update.itemId]
          );
        }

        // B. Soft-delete duplicate items
        if (itemsToSoftDelete.length > 0) {
          const deleteQuery = `
            UPDATE items
            SET deleted_at = NOW()
            WHERE id = ANY($1::uuid[]);
          `;
          await pool.query(deleteQuery, [itemsToSoftDelete]);
        }

        await pool.query("COMMIT");
        console.log("✓ Cleanup successfully committed to PostgreSQL database.");
      } else {
        console.log("No actions needed.");
      }
    } else {
      console.log("\nDry run completed. No changes were made to the database.");
      console.log("To apply these changes, re-run with: npx tsx scripts/cleanup-duplicates.ts --commit");
    }

  } catch (err) {
    console.error("❌ Cleanup failed:", err);
  } finally {
    await pool.end();
  }
}

main();
