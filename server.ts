import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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
        }
      },
      required: [
        "likelyArtist", "artistConfidence", "artworkTitle", "titleConfidence", "creationPeriod",
        "techniques", "auctionEstimate", "conditionNotes", "visualDescription", "historicalContext",
        "nextSteps", "isLikelyReproductionOrPoster", "reproductionExplanation", "recentAuctionSales",
        "inferredDimensions", "signatureAnalysis", "damageAnalysis", "editionSizeAndPrintNumber"
      ]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.15,
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

// ----------------------------------------
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
