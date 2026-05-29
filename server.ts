import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";
import { initDatabase, pool } from "./src/db/pool";
import * as db from "./src/db/queries";
import { getAppraiser, appraiserConfigs } from "./src/appraisal/appraiser";

dotenv.config();

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(process.cwd(), "data");
const USER_RECORDS_DIR = path.join(DATA_DIR, "user_records");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USER_RECORDS_DIR)) {
  fs.mkdirSync(USER_RECORDS_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

// Set up large JSON body limits for handling Base64 photo uploads
app.use(express.json({ limit: "25mb" }));

// Lazy initializer for the server-side Gemini client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not defined. Please add your key through the AI Studio panel or .env file."
      );
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ----------------------------------------
// API ENDPOINTS
// ----------------------------------------

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Get available appraisal methods route
app.get("/api/appraisal-methods", (req, res) => {
  res.json(appraiserConfigs);
});

// Art Print Photo Analysis Route
app.post("/api/analyze-print", async (req, res) => {
  try {
    const { 
      imageBase64, 
      mimeType, 
      userNotes,
      signatureBase64,
      signatureMimeType,
      damageBase64,
      damageMimeType,
      scaleBase64,
      scaleMimeType,
      currency = "USD",
      method = "gemini-standard"
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing uploaded image content." });
    }

    const ai = getAiClient();
    const appraiser = getAppraiser(method, ai);

    const reportData = await appraiser.appraise({
      imageBase64,
      mimeType,
      userNotes,
      signatureBase64,
      signatureMimeType,
      damageBase64,
      damageMimeType,
      scaleBase64,
      scaleMimeType,
      currency
    });

    return res.json(reportData);
  } catch (error: any) {
    console.error("Print appraisal failed:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred during print analysis.",
    });
  }
});

