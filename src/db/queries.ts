import { pool } from "./pool";
import { AnalysisHistoryItem, PrintAnalysisReport } from "../types";

// User Authentication
export async function findUserByEmail(email: string) {
  const query = `
    SELECT id, email, name, password_hash AS "passwordHash", created_at AS "createdAt", last_login_at AS "lastLoginAt"
    FROM users
    WHERE email = $1;
  `;
  const res = await pool.query(query, [email.trim().toLowerCase()]);
  return res.rows[0] || null;
}

export async function createUser(email: string, passwordHash: string, name?: string) {
  const query = `
    INSERT INTO users (email, password_hash, name)
    VALUES ($1, $2, $3)
    RETURNING id, email, name;
  `;
  const res = await pool.query(query, [email.trim().toLowerCase(), passwordHash, name]);
  return res.rows[0];
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  const query = `
    UPDATE users
    SET password_hash = $1
    WHERE id = $2;
  `;
  await pool.query(query, [passwordHash, userId]);
}

export async function updateLastLogin(userId: string) {
  const query = `
    UPDATE users
    SET last_login_at = NOW()
    WHERE id = $1;
  `;
  await pool.query(query, [userId]);
}

// Catalogues Registry
export async function getUserCataloguesList(userId: string) {
  const query = `
    SELECT id, name, created_at AS "createdAt"
    FROM catalogues
    WHERE user_id = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC;
  `;
  const res = await pool.query(query, [userId]);
  // Map PostgreSQL model to frontend expected format
  return res.rows.map((row) => ({
    id: row.id,
    name: row.name,
    timestamp: row.createdAt.toISOString(),
  }));
}

export async function createCatalogue(userId: string, name: string) {
  const query = `
    INSERT INTO catalogues (user_id, name)
    VALUES ($1, $2)
    RETURNING id, name, created_at AS "createdAt";
  `;
  const res = await pool.query(query, [userId, name]);
  return {
    id: res.rows[0].id,
    name: res.rows[0].name,
    timestamp: res.rows[0].createdAt.toISOString(),
  };
}

export async function renameCatalogue(catalogueId: string, name: string) {
  const query = `
    UPDATE catalogues
    SET name = $1
    WHERE id = $2 AND deleted_at IS NULL;
  `;
  await pool.query(query, [name, catalogueId]);
}

export async function deleteCatalogue(catalogueId: string) {
  const query = `
    UPDATE catalogues
    SET deleted_at = NOW()
    WHERE id = $1;
  `;
  await pool.query(query, [catalogueId]);
}

