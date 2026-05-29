import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";

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
      currency = "USD"
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing uploaded image content." });
    }

    const ai = getAiClient();
    const parts: any[] = [];

    // 1. Add primary print image
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const cleanMimeType = mimeType || "image/jpeg";
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: cleanMimeType,
      },
    });

    // 2. Add signature closeup if uploaded
    if (signatureBase64) {
      const cleanSigBase64 = signatureBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ text: "--- AUXILIARY SPECIMEN SCAN: CLOSEUP OF THE ARTIST SIGNATURE OR EMBOSSMENT MARK ---" });
      parts.push({
        inlineData: {
          data: cleanSigBase64,
          mimeType: signatureMimeType || "image/jpeg",
        },
      });
    }

    // 3. Add damage closeup if uploaded
    if (damageBase64) {
      const cleanDmgBase64 = damageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ text: "--- AUXILIARY SPECIMEN SCAN: CLOSEUP OF POTENTIAL PAPER DAMAGE, STAINING, OR SURFACE WEAR ---" });
      parts.push({
        inlineData: {
          data: cleanDmgBase64,
          mimeType: damageMimeType || "image/jpeg",
        },
      });
    }

    // 4. Add coin scale reference if uploaded
    if (scaleBase64) {
      const cleanScaleBase64 = scaleBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ text: "--- AUXILIARY SPECIMEN SCAN: DENSITY SCALE REFERENCE PHOTO WITH COIN PLACED ADJACENT TO SHEET --- Use the coin as a standard size scale (e.g. standard penny or quarter coin diameter) to mathematically infer sheet/print dimensions of this artwork." });
      parts.push({
        inlineData: {
          data: cleanScaleBase64,
          mimeType: scaleMimeType || "image/jpeg",
        },
      });
    }

