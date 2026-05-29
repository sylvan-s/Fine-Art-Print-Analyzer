import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { PrintAnalysisReport } from "../types";
import { getPrompt, PromptKey } from "./prompts";

export interface AppraisalInput {
  imageBase64: string;
  mimeType?: string;
  userNotes?: string;
  signatureBase64?: string;
  signatureMimeType?: string;
  damageBase64?: string;
  damageMimeType?: string;
  scaleBase64?: string;
  scaleMimeType?: string;
  currency?: string;
}

export interface AppraisalMethod {
  id: string;
  name: string;
  description: string;
  config: AppraisalMethodConfig;
  appraise(input: AppraisalInput): Promise<PrintAnalysisReport>;
}

export interface AppraisalMethodConfig {
  id: string;
  name: string;
  description: string;
  modelName: string;
  temperature: number;
  promptKey: PromptKey;
  imageQuality: "original" | "medium" | "low";
  includeAuxiliaryScans: boolean;
  provider?: "gemini" | "anthropic";
}

export class ConfigurableGeminiAppraiser implements AppraisalMethod {
  public id: string;
  public name: string;
  public description: string;
  public config: AppraisalMethodConfig;
  private aiClient: GoogleGenAI | null = null;

  constructor(config: AppraisalMethodConfig, aiClient?: GoogleGenAI) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    if (aiClient) {
      this.aiClient = aiClient;
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY environment variable is not defined. Please add your key in the .env file."
        );
      }
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return this.aiClient;
  }

  public async appraise(input: AppraisalInput): Promise<PrintAnalysisReport> {
    const ai = this.getClient();
    const parts: any[] = [];
    const currency = input.currency || "USD";

    // 1. Add primary print image
    const cleanBase64 = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const cleanMimeType = input.mimeType || "image/jpeg";
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: cleanMimeType,
      },
    });

    const includeAux = this.config.includeAuxiliaryScans;

    // 2. Add signature closeup if uploaded and allowed
    if (includeAux && input.signatureBase64) {
      const cleanSigBase64 = input.signatureBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ text: "--- AUXILIARY SPECIMEN SCAN: CLOSEUP OF THE ARTIST SIGNATURE OR EMBOSSMENT MARK ---" });
      parts.push({
        inlineData: {
          data: cleanSigBase64,
          mimeType: input.signatureMimeType || "image/jpeg",
        },
      });
    }

    // 3. Add damage closeup if uploaded and allowed
    if (includeAux && input.damageBase64) {
      const cleanDmgBase64 = input.damageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ text: "--- AUXILIARY SPECIMEN SCAN: CLOSEUP OF POTENTIAL PAPER DAMAGE, STAINING, OR SURFACE WEAR ---" });
      parts.push({
        inlineData: {
          data: cleanDmgBase64,
          mimeType: input.damageMimeType || "image/jpeg",
        },
      });
    }

    // 4. Add coin scale reference if uploaded and allowed
    if (includeAux && input.scaleBase64) {
      const cleanScaleBase64 = input.scaleBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ text: "--- AUXILIARY SPECIMEN SCAN: DENSITY SCALE REFERENCE PHOTO WITH COIN PLACED ADJACENT TO SHEET --- Use the coin as a standard size scale (e.g. standard penny or quarter coin diameter) to mathematically infer sheet/print dimensions of this artwork." });
      parts.push({
        inlineData: {
          data: cleanScaleBase64,
          mimeType: input.scaleMimeType || "image/jpeg",
        },
      });
    }

    // 5. Build prompt using our prompts module
    const textPrompt = getPrompt(
      this.config.promptKey,
      currency,
      input.userNotes,
      includeAux && !!input.signatureBase64,
      includeAux && !!input.damageBase64,
      includeAux && !!input.scaleBase64
    );

    parts.push({ text: textPrompt });

    // Define responseSchema matching the PrintAnalysisReport structure
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
      model: this.config.modelName,
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: this.config.temperature,
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

    return JSON.parse(textOutput.trim());
  }
}

export class ConfigurableClaudeAppraiser implements AppraisalMethod {
  public id: string;
  public name: string;
  public description: string;
  public config: AppraisalMethodConfig;