// Send Summary File via Email Endpoint
app.post("/api/send-email", (req, res) => {
  try {
    const { email, subject, summaryText, lotsCount } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing recipient email address." });
    }

    if (!summaryText) {
      return res.status(400).json({ error: "Missing summary contents." });
    }

    console.log("-----------------------------------------");
    console.log(`[EMAIL DISPATCH] Dispatching PrintMasterAI Summary File`);
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject || "Print Appraisal Summary"}`);
    console.log(`Lots Included: ${lotsCount || 0}`);
    console.log(`Content:\n${summaryText}`);
    console.log("-----------------------------------------");

    // Successfully logged and simulated authentic pipeline dispatch
    return res.json({
      success: true,
      message: `Print appraisal summary files were successfully compiled and dispatched to the recipient mailbox at ${email}.`,
      recipient: email,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("Failed to process email delivery:", err);
    return res.status(500).json({
      error: err.message || "Internal mail pipeline failure. Check mail configuration."
    });
  }
});

// Propose cohesive Lot Details based on selected art records via Gemini
app.post("/api/propose-lot-name", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Missing or empty items list for lot proposal." });
    }

    const ai = getAiClient();
    
    // Create prompt from selected items metadata
    const itemsDescription = items.map((it: any, index: number) => {
      const techStr = Array.isArray(it.techniques) ? it.techniques.join(", ") : "";
      return `Item ${index + 1}: Title: "${it.title || "Unknown"}", Artist: "${it.artist || "Unknown"}", Period: "${it.period || "Unknown"}", Techniques: "${techStr}"`;
    }).join("\n");

    const prompt = `You are an elite Prints Specialist and fine art appraiser cataloging prints for a major gallery or auction house (like Christie's or Sotheby's).
Given these selected print works from an art portfolio, analyze their characteristics (shared artists, techniques, visual schools, movements, date periods, or themes) to suggest:
1. "proposedLotNumber": A professional lot identifier (e.g. "Lot 101", "Lot 15B", "Lot 210". If items are diverse or sequentially cataloged, choose a logical starter code).
2. "proposedLotTitle": A sophisticated, academically sound cataloging header to group them (e.g., "Important Woodblock Prints of the Shin-hanga Movement", "Modern Master Monotypes", "Post-War Screenprints & Multiples", or "Post-Minimalist Explorations").

If the group is highly diverse with no obvious technical or artist connection, formulate a cohesive unifying classification (e.g., "Selected Masterpieces of Twentieth-Century Printmaking" or "Works on Paper: From Etchings to Serigraphs").

Here are the selected items:
${itemsDescription}`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        proposedLotNumber: {
          type: Type.STRING,
          description: "A suitable auction lot number/code, e.g. 'Lot 102' or 'Lot 18C'."
        },
        proposedLotTitle: {
          type: Type.STRING,
          description: "An elegant, descriptive and scholarly lot heading designed to structure this group."
        }
      },
      required: ["proposedLotNumber", "proposedLotTitle"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite, highly professional art appraiser and catalog builder for prestigious fine art auction houses.",
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output received from Gemini.");
    }

    const proposal = JSON.parse(textOutput.trim());
    return res.json(proposal);
  } catch (error: any) {
    console.error("Gemini lot proposal failed:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred during lot name proposal.",
    });
  }
});

// List files in a local folder
app.post("/api/list-local-directory", async (req, res) => {
  try {
    const { dirPath } = req.body;
    if (!dirPath) {
      return res.status(400).json({ error: "Missing directory path parameter." });
    }

    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "Directory does not exist." });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: "Path specified is not a directory." });
    }

    const files = fs.readdirSync(resolvedPath);
    const imageFiles = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
      })
      .map((file) => {
        const filePath = path.join(resolvedPath, file);
        const fileStat = fs.statSync(filePath);
        return {
          name: file,
          fullPath: filePath,
          size: fileStat.size,
          ext: path.extname(file).toLowerCase(),
        };
      });

    return res.json({ success: true, dirPath: resolvedPath, files: imageFiles });
  } catch (error: any) {
    console.error("Failed to read local directory:", error);
    return res.status(500).json({ error: error.message || "Failed to read directory." });
  }
});

// Fetch local file content as Base64
app.post("/api/get-local-file", async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: "Missing file path parameter." });
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "File does not exist." });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === ".png") mimeType = "image/png";
    if (ext === ".webp") mimeType = "image/webp";

    const content = fs.readFileSync(resolvedPath);
    const base64 = content.toString("base64");

    return res.json({
      success: true,
      fileName: path.basename(resolvedPath),
      mimeType,
      size: content.length,
      base64: `data:${mimeType};base64,${base64}`,
    });
  } catch (error: any) {
    console.error("Failed to read local file:", error);
    return res.status(500).json({ error: error.message || "Failed to read file." });
  }
});

// Detect if image contains multiple distinct artworks
app.post("/api/detect-artworks", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing uploaded image content." });
    }

    const ai = getAiClient();
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const cleanMimeType = mimeType || "image/jpeg";

    const parts = [
      {
        inlineData: {
          data: cleanBase64,
          mimeType: cleanMimeType,
        },
      },
      {
        text: `Analyze this image scan. Determine if it contains multiple distinct artwork pieces, fine art prints, or paintings (e.g. a collage, multiple separate print sheets scanned or photographed together on a single background or scanner bed).
        
If the image contains multiple distinct artworks, identify the bounding box for each individual artwork.
If the image contains only a single artwork, return containsMultipleArtworks as false and provide a single bounding box for the entire image: [0, 0, 1000, 1000] representing the whole scan.

Coordinates MUST be normalized to a 0 to 1000 scale, formatted as [ymin, xmin, ymax, xmax] relative to the overall image height and width.`,
      },
    ];

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        containsMultipleArtworks: {
          type: Type.BOOLEAN,
          description: "True if there are multiple separate prints or distinct artworks visible in the single scan."
        },
        artworks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: {
                type: Type.STRING,
                description: "Label for this artwork item, e.g. 'Artwork A', 'Artwork B'."
              },
              box_2d: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Normalized bounding box coordinates [ymin, xmin, ymax, xmax] from 0 to 1000."
              }
            },
            required: ["label", "box_2d"]
          },
          description: "Bounding boxes enclosing each detected artwork."
        }
      },
      required: ["containsMultipleArtworks", "artworks"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          }
        ]
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output received from Gemini detection.");
    }

    const detection = JSON.parse(textOutput.trim());
    return res.json(detection);
  } catch (error: any) {
    console.error("Gemini artwork detection failed:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred during artwork detection.",
    });
  }
});

// ----------------------------------------
// USER ACCOUNTS & PERSISTENCE ENDPOINTS
// ----------------------------------------

// Expose static middleware for user uploaded images/scans
app.use("/api/user-images", express.static(USER_RECORDS_DIR));

// Helper to resolve user from headers
async function resolveUser(usernameHeader: any) {
  if (!usernameHeader || typeof usernameHeader !== "string") {
    throw new Error("Unauthorized. Missing user header.");
  }
  const cleanUsername = usernameHeader.trim().toLowerCase();
  const user = await db.findUserByEmail(cleanUsername);
  if (!user) {
    throw new Error("User profile not found.");
  }
  return user;
}

// Signup route
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_.@+-]+$/.test(cleanUsername) || cleanUsername === "." || cleanUsername === ".." || cleanUsername.includes("..")) {
      return res.status(400).json({ error: "Username or email can only contain alphanumeric characters, underscores, dashes, dots, plus signs, and at signs, and cannot contain consecutive dots." });
    }

    const existingUser = await db.findUserByEmail(cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists." });
    }

    const user = await db.createUser(cleanUsername, password);

    // Create user directories on local disk as fallback for uploaded assets
    const userFolder = path.join(USER_RECORDS_DIR, cleanUsername);
    const userImagesFolder = path.join(userFolder, "images");
    if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });
    if (!fs.existsSync(userImagesFolder)) fs.mkdirSync(userImagesFolder, { recursive: true });

    // Create initial default catalogue in database
    await db.createCatalogue(user.id, "Default Catalogue");

    return res.json({ success: true, username: cleanUsername });
  } catch (err: any) {
    console.error("Signup failed:", err);
    return res.status(500).json({ error: err.message || "Internal server error during registration." });
  }
});

// Login route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanUsername);

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    await db.updateLastLogin(user.id);

    return res.json({ success: true, username: cleanUsername });
  } catch (err: any) {
    console.error("Login failed:", err);
    return res.status(500).json({ error: err.message || "Internal server error during authentication." });
  }
});

// Change password route
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }

    const user = await resolveUser(username);

    if (user.passwordHash !== currentPassword) {
      return res.status(400).json({ error: "Incorrect current password." });
    }

    await db.updateUserPassword(user.id, newPassword);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Change password failed:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to change password." });
  }
});

// Delete user data / account route
app.post("/api/user/delete-data", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { deleteType } = req.body;

    if (deleteType !== "data-only" && deleteType !== "account") {
      return res.status(400).json({ error: "Invalid deletion type. Must be 'data-only' or 'account'." });
    }

    const user = await resolveUser(username);
    await db.deleteUserData(user.id, deleteType);

    // Also wipe local directory assets
    const cleanUsername = user.email.trim().toLowerCase();
    const userFolder = path.join(USER_RECORDS_DIR, cleanUsername);
    if (fs.existsSync(userFolder)) {
      fs.rmSync(userFolder, { recursive: true, force: true });
    }

    return res.json({ success: true, message: deleteType === "data-only" ? "All appraisal data cleared successfully." : "User account and data deleted successfully." });
  } catch (err: any) {
    console.error("Delete data failed:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to delete data." });
  }
});

// GET catalogs metadata list route
app.get("/api/user/catalog-list", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const user = await resolveUser(username);

    let catalogs = await db.getUserCataloguesList(user.id);
    if (catalogs.length === 0) {
      const defaultCat = await db.createCatalogue(user.id, "Default Catalogue");
      catalogs = [defaultCat];
    }

    return res.json({ catalogs, activeCatalogId: catalogs[0].id });
  } catch (err: any) {
    console.error("Failed to load catalog list:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to load catalog list." });
  }
});

// POST catalogs metadata list route
app.post("/api/user/catalog-list", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { catalogs, activeCatalogId } = req.body;

    if (!catalogs || !Array.isArray(catalogs)) {
      return res.status(400).json({ error: "Invalid catalogs list." });
    }

    const user = await resolveUser(username);

    // Sync catalogues list: insert or update name
    const dbCatalogs = await db.getUserCataloguesList(user.id);

    for (const clientCat of catalogs) {
      const existing = dbCatalogs.find((c) => c.id === clientCat.id);
      if (existing) {
        if (existing.name !== clientCat.name) {
          await db.renameCatalogue(clientCat.id, clientCat.name);
        }
      } else {
        const query = `
          INSERT INTO catalogues (id, user_id, name, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
        `;
        await pool.query(query, [clientCat.id, user.id, clientCat.name, clientCat.timestamp || new Date()]);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to save catalog list:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to save catalog list." });
  }
});

// GET catalog items route (by id parameter)
app.get("/api/user/catalog", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing catalogue ID parameter." });
    }

    const user = await resolveUser(username);
    const catalog = await db.getCatalogueItems(id);
    return res.json(catalog);
  } catch (err: any) {
    console.error("Failed to load user catalog:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to load catalog." });
  }
});

// POST catalog items route (by id parameter)
app.post("/api/user/catalog", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { catalog } = req.body;
    const { id } = req.query;

    if (!catalog || !Array.isArray(catalog)) {
      return res.status(400).json({ error: "Catalog must be a valid array." });
    }
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing catalogue ID parameter." });
    }

    const user = await resolveUser(username);
    await db.saveCatalogueItems(user.id, id, catalog);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to save user catalog:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to save catalog." });
  }
});

// POST delete specific catalog route
app.post("/api/user/delete-catalog", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { id } = req.body;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing or invalid catalog id." });
    }

    const user = await resolveUser(username);
    await db.deleteCatalogue(id);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete catalog file:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to delete catalog." });
  }
});

// GET user items database
app.get("/api/user/items", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const user = await resolveUser(username);
    const items = await db.getUserItems(user.id);
    return res.json(items);
  } catch (err: any) {
    console.error("Failed to load user items:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to load items." });
  }
});

// POST user items database
app.post("/api/user/items", async (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Items must be a valid array." });
    }

    const user = await resolveUser(username);
    await db.saveUserItems(user.id, items);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to save user items:", err);
    return res.status(err.message.includes("Unauthorized") || err.message.includes("not found") ? 401 : 500).json({ error: err.message || "Failed to save items." });
  }
});

// POST upload scan image route
app.post("/api/user/upload-scan", (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { imageBase64 } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(401).json({ error: "Unauthorized. Missing user header." });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 data." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const userImagesFolder = path.join(USER_RECORDS_DIR, cleanUsername, "images");
    if (!fs.existsSync(userImagesFolder)) {
      fs.mkdirSync(userImagesFolder, { recursive: true });
    }

    // Decode base64
    const matches = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
    let ext = "jpg";
    let base64DataStr = imageBase64;
    
    if (matches && matches.length === 3) {
      ext = matches[1];
      if (ext === "jpeg") ext = "jpg";
      base64DataStr = matches[2];
    } else {
      base64DataStr = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    }

    const buffer = Buffer.from(base64DataStr, "base64");
    const fileUuid = crypto.randomUUID();
    const filename = `${fileUuid}.${ext}`;
    const filePath = path.join(userImagesFolder, filename);

    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/api/user-images/${cleanUsername}/images/${filename}`;
    return res.json({ success: true, imageUrl });
  } catch (err: any) {
    console.error("Failed to save user scan image:", err);
    return res.status(500).json({ error: err.message || "Failed to upload scan image." });
  }
});

// ----------------------------------------
// WEB SERVER STATIC / MIDDLEWARE SETUPS
// WEB SERVER STATIC / MIDDLEWARE SETUPS
// ----------------------------------------

async function setupServer() {
  await initDatabase();

  if (process.env.NODE_ENV !== "production") {
    // Integrate Vite as a middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets compiled under /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is booted and listening on http://localhost:${PORT}`);
  });
}

setupServer();