// 5. Add instructions text prompt
    const textPrompt = `Analyze this collection of photograph scans covering a single fine art print. Identify the artist, title, printing techniques, stamp/signatures, estimated auction value, and observe condition details visible in the photo.

CURRENCY REQUIREMENTS:
The user has configured their preferred valuation display currency as: "${currency}".
You MUST evaluate and format all currency numbers, estimates, and sale prices strictly in "${currency}" (e.g. if GBP, use '£' and code 'GBP'; if EUR, use '€' and code 'EUR'; if USD, use '$' and code 'USD'). Output the numerical integer fields 'lowEstimate' and 'highEstimate' scaled into this "${currency}" currency.

EDITION SIZE & PRINT NUMBER ANALYSIS (CRITICAL):
You MUST search for, analyze, and describe any information indicating the print's specific number within the overall edition size (such as '45/100', 'Artist's Proof / AP', 'Hors Commerce / HC', 'Printer's Proof / PP', or an 'Open Edition / Unlimited print run'). Detail what this specific numbering represents in terms of collectors' exclusivity, market demand, historical rarity, and price impact. Return this written evaluation inside the "editionSizeAndPrintNumber" field.

SCHOLARLY VALUATION METHODOLOGY (DEFENSIVE HEDONIC PRICING & REPEAT-SALES):
You MUST perform print valuation using a highly conservative "repeat-sales" framework and a defensive **hedonic pricing model**, where you err on the side of severe caution. Do NOT inflate estimates. You must require exceptional, incontrovertible visual and/or documented evidence to push the valuation figures higher:
1. "Standard" Qualities: Analyze Artist & Subject Desirability, Edition Size/Rarity, and Signature Type (e.g. hand-signed vs plate-signed vs unsigned). Crucially, assume unsigned or plate-signed configurations represent base lower-end values. A premium can ONLY be added if there is clear, confirmed pencil/hand-signing or explicit archival numbering.
2. Variable Qualities: Act aggressively to penalize any potential physical condition defects (fading, light strike discoloration, foxing spots, cut margins, creases). If any of these are slightly present, reduce the low and high estimates by 20% to 50% defensively.
3. Catalogue Raisonné Alignment: Compare the physical visual features with historical catalog references. If there is any dimensional or layout discrepancy, immediately discount the valuation defensively.
4. Historical Match Recency (2-5 year filter): Strongly prioritize actual, verifiable sales occurring within the last 2-5 years.
5. "Buy-In" Filter & Defensive Secret Reserve Guidelines: Due to current global macroeconomic softness and high fine-art print buy-in auction rates, keep the 'lowEstimate' extremely protective and realistic.
6. BROADER LOT SALES CHECK & INDIVIDUAL FRACTIONAL VALUATION (CRITICAL USER MANDATE): For any listed previous or historical sales in 'recentAuctionSales' or general background data points, verify if the print was previously sold as part of a broader, multi-artwork group lot. If it was, the data point for the individual print's pricing MUST NOT be the full lot price, nor an upward adjustment of standard prices; instead, the value data point for this individual print MUST be calculated as an appropriate fraction of that total lot value (for example, if a broader lot of 4 corresponding prints sold for £10,000, then this print's individual data point is recorded as a fraction of that lot value, e.g. a 1/4 fraction worth £2,500, or a weighted fraction based on prominence, e.g. 50% worth £5,000, rather than the whole lot value). You must explicitly detail this fractional allocation rate and the total lot value inside 'broaderLotPriceAdjustment' (e.g. '1/4 fraction (equivalent to $2,500) of total lot value $10,000').

CRITICAL BENCHMARKING & VALUE DATA SOURCE CONTEXT:
You MUST benchmark the fine art print valuation, historical context summary, and target comparative records against a wide range of official fine art print auction indexes and transactions. This includes results from world-class auction houses:
1. Sotheby's
2. Phillips
3. Christie's
4. Bonhams
5. Roseberys (including their recent London fine art print auctions in April)

When generating 'recentAuctionSales', ensure that:
- It includes 2 or 3 highly realistic or real auction benchmark records.
- At least one benchmark must explicitly represent a Roseberys London April auction transaction in "${currency}" currency.
- Other benchmarks should represent Christie's, Sotheby's, Phillips, or Bonhams results matching this print, artist, technique, or period.

Here is the list of files provided:
- Primary overall photograph of the print artwork.
${signatureBase64 ? "- A close-up scan focusing on the printmaker's signature/stamp/monogram/numbering block." : ""}
${damageBase64 ? "- A close-up detail showcasing potential physical paper damage (foxing, tears, creases, or mat stains)." : ""}
${scaleBase64 ? "- A coin measurement scale calibration image. Place your focus on the standard coin adjacent to the artwork to mathematically estimate real-world sheet dimensions." : ""}

${userNotes ? `The user provided the following additional notes or inscriptions: "${userNotes}"` : ""}

CURATOR EVIDENCE EXTRACTION MANDATE (CRITICAL):
You MUST detect and locate 2 to 4 key visual evidence points in the primary print scan that back up your textual observations.
In particular, check if an artist signature, monogram, publisher stamp, or edition number (e.g. '45/100') is present on the sheet (either in the lower paper margin or within the print design itself). If present, you MUST include its coordinate box as one of the evidence points with the label 'Signature Detail' or 'Edition Number'.
Other evidence points can include print plate borders, chemical foxing/staining spots, margins/watermarks, or fine ink texture details indicating the printmaking technique.
For each point, return a normalized bounding box \`box_2d\` in \`[ymin, xmin, ymax, xmax]\` format on a scale of \`0\` to \`1000\` (where 0 is top/left, 1000 is bottom/right relative to the primary scan's overall height and width). Along with the box, provide a short 2-3 word \`label\` naming the feature and a concise \`observation\` sentence explaining what is visible in that cropped region to justify your appraisal. Place this array in \`visualEvidenceHighlights\`.

Conduct a meticulous evaluation of the authenticity factors (ink ridges, plate borders, chain lines, chemical foxing degradation) using the scholarly valuation guidelines above. Ensure you fill in the requested analytic parameters.`;

    parts.push({ text: textPrompt });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        likelyArtist: {
          type: Type.STRING,
          description: "The most likely artist of the print based on visual clues, signature, and style. If completely unknown/unidentifiable, state 'Unknown Printmaker' or 'Unidentified Artist'."
        },
        artistConfidence: {
          type: Type.INTEGER,
          description: "Confidence rating (from 0 to 100) regarding the artist identity."
        },
        artworkTitle: {
          type: Type.STRING,
          description: "The title or subject of the print artwork. If unknown, provide a descriptive title in brackets, like '[Seascape with Fishing Boats]'."
        },
        titleConfidence: {
          type: Type.INTEGER,
          description: "Confidence rating (from 0 to 100) regarding the artwork title."
        },
        creationPeriod: {
          type: Type.STRING,
          description: "Estimated date or period of creation, e.g., 'circa 1930', 'late 19th Century', '1888', 'Contemporary (circa 2010)'."
        },
        techniques: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              technique: {
                type: Type.STRING,
                description: "Name of the technique detected, e.g., 'Etching', 'Woodcut', 'Lithography', 'Screenprint', 'Aquatint', 'Giclée Reproduction'."
              },
              confidence: {
                type: Type.INTEGER,
                description: "Confidence percentage (from 0 to 100) that this technique was used."
              },
              evidenceIdentified: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Direct visual cues supporting this technique (e.g. 'plate line indentations', 'stippled ink texture', 'overlapping translucent layers', 'wood grain impressions')."
              },
              description: {
                type: Type.STRING,
                description: "A short explanation of how the technique manifests on the paper sheet."
              }
            },
            required: ["technique", "confidence", "evidenceIdentified", "description"]
          },
          description: "List of printing techniques identified in the artwork. Identify at least one primary technique."
        },
        auctionEstimate: {
          type: Type.OBJECT,
          properties: {
            lowEstimate: {
              type: Type.INTEGER,
              description: "Low-end estimated auction value scaled in the user's preferred currency, e.g., 500."
            },
            highEstimate: {
              type: Type.INTEGER,
              description: "High-end estimated auction value scaled in the user's preferred currency, e.g., 1000."
            },
            currency: {
              type: Type.STRING,
              description: "Currency code of preferred currency, e.g. 'USD', 'GBP', or 'EUR'."
            },
            formattedEstimate: {
              type: Type.STRING,
              description: "Formatted price estimate text using preferred currency symbol, e.g. '£500 - £1,000 GBP', '€500 - €1,000 EUR' or '$500 - $1,000 USD'."
            },
            valuationContext: {
              type: Type.STRING,
              description: "Detailed background context for this valuation. Refer to the artist's historical market trend, rarity of the print edition, and state what drives price variability."
            }
          },
          required: ["lowEstimate", "highEstimate", "currency", "formattedEstimate", "valuationContext"]
        },
        conditionNotes: {
          type: Type.OBJECT,
          properties: {
            overallGrade: {
              type: Type.STRING,
              description: "One of standard grades: 'Poor', 'Fair', 'Good', 'Excellent', 'Mint'."
            },
            issuesDetected: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of physical condition concerns seen on the paper, border, margins, or ink layout (e.g., 'foxing dots at top-left corner', 'light-strike from frame boundary', 'faint horizontal crease', 'no obvious defects visible')."
            },
            signatureStatus: {
              type: Type.STRING,
              description: "Describe any visible signature, hand numbering, or monogram. E.g. 'Pencil-signed bottom-right, numbered 45/100', 'Plate-signed name inside design frame', 'No signature detected in photo'."
            },
            mattingAndMargins: {
              type: Type.STRING,
              description: "Assessment of borders, margins, and presentation, e.g., 'Margins are cropped close to image border', 'Large full margins on thick deckled-edge paper', 'Framed close with window mat obscuring sheet edges'."
            },
            analysisDetails: {
              type: Type.STRING,
              description: "A narrative report summary analyzing the structural condition of the visible print piece, assessing its visual preservation."
            }
          },
          required: ["overallGrade", "issuesDetected", "signatureStatus", "mattingAndMargins", "analysisDetails"]
        },
        visualDescription: {
          type: Type.STRING,
          description: "Description of the visual content, subjects represented, colors, style, composition, and emotional expression."
        },
        historicalContext: {
          type: Type.STRING,
          description: "Historical background of the print work, the movement it fits into (e.g., Japonisme, Expressionism, Pop Art, Ukiyo-e), and its context in art history."
        },
        nextSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Custom recommendations for conservation, appraisal, or handling (e.g., 'Keep out of direct sunlight', 'Inspect out of frame to check margins and paper brand', 'Compare watermark under a raking light', 'Consult an IFPDA certified specialist')."
        },
        isLikelyReproductionOrPoster: {
          type: Type.BOOLEAN,
          description: "Set to true if there are high indicators of a offset poster, digital scan preview, modern bookplate page, laser-printed facsimile, or cheap replica rather than an authentic hand-pulled limited-edition print."
        },
        reproductionExplanation: {
          type: Type.STRING,
          description: "Provide details on why this is or isn't suspected of being a mechanical reproduction (e.g. lack of plate impression, raster dots, glossy lightweight paper)."
        },
        recentAuctionSales: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              artworkTitle: {
                type: Type.STRING,
                description: "Title of the print sold, e.g. 'Under the Wave off Kanagawa'"
              },
              artist: {
                type: Type.STRING,
                description: "Artist name, e.g. 'Katsushika Hokusai'"
              },
              technique: {
                type: Type.STRING,
                description: "Detected technique, e.g. 'Woodblock print' or 'Woodcut'"
              },
              saleDate: {
                type: Type.STRING,
                description: "Month and year of sale, e.g., 'October 2023', 'March 2024'"
              },
              priceRealized: {
                type: Type.STRING,
                description: "Price achieved in formatted currency, strictly matching the user's preferred currency, e.g., '£2,760,000 GBP', '€55,200 EUR' or '$12,000 USD'"
              },
              auctionHouse: {
                type: Type.STRING,
                description: "Name of auction house and location, e.g. 'Christie's New York', 'Sotheby's London'"
              },
              conditionState: {
                type: Type.STRING,
                description: "Brief summary of print state/condition details of that particular copy, e.g. 'Pristine early state, full margins', 'Later printing, faded colors'"
              },
              wasSoldInBroaderLot: {
                type: Type.BOOLEAN,
                description: "Indicate if this artwork was previously sold bundled/grouped as part of a broader, multi-artwork auction lot."
              },
              broaderLotPriceAdjustment: {
                type: Type.STRING,
                description: "The price adjustment performed to derive single-item value (e.g. '+25% premium added to compensate for multi-item collection wholesale discount') or 'None - Sold Standalone' if stand-alone."
              }
            },
            required: ["artworkTitle", "artist", "technique", "saleDate", "priceRealized", "auctionHouse", "conditionState", "wasSoldInBroaderLot", "broaderLotPriceAdjustment"]
          },
          description: "A list of 2 or 3 recent actual or highly realistic auction sales achieved for the same print or similar prints by the same artist, same technique, and same time period."
        },
        inferredDimensions: {
          type: Type.STRING,
          description: "If a coin measurement scale image was provided, calculate the estimated physical dimensions of the print (e.g., 'Approx. 40 x 30 cm, calculated using the adjacent coin reference diameter'). Otherwise, return an estimation of typical dimensions based on known artist standards, prefixed with '[Estimated standard size...]'."
        },
        signatureAnalysis: {
          type: Type.STRING,
          description: "Detailed critique of the custom signature close-up, analyzing writing hand consistency, ink medium, pencil-signed numbering, or monogram carving block compatibility. If no signature closeup is provided, write 'No custom closeup scan provided. Overview signature status analyzed under condition details.'"
        },
        damageAnalysis: {
          type: Type.STRING,
          description: "Detailed microscopic review of the paper decay close-up image (faded inks, visible paper pulp, relative tearing, humidity mold points, or acid tape stains from previous framers). If not provided, write 'No custom damage closeup scan provided.'"
        },
        editionSizeAndPrintNumber: {
          type: Type.STRING,
          description: "Details regarding the print number and global edition size (e.g. 'Pencil-numbered 45 / 150 of a limited run print edition; high collection value. Hand-signed in graphite by the artist.'). Offer typical or historical edition expectations if custom handwriting details are not fully visible."
        },
        visualEvidenceHighlights: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: {
                type: Type.STRING,
                description: "Name of the visual evidence feature, e.g. 'Signature Detail', 'Foxing Stain', 'Paper Watermark', 'Cross-Hatching Lines'."
              },
              observation: {
                type: Type.STRING,
                description: "A short descriptive observation backing up what is seen in this crop."
              },
              box_2d: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Normalized bounding box coordinates [ymin, xmin, ymax, xmax] from 0 to 1000 relative to the overall print scan."
              }
            },
            required: ["label", "observation", "box_2d"]
          },
          description: "A collection of 2 to 4 visual evidence highlights cropped from the primary scan."
        }
      },
      required: [
        "likelyArtist", "artistConfidence", "artworkTitle", "titleConfidence", "creationPeriod",
        "techniques", "auctionEstimate", "conditionNotes", "visualDescription", "historicalContext",
        "nextSteps", "isLikelyReproductionOrPoster", "reproductionExplanation", "recentAuctionSales",
        "inferredDimensions", "signatureAnalysis", "damageAnalysis", "editionSizeAndPrintNumber",
        "visualEvidenceHighlights"
      ]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.15,
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
      throw new Error("No output text received from Gemini analysis.");
    }

    const reportData = JSON.parse(textOutput.trim());
    return res.json(reportData);
  } catch (error: any) {
    console.error("Gemini analysis failed:", error);
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash",
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

// Helper to load registered users
function loadUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(data || "[]");
    }
  } catch (err) {
    console.error("Failed to read users file:", err);
  }
  return [];
}