  constructor(config: AppraisalMethodConfig) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
  }

  public async appraise(input: AppraisalInput): Promise<PrintAnalysisReport> {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Neither ANTHROPIC_API_KEY nor CLAUDE_API_KEY environment variable is defined. Please add your key in the .env file."
      );
    }

    const contentBlocks: any[] = [];
    const includeAux = this.config.includeAuxiliaryScans;

    // 1. Add primary print image
    const cleanBase64 = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const cleanMimeType = input.mimeType || "image/jpeg";
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: cleanMimeType,
        data: cleanBase64,
      },
    });

    // 2. Add signature closeup if uploaded and allowed
    if (includeAux && input.signatureBase64) {
      const cleanSigBase64 = input.signatureBase64.replace(/^data:image\/\w+;base64,/, "");
      contentBlocks.push({
        type: "text",
        text: "--- AUXILIARY SPECIMEN SCAN: CLOSEUP OF THE ARTIST SIGNATURE OR EMBOSSMENT MARK ---"
      });
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: input.signatureMimeType || "image/jpeg",
          data: cleanSigBase64,
        },
      });
    }

    // 3. Add damage closeup if uploaded and allowed
    if (includeAux && input.damageBase64) {
      const cleanDmgBase64 = input.damageBase64.replace(/^data:image\/\w+;base64,/, "");
      contentBlocks.push({
        type: "text",
        text: "--- AUXILIARY SPECIMEN SCAN: CLOSEUP OF POTENTIAL PAPER DAMAGE, STAINING, OR SURFACE WEAR ---"
      });
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: input.damageMimeType || "image/jpeg",
          data: cleanDmgBase64,
        },
      });
    }

    // 4. Add coin scale reference if uploaded and allowed
    if (includeAux && input.scaleBase64) {
      const cleanScaleBase64 = input.scaleBase64.replace(/^data:image\/\w+;base64,/, "");
      contentBlocks.push({
        type: "text",
        text: "--- AUXILIARY SPECIMEN SCAN: DENSITY SCALE REFERENCE PHOTO WITH COIN PLACED ADJACENT TO SHEET --- Use the coin as a standard size scale (e.g. standard penny or quarter coin diameter) to mathematically infer sheet/print dimensions of this artwork."
      });
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: input.scaleMimeType || "image/jpeg",
          data: cleanScaleBase64,
        },
      });
    }

    const currency = input.currency || "USD";

    // 5. Build prompt using our prompts module
    const textPrompt = getPrompt(
      this.config.promptKey,
      currency,
      input.userNotes,
      includeAux && !!input.signatureBase64,
      includeAux && !!input.damageBase64,
      includeAux && !!input.scaleBase64
    );

    contentBlocks.push({
      type: "text",
      text: textPrompt,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.modelName,
        max_tokens: 4096,
        temperature: this.config.temperature,
        messages: [
          {
            role: "user",
            content: contentBlocks,
          },
        ],
        tools: [
          {
            name: "report_print_analysis",
            description: "Report the structured art print analysis and appraisal details.",
            input_schema: {
              type: "object",
              properties: {
                likelyArtist: {
                  type: "string",
                  description: "The most likely artist of the print based on visual clues, signature, and style. If completely unknown/unidentifiable, state 'Unknown Printmaker' or 'Unidentified Artist'."
                },
                artistConfidence: {
                  type: "integer",
                  description: "Confidence rating (from 0 to 100) regarding the artist identity."
                },
                artworkTitle: {
                  type: "string",
                  description: "The title or subject of the print artwork. If unknown, provide a descriptive title in brackets, like '[Seascape with Fishing Boats]'."
                },
                titleConfidence: {
                  type: "integer",
                  description: "Confidence rating (from 0 to 100) regarding the artwork title."
                },
                creationPeriod: {
                  type: "string",
                  description: "Estimated date or period of creation, e.g., 'circa 1930', 'late 19th Century', '1888', 'Contemporary (circa 2010)'."
                },
                techniques: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      technique: {
                        type: "string",
                        description: "Name of the technique detected, e.g., 'Etching', 'Woodcut', 'Lithography', 'Screenprint', 'Aquatint', 'Giclée Reproduction'."
                      },
                      confidence: {
                        type: "integer",
                        description: "Confidence percentage (from 0 to 100) that this technique was used."
                      },
                      evidenceIdentified: {
                        type: "array",
                        items: { type: "string" },
                        description: "Direct visual cues supporting this technique (e.g. 'plate line indentations', 'stippled ink texture', 'overlapping translucent layers', 'wood grain impressions')."
                      },
                      description: {
                        type: "string",
                        description: "A short explanation of how the technique manifests on the paper sheet."
                      }
                    },
                    required: ["technique", "confidence", "evidenceIdentified", "description"]
                  },
                  description: "List of printing techniques identified in the artwork. Identify at least one primary technique."
                },
                auctionEstimate: {
                  type: "object",
                  properties: {
                    lowEstimate: {
                      type: "integer",
                      description: "Low-end estimated auction value scaled in the user's preferred currency, e.g., 500."
                    },
                    highEstimate: {
                      type: "integer",
                      description: "High-end estimated auction value scaled in the user's preferred currency, e.g., 1000."
                    },
                    currency: {
                      type: "string",
                      description: "Currency code of preferred currency, e.g. 'USD', 'GBP', or 'EUR'."
                    },
                    formattedEstimate: {
                      type: "string",
                      description: "Formatted price estimate text using preferred currency symbol, e.g. '£500 - £1,000 GBP', '€500 - €1,000 EUR' or '$500 - $1,000 USD'."
                    },
                    valuationContext: {
                      type: "string",
                      description: "Detailed background context for this valuation. Refer to the artist's historical market trend, rarity of the print edition, and state what drives price variability."
                    }
                  },
                  required: ["lowEstimate", "highEstimate", "currency", "formattedEstimate", "valuationContext"]
                },
                conditionNotes: {
                  type: "object",
                  properties: {
                    overallGrade: {
                      type: "string",
                      enum: ["Poor", "Fair", "Good", "Excellent", "Mint"],
                      description: "One of standard grades: 'Poor', 'Fair', 'Good', 'Excellent', 'Mint'."
                    },
                    issuesDetected: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of physical condition concerns seen on the paper, border, margins, or ink layout (e.g., 'foxing dots at top-left corner', 'light-strike from frame boundary', 'faint horizontal crease', 'no obvious defects visible')."
                    },
                    signatureStatus: {
                      type: "string",
                      description: "Describe any visible signature, hand numbering, or monogram. E.g. 'Pencil-signed bottom-right, numbered 45/100', 'Plate-signed name inside design frame', 'No signature detected in photo'."
                    },
                    mattingAndMargins: {
                      type: "string",
                      description: "Assessment of borders, margins, and presentation, e.g., 'Margins are cropped close to image border', 'Large full margins on thick deckled-edge paper', 'Framed close with window mat obscuring sheet edges'."
                    },
                    analysisDetails: {
                      type: "string",
                      description: "A narrative report summary analyzing the structural condition of the visible print piece, assessing its visual preservation."
                    }
                  },
                  required: ["overallGrade", "issuesDetected", "signatureStatus", "mattingAndMargins", "analysisDetails"]
                },
                visualDescription: {
                  type: "string",
                  description: "Description of the visual content, subjects represented, colors, style, composition, and emotional expression."
                },
                historicalContext: {
                  type: "string",
                  description: "Historical background of the print work, the movement it fits into (e.g., Japonisme, Expressionism, Pop Art, Ukiyo-e), and its context in art history."
                },
                nextSteps: {
                  type: "array",
                  items: { type: "string" },
                  description: "Custom recommendations for conservation, appraisal, or handling (e.g., 'Keep out of direct sunlight', 'Inspect out of frame to check margins and paper brand', 'Compare watermark under a raking light', 'Consult an IFPDA certified specialist')."
                },
                isLikelyReproductionOrPoster: {
                  type: "boolean",
                  description: "Set to true if there are high indicators of a offset poster, digital scan preview, modern bookplate page, laser-printed facsimile, or cheap replica rather than an authentic hand-pulled limited-edition print."
                },
                reproductionExplanation: {
                  type: "string",
                  description: "Provide details on why this is or isn't suspected of being a mechanical reproduction (e.g. lack of plate impression, raster dots, glossy lightweight paper)."
                },
                recentAuctionSales: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      artworkTitle: {
                        type: "string",
                        description: "Title of the print sold, e.g. 'Under the Wave off Kanagawa'"
                      },
                      artist: {
                        type: "string",
                        description: "Artist name, e.g. 'Katsushika Hokusai'"
                      },
                      technique: {
                        type: "string",
                        description: "Detected technique, e.g. 'Woodblock print' or 'Woodcut'"
                      },
                      saleDate: {
                        type: "string",
                        description: "Month and year of sale, e.g., 'October 2023', 'March 2024'"
                      },
                      priceRealized: {
                        type: "string",
                        description: "Price achieved in formatted currency, strictly matching the user's preferred currency, e.g., '£2,760,000 GBP', '€55,200 EUR' or '$12,000 USD'"
                      },
                      auctionHouse: {
                        type: "string",
                        description: "Name of auction house and location, e.g. 'Christie's New York', 'Sotheby's London'"
                      },
                      conditionState: {
                        type: "string",
                        description: "Brief summary of print state/condition details of that particular copy, e.g. 'Pristine early state, full margins', 'Later printing, faded colors'"
                      },
                      wasSoldInBroaderLot: {
                        type: "boolean",
                        description: "Indicate if this artwork was previously sold bundled/grouped as part of a broader, multi-artwork auction lot."
                      },
                      broaderLotPriceAdjustment: {
                        type: "string",
                        description: "The price adjustment performed to derive single-item value (e.g. '+25% premium added to compensate for multi-item collection wholesale discount') or 'None - Sold Standalone' if stand-alone."
                      }
                    },
                    required: ["artworkTitle", "artist", "technique", "saleDate", "priceRealized", "auctionHouse", "conditionState", "wasSoldInBroaderLot", "broaderLotPriceAdjustment"]
                  },
                  description: "A list of 2 or 3 recent actual or highly realistic auction sales achieved for the same print or similar prints by the same artist, same technique, and same time period."
                },
                inferredDimensions: {
                  type: "string",
                  description: "If a coin measurement scale image was provided, calculate the estimated physical dimensions of the print (e.g., 'Approx. 40 x 30 cm, calculated using the adjacent coin reference diameter'). Otherwise, return an estimation of typical dimensions based on known artist standards, prefixed with '[Estimated standard size...]'."
                },
                signatureAnalysis: {
                  type: "string",
                  description: "Detailed critique of the custom signature close-up, analyzing writing hand consistency, ink medium, pencil-signed numbering, or monogram carving block compatibility. If no signature closeup is provided, write 'No custom closeup scan provided. Overview signature status analyzed under condition details.'"
                },
                damageAnalysis: {
                  type: "string",
                  description: "Detailed microscopic review of the paper decay close-up image (faded inks, visible paper pulp, relative tearing, humidity mold points, or acid tape stains from previous framers). If not provided, write 'No custom damage closeup scan provided.'"
                },
                editionSizeAndPrintNumber: {
                  type: "string",
                  description: "Details regarding the print number and global edition size (e.g. 'Pencil-numbered 45 / 150 of a limited run print edition; high collection value. Hand-signed in graphite by the artist.'). Offer typical or historical edition expectations if custom handwriting details are not fully visible."
                },
                visualEvidenceHighlights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: {
                        type: "string",
                        description: "Name of the visual evidence feature, e.g. 'Signature Detail', 'Foxing Stain', 'Paper Watermark', 'Cross-Hatching Lines'."
                      },
                      observation: {
                        type: "string",
                        description: "A short descriptive observation backing up what is seen in this crop."
                      },
                      box_2d: {
                        type: "array",
                        items: { type: "integer" },
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
            }
          }
        ],
        tool_choice: {
          type: "tool",
          name: "report_print_analysis"
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const toolUseBlock = data.content?.find((block: any) => block.type === "tool_use");
    if (!toolUseBlock || !toolUseBlock.input) {
      throw new Error("Claude did not return a valid structured tool call report.");
    }

    return toolUseBlock.input as PrintAnalysisReport;
  }
}