// Fetch Items for a Catalog
export async function getCatalogueItems(catalogueId: string): Promise<AnalysisHistoryItem[]> {
  const query = `
    SELECT
      i.id AS item_id,
      a.id AS appraisal_id,
      a.created_at AS timestamp,
      i.storage_key AS image_url,
      i.original_filename AS image_file_name,
      i.file_size_bytes AS file_size,
      a.result AS report,
      l.id AS lot_id,
      l.name AS lot_number,
      l.description AS lot_title
    FROM catalogue_lots cl
    JOIN lots l ON l.id = cl.lot_id
    JOIN images i ON i.lot_id = l.id
    JOIN appraisals a ON a.image_id = i.id
    WHERE cl.catalogue_id = $1 AND l.deleted_at IS NULL
    ORDER BY cl.position ASC, i.position ASC, a.created_at DESC;
  `;
  const res = await pool.query(query, [catalogueId]);
  
  const items: AnalysisHistoryItem[] = [];
  for (const row of res.rows) {
    // Fetch visual evidence highlights (cropped appraisal images)
    const imgQuery = `
      SELECT storage_key, description
      FROM appraisal_images
      WHERE appraisal_id = $1;
    `;
    const imgRes = await pool.query(imgQuery, [row.appraisal_id]);
    
    let signatureImageUrl: string | undefined;
    let damageImageUrl: string | undefined;
    let scaleImageUrl: string | undefined;

    for (const img of imgRes.rows) {
      if (img.description === "signature") signatureImageUrl = img.storage_key;
      else if (img.description === "damage") damageImageUrl = img.storage_key;
      else if (img.description === "scale") scaleImageUrl = img.storage_key;
    }

    items.push({
      id: row.item_id,
      timestamp: new Date(row.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      imageUrl: row.image_url,
      imageFileName: row.image_file_name,
      imageSize: "Split Scan Crop",
      report: row.report as PrintAnalysisReport,
      lotNumber: row.lot_number || undefined,
      lotTitle: row.lot_title || undefined,
      signatureImageUrl,
      damageImageUrl,
      scaleImageUrl,
    });
  }

  return items;
}

// Save/Sync Items for a Catalog
export async function saveCatalogueItems(userId: string, catalogueId: string, items: AnalysisHistoryItem[]) {
  // We use a transaction to ensure atomic updates
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Clear existing junction records for the catalogue
    await client.query("DELETE FROM catalogue_lots WHERE catalogue_id = $1", [catalogueId]);

    // Track processed lots to avoid duplicate inserts/junctions
    const processedLots = new Set<string>();

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];

      // 2. Resolve or Create the Lot
      let lotId: string;
      
      // If the item has a custom lot number, check if we've already created it
      if (item.lotNumber) {
        const checkLotQuery = `
          SELECT id FROM lots 
          WHERE user_id = $1 AND name = $2 AND deleted_at IS NULL;
        `;
        const lotRes = await client.query(checkLotQuery, [userId, item.lotNumber]);
        if (lotRes.rows.length > 0) {
          lotId = lotRes.rows[0].id;
        } else {
          const insertLotQuery = `
            INSERT INTO lots (user_id, name, description)
            VALUES ($1, $2, $3)
            RETURNING id;
          `;
          const insertLotRes = await client.query(insertLotQuery, [userId, item.lotNumber, item.lotTitle || null]);
          lotId = insertLotRes.rows[0].id;
        }
      } else {
        // Create an individual/standalone lot for this standalone item
        const insertLotQuery = `
          INSERT INTO lots (user_id, name, description)
          VALUES ($1, $2, $3)
          RETURNING id;
        `;
        const insertLotRes = await client.query(insertLotQuery, [userId, null, null]);
        lotId = insertLotRes.rows[0].id;
      }

      // 3. Link Lot to Catalogue (if not already linked)
      const junctionKey = `${catalogueId}_${lotId}`;
      if (!processedLots.has(junctionKey)) {
        const insertJunctionQuery = `
          INSERT INTO catalogue_lots (catalogue_id, lot_id, position)
          VALUES ($1, $2, $3)
          ON CONFLICT (catalogue_id, lot_id) DO NOTHING;
        `;
        await client.query(insertJunctionQuery, [catalogueId, lotId, idx]);
        processedLots.add(junctionKey);
      }

      // 4. Save/Verify Image Record
      // Check if image exists
      const checkImgQuery = `SELECT id FROM images WHERE id = $1;`;
      let imageId = item.id;
      
      // If client-provided ID is not a valid UUID (e.g. from guest fallback), we use a random UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUuid = uuidRegex.test(imageId);

      if (!isValidUuid) {
        // Generate new UUID for storage
        const uuidRes = await client.query("SELECT gen_random_uuid() AS uuid;");
        imageId = uuidRes.rows[0].uuid;
        // Also update item's ID in the local memory list so it is returned correctly
        item.id = imageId;
      }

      const imgRes = await client.query(checkImgQuery, [imageId]);
      
      if (imgRes.rows.length === 0) {
        // Insert new image
        const insertImgQuery = `
          INSERT INTO images (id, user_id, lot_id, storage_key, original_filename, position)
          VALUES ($1, $2, $3, $4, $5, $6);
        `;
        await client.query(insertImgQuery, [
          imageId,
          userId,
          lotId,
          item.imageUrl || "",
          item.imageFileName || null,
          idx
        ]);
      } else {
        // Update existing image lot and order position
        const updateImgQuery = `
          UPDATE images
          SET lot_id = $1, position = $2
          WHERE id = $3;
        `;
        await client.query(updateImgQuery, [lotId, idx, imageId]);
      }

      // 5. Save/Verify Appraisal Record
      const checkAppQuery = `SELECT id FROM appraisals WHERE image_id = $1;`;
      const appRes = await client.query(checkAppQuery, [imageId]);
      
      let appraisalId: string;
      if (appRes.rows.length === 0) {
        const insertAppQuery = `
          INSERT INTO appraisals (image_id, model_name, result, status, completed_at)
          VALUES ($1, $2, $3, 'complete', NOW())
          RETURNING id;
        `;
        const insertAppRes = await client.query(insertAppQuery, [
          imageId,
          "gemini-2.5-flash",
          JSON.stringify(item.report)
        ]);
        appraisalId = insertAppRes.rows[0].id;
      } else {
        appraisalId = appRes.rows[0].id;
        const updateAppQuery = `
          UPDATE appraisals
          SET result = $1
          WHERE id = $2;
        `;
        await client.query(updateAppQuery, [JSON.stringify(item.report), appraisalId]);
      }

      // 6. Save/Verify Appraisal Detail Highlights (signature, damage, scale crops)
      // Wipe existing highlights and re-insert to keep it simple and clean
      await client.query("DELETE FROM appraisal_images WHERE appraisal_id = $1", [appraisalId]);
      
      if (item.signatureImageUrl) {
        const insertHighlight = `
          INSERT INTO appraisal_images (appraisal_id, storage_key, description)
          VALUES ($1, $2, 'signature');
        `;
        await client.query(insertHighlight, [appraisalId, item.signatureImageUrl]);
      }
      if (item.damageImageUrl) {
        const insertHighlight = `
          INSERT INTO appraisal_images (appraisal_id, storage_key, description)
          VALUES ($1, $2, 'damage');
        `;
        await client.query(insertHighlight, [appraisalId, item.damageImageUrl]);
      }
      if (item.scaleImageUrl) {
        const insertHighlight = `
          INSERT INTO appraisal_images (appraisal_id, storage_key, description)
          VALUES ($1, $2, 'scale');
        `;
        await client.query(insertHighlight, [appraisalId, item.scaleImageUrl]);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to save catalog items database transaction:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Purge User Data or Account Details
export async function deleteUserData(userId: string, deleteType: "data-only" | "account") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (deleteType === "data-only") {
      // Deletes all lots, images, and appraisals by deleting catalogues and lots
      await client.query("DELETE FROM catalogues WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM lots WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM images WHERE user_id = $1", [userId]);
    } else {
      // Delete user profile entirely (ON DELETE CASCADE deletes catalogues, lots, etc. automatically)
      await client.query("DELETE FROM users WHERE id = $1", [userId]);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Failed to execute user deletion type ${deleteType}:`, err);
    throw err;
  } finally {
    client.release();
  }
}