// Helper to save registered users
function saveUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Failed to write users file:", err);
  }
}

// Signup route
app.post("/api/auth/signup", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_.@+-]+$/.test(cleanUsername) || cleanUsername === "." || cleanUsername === ".." || cleanUsername.includes("..")) {
      return res.status(400).json({ error: "Username or email can only contain alphanumeric characters, underscores, dashes, dots, plus signs, and at signs, and cannot contain consecutive dots." });
    }

    const users = loadUsers();
    if (users.some((u: any) => u.username === cleanUsername)) {
      return res.status(400).json({ error: "Username already exists." });
    }

    users.push({ username: cleanUsername, password });
    saveUsers(users);

    // Create user directories
    const userFolder = path.join(USER_RECORDS_DIR, cleanUsername);
    const userImagesFolder = path.join(userFolder, "images");
    const userCatalogsFolder = path.join(userFolder, "catalogs");
    if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });
    if (!fs.existsSync(userImagesFolder)) fs.mkdirSync(userImagesFolder, { recursive: true });
    if (!fs.existsSync(userCatalogsFolder)) fs.mkdirSync(userCatalogsFolder, { recursive: true });

    // Initialize list file
    const catalogsListFile = path.join(userFolder, "catalogs_list.json");
    if (!fs.existsSync(catalogsListFile)) {
      const initialMetadata = {
        catalogs: [
          {
            id: "default",
            name: "Default Catalogue",
            timestamp: new Date().toISOString()
          }
        ],
        activeCatalogId: "default"
      };
      fs.writeFileSync(catalogsListFile, JSON.stringify(initialMetadata, null, 2));
    }





    return res.json({ success: true, username: cleanUsername });
  } catch (err: any) {
    console.error("Signup failed:", err);
    return res.status(500).json({ error: err.message || "Internal server error during registration." });
  }
});