// Configurable Appraisal Method Registry
export const appraiserConfigs: AppraisalMethodConfig[] = [
  {
    id: "gemini-standard",
    name: "Gemini Standard",
    description: "Baseline Gemini 2.5 Flash appraisal with academic hedonic repeat-sales pricing rules.",
    modelName: "gemini-2.5-flash",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "original",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro (2.5)",
    description: "Higher quality appraisal using Gemini 2.5 Pro for complex printing techniques and inscriptions.",
    modelName: "gemini-2.5-pro",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "original",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-pro-latest",
    name: "Gemini Pro (Stable)",
    description: "Stable legacy professional appraisal using Gemini Pro (Stable) for high detail and structured extraction.",
    modelName: "gemini-pro-latest",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "original",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro (Preview)",
    description: "Next-generation professional reasoning model using Gemini 3.1 Pro Preview for maximum detail.",
    modelName: "gemini-3.1-pro-preview",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "original",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-creative",
    name: "Gemini Creative",
    description: "Standard model with a higher temperature (0.45) for richer background context and flexible ranges.",
    modelName: "gemini-2.5-flash",
    temperature: 0.45,
    promptKey: "standard",
    imageQuality: "original",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-strict",
    name: "Gemini Strict / Skeptic",
    description: "Extremely conservative appraisal model focusing aggressively on condition flaws and reproduction risks.",
    modelName: "gemini-2.5-flash",
    temperature: 0.05,
    promptKey: "strict",
    imageQuality: "original",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-simplified",
    name: "Gemini Simplified",
    description: "Shorter, straightforward prompt relying on Gemini's general knowledge instead of complex auction guidelines.",
    modelName: "gemini-2.5-flash",
    temperature: 0.15,
    promptKey: "simplified",
    imageQuality: "original",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-low-quality",
    name: "Gemini Low Resolution",
    description: "Appraises using a heavily downsampled image (512px max dimension) to test accuracy with low-resolution inputs.",
    modelName: "gemini-2.5-flash",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "low",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-medium-quality",
    name: "Gemini Medium Resolution",
    description: "Appraises using a medium downsampled image (1024px max dimension) to test accuracy with standard inputs.",
    modelName: "gemini-2.5-flash",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "medium",
    includeAuxiliaryScans: true
  },
  {
    id: "gemini-no-aux",
    name: "Gemini (No Aux Scans)",
    description: "Ignores any custom signature, damage, or scale closeups, appraising solely on the primary artwork scan.",
    modelName: "gemini-2.5-flash",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "original",
    includeAuxiliaryScans: false
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet (4.6)",
    description: "High-accuracy visual appraisals using Anthropic's Claude 4.6 Sonnet.",
    modelName: "claude-sonnet-4-6",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "original",
    includeAuxiliaryScans: true,
    provider: "anthropic"
  },
  {
    id: "claude-opus",
    name: "Claude Opus (4.8)",
    description: "Frontier reasoning appraisals using Anthropic's flagship Claude 4.8 Opus.",
    modelName: "claude-opus-4-8",
    temperature: 0.15,
    promptKey: "standard",
    imageQuality: "original",
    includeAuxiliaryScans: true,
    provider: "anthropic"
  }
];

// Appraiser Registry Map
export const appraiserRegistry: Record<string, AppraisalMethod> = appraiserConfigs.reduce(
  (registry, config) => {
    if (config.provider === "anthropic") {
      registry[config.id] = new ConfigurableClaudeAppraiser(config);
    } else {
      registry[config.id] = new ConfigurableGeminiAppraiser(config);
    }
    return registry;
  },
  {} as Record<string, AppraisalMethod>
);

// Manager to retrieve appraiser
export function getAppraiser(methodName: string = "gemini-standard", aiClient?: GoogleGenAI): AppraisalMethod {
  const appraiser = appraiserRegistry[methodName];
  if (!appraiser) {
    throw new Error(`Unknown appraisal method: ${methodName}`);
  }
  if (aiClient && appraiser.config.provider !== "anthropic") {
    return new ConfigurableGeminiAppraiser(appraiser.config, aiClient);
  }
  return appraiser;
}