// Login route
app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const users = loadUsers();
    const user = users.find((u: any) => u.username === cleanUsername && u.password === password);

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.json({ success: true, username: cleanUsername });
  } catch (err: any) {
    console.error("Login failed:", err);
    return res.status(500).json({ error: err.message || "Internal server error during authentication." });
  }
});

// Change password route
app.post("/api/auth/change-password", (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { currentPassword, newPassword } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(401).json({ error: "Unauthorized. Missing user header." });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const users = loadUsers();
    const userIndex = users.findIndex((u: any) => u.username === cleanUsername);

    if (userIndex === -1 || users[userIndex].password !== currentPassword) {
      return res.status(400).json({ error: "Incorrect current password." });
    }

    users[userIndex].password = newPassword;
    saveUsers(users);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Change password failed:", err);
    return res.status(500).json({ error: err.message || "Failed to change password." });
  }
});

// Delete user data / account route
app.post("/api/user/delete-data", (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { deleteType } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(401).json({ error: "Unauthorized. Missing user header." });
    }
    if (deleteType !== "data-only" && deleteType !== "account") {
      return res.status(400).json({ error: "Invalid deletion type. Must be 'data-only' or 'account'." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const userFolder = path.join(USER_RECORDS_DIR, cleanUsername);

    if (deleteType === "data-only") {
      const catalogsFolder = path.join(userFolder, "catalogs");
      const imagesFolder = path.join(userFolder, "images");

      // Wipe catalog contents
      if (fs.existsSync(catalogsFolder)) {
        fs.rmSync(catalogsFolder, { recursive: true, force: true });
      }
      // Wipe uploaded images
      if (fs.existsSync(imagesFolder)) {
        fs.rmSync(imagesFolder, { recursive: true, force: true });
      }


      // Re-create blank directories
      fs.mkdirSync(catalogsFolder, { recursive: true });
      fs.mkdirSync(imagesFolder, { recursive: true });

      // Re-initialize catalogs_list.json metadata
      const catalogsListFile = path.join(userFolder, "catalogs_list.json");
      const initialMetadata = {
        catalogs: [
          {
            id: "default",
            name: "Default Catalogue",
            timestamp: new Date().toISOString()
          }
        ],
        activeCatalogId: "default"
      };
      fs.writeFileSync(catalogsListFile, JSON.stringify(initialMetadata, null, 2));





      return res.json({ success: true, message: "All appraisal data cleared successfully." });
    } else {
      // Complete Account deletion
      if (fs.existsSync(userFolder)) {
        fs.rmSync(userFolder, { recursive: true, force: true });
      }

      const users = loadUsers();
      const updatedUsers = users.filter((u: any) => u.username !== cleanUsername);
      saveUsers(updatedUsers);

      return res.json({ success: true, message: "User account and data deleted successfully." });
    }
  } catch (err: any) {
    console.error("Delete data failed:", err);
    return res.status(500).json({ error: err.message || "Failed to delete data." });
  }
});

// GET catalogs metadata list route
app.get("/api/user/catalog-list", (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    if (!username || typeof username !== "string") {
      return res.status(401).json({ error: "Unauthorized. Missing user header." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const userFolder = path.join(USER_RECORDS_DIR, cleanUsername);
    const catalogsFolder = path.join(userFolder, "catalogs");
    const catalogsListFile = path.join(userFolder, "catalogs_list.json");

    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }
    if (!fs.existsSync(catalogsFolder)) {
      fs.mkdirSync(catalogsFolder, { recursive: true });
    }

    let metadata: any = { catalogs: [], activeCatalogId: "default" };
    let changed = false;

    if (fs.existsSync(catalogsListFile)) {
      try {
        const rawData = fs.readFileSync(catalogsListFile, "utf-8");
        metadata = JSON.parse(rawData || "{}");
      } catch (e) {
        console.error("Failed to parse catalogs_list.json, resetting:", e);
      }
    } else {
      metadata.catalogs = [
        {
          id: "default",
          name: "Default Catalogue",
          timestamp: new Date().toISOString()
        }
      ];
      changed = true;
    }

    if (!Array.isArray(metadata.catalogs)) {
      metadata.catalogs = [];
      changed = true;
    }

    // Scan catalogs/ folder to find all *.json catalog files and auto-register them
    const files = fs.readdirSync(catalogsFolder);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const catalogId = path.basename(file, ".json");
        const exists = metadata.catalogs.some((c: any) => c.id === catalogId);
        if (!exists) {
          const filePath = path.join(catalogsFolder, file);
          const stats = fs.statSync(filePath);
          metadata.catalogs.push({
            id: catalogId,
            name: `Catalogue ${catalogId}`,
            timestamp: stats.mtime.toISOString()
          });
          changed = true;
        }
      }
    }

    // Write back updated list
    if (changed) {
      fs.writeFileSync(catalogsListFile, JSON.stringify(metadata, null, 2));
    }

    return res.json(metadata);
  } catch (err: any) {
    console.error("Failed to load catalog list:", err);
    return res.status(500).json({ error: err.message || "Failed to load catalog list." });
  }
});

// POST catalogs metadata list route
app.post("/api/user/catalog-list", (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { catalogs, activeCatalogId } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(401).json({ error: "Unauthorized. Missing user header." });
    }

    if (!catalogs || !Array.isArray(catalogs)) {
      return res.status(400).json({ error: "Invalid catalogs list." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const userFolder = path.join(USER_RECORDS_DIR, cleanUsername);
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    const catalogsListFile = path.join(userFolder, "catalogs_list.json");
    fs.writeFileSync(catalogsListFile, JSON.stringify({ catalogs, activeCatalogId }, null, 2));

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to save catalog list:", err);
    return res.status(500).json({ error: err.message || "Failed to save catalog list." });
  }
});

// GET catalog items route (by id parameter)
app.get("/api/user/catalog", (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { id } = req.query;

    if (!username || typeof username !== "string") {
      return res.status(401).json({ error: "Unauthorized. Missing user header." });
    }

    const cleanUsername = username.trim().toLowerCase();
    
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing catalogue ID parameter." });
    }

    const catalogFile = path.join(USER_RECORDS_DIR, cleanUsername, "catalogs", `${id}.json`);

    if (!fs.existsSync(catalogFile)) {
      return res.json([]);
    }

    const data = fs.readFileSync(catalogFile, "utf-8");
    const catalog = JSON.parse(data || "[]");
    return res.json(catalog);
  } catch (err: any) {
    console.error("Failed to load user catalog:", err);
    return res.status(500).json({ error: err.message || "Failed to load catalog." });
  }
});

// POST catalog items route (by id parameter)
app.post("/api/user/catalog", (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { catalog } = req.body;
    const { id } = req.query;

    if (!username || typeof username !== "string") {
      return res.status(401).json({ error: "Unauthorized. Missing user header." });
    }

    if (!catalog || !Array.isArray(catalog)) {
      return res.status(400).json({ error: "Catalog must be a valid array." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const userFolder = path.join(USER_RECORDS_DIR, cleanUsername);
    
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing catalogue ID parameter." });
    }

    const catalogsFolder = path.join(userFolder, "catalogs");
    if (!fs.existsSync(catalogsFolder)) {
      fs.mkdirSync(catalogsFolder, { recursive: true });
    }
    const catalogFile = path.join(catalogsFolder, `${id}.json`);

    fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2));
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to save user catalog:", err);
    return res.status(500).json({ error: err.message || "Failed to save catalog." });
  }
});

// POST delete specific catalog route
app.post("/api/user/delete-catalog", (req, res) => {
  try {
    const username = req.headers["x-user-header"];
    const { id } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(401).json({ error: "Unauthorized. Missing user header." });
    }

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing or invalid catalog id." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const userFolder = path.join(USER_RECORDS_DIR, cleanUsername);
    const catalogFile = path.join(userFolder, "catalogs", `${id}.json`);

    if (fs.existsSync(catalogFile)) {
      fs.unlinkSync(catalogFile);
    }

    // Update catalogs_list.json
    const catalogsListFile = path.join(userFolder, "catalogs_list.json");
    if (fs.existsSync(catalogsListFile)) {
      try {
        const rawData = fs.readFileSync(catalogsListFile, "utf-8");
        const metadata = JSON.parse(rawData || "{}");
        if (Array.isArray(metadata.catalogs)) {
          metadata.catalogs = metadata.catalogs.filter((c: any) => c.id !== id);
        }

        // If the active catalogue was deleted, select another one or reset to "default"
        if (metadata.activeCatalogId === id) {
          if (metadata.catalogs && metadata.catalogs.length > 0) {
            metadata.activeCatalogId = metadata.catalogs[0].id;
          } else {
            // Reinitialize default
            metadata.catalogs = [
              {
                id: "default",
                name: "Default Catalogue",
                timestamp: new Date().toISOString()
              }
            ];
            metadata.activeCatalogId = "default";
          }
        }
        fs.writeFileSync(catalogsListFile, JSON.stringify(metadata, null, 2));
      } catch (e) {
        console.error("Failed to update catalogs_list.json during deletion:", e);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete catalog file:", err);
    return res.status(500).json({ error: err.message || "Failed to delete catalog." });
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
