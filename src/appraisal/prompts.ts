/**
 * Prompt builders for modular print appraisers.
 */

export type PromptKey = "standard" | "simplified" | "strict";

export function getPrompt(
  key: PromptKey,
  currency: string,
  userNotes?: string,
  hasSignature?: boolean,
  hasDamage?: boolean,
  hasScale?: boolean
): string {
  switch (key) {
    case "simplified":
      return getSimplifiedPrompt(currency, userNotes, hasSignature, hasDamage, hasScale);
    case "strict":
      return getStrictPrompt(currency, userNotes, hasSignature, hasDamage, hasScale);
    case "standard":
    default:
      return getStandardPrompt(currency, userNotes, hasSignature, hasDamage, hasScale);
  }
}

/**
 * Standard Prompt: Complete academic hedonic pricing with detail visual evidence extraction
 */
function getStandardPrompt(
  currency: string,
  userNotes?: string,
  hasSignature?: boolean,
  hasDamage?: boolean,
  hasScale?: boolean
): string {
  return `Analyze this collection of photograph scans covering a single fine art print. Identify the artist, title, printing techniques, stamp/signatures, estimated auction value, and observe condition details visible in the photo.

CURRENCY REQUIREMENTS:
The user has configured their preferred valuation display currency as: "${currency}".
You MUST evaluate and format all currency numbers, estimates, and sale prices strictly in "${currency}" (e.g. if GBP, use '£' and code 'GBP'; if EUR, use '€' and code 'EUR'; if USD, use '$' and code 'USD'). Output the numerical integer fields 'lowEstimate' and 'highEstimate' scaled into this "${currency}" currency.

EDITION SIZE & PRINT NUMBER ANALYSIS (CRITICAL):
You MUST search for, analyze, and describe any information indicating the print's specific number within the overall edition size (such as '45/100', 'Artist's Proof / AP', 'Hors Commerce / HC', 'Printer's Proof / PP', or an 'Open Edition / Unlimited print run'). Detail what this specific numbering represents in terms of collectors' exclusivity, market demand, historical rarity, and price impact. Return this written evaluation inside the "editionSizeAndPrintNumber" field.

SCHOLARLY VALUATION METHODOLOGY (DEFENSIVE HEDONIC PRICING & REPEAT-SALES):
You MUST perform print valuation using a highly conservative "repeat-sales" framework and a defensive hedonic pricing model, where you err on the side of severe caution. Do NOT inflate estimates. You must require exceptional, incontrovertible visual and/or documented evidence to push the valuation figures higher:
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
${hasSignature ? "- A close-up scan focusing on the printmaker's signature/stamp/monogram/numbering block." : ""}
${hasDamage ? "- A close-up detail showcasing potential physical paper damage (foxing, tears, creases, or mat stains)." : ""}
${hasScale ? "- A coin measurement scale calibration image. Place your focus on the standard coin adjacent to the artwork to mathematically estimate real-world sheet dimensions." : ""}

${userNotes ? `The user provided the following additional notes or inscriptions: "${userNotes}"` : ""}

CURATOR EVIDENCE EXTRACTION MANDATE (CRITICAL):
You MUST detect and locate 2 to 4 key visual evidence points in the primary print scan that back up your textual observations.
In particular, check if an artist signature, monogram, publisher stamp, or edition number (e.g. '45/100') is present on the sheet (either in the lower paper margin or within the print design itself). If present, you MUST include its coordinate box as one of the evidence points with the label 'Signature Detail' or 'Edition Number'.
Other evidence points can include print plate borders, chemical foxing/staining spots, margins/watermarks, or fine ink texture details indicating the printmaking technique.
For each point, return a normalized bounding box \`box_2d\` in \`[ymin, xmin, ymax, xmax]\` format on a scale of \`0\` to \`1000\` (where 0 is top/left, 1000 is bottom/right relative to the primary scan's overall height and width). Along with the box, provide a short 2-3 word \`label\` naming the feature and a concise \`observation\` sentence explaining what is visible in that cropped region to justify your appraisal. Place this array in \`visualEvidenceHighlights\`.

Conduct a meticulous evaluation of the authenticity factors (ink ridges, plate borders, chain lines, chemical foxing degradation) using the scholarly valuation guidelines above. Ensure you fill in the requested analytic parameters.`;
}

/**
 * Simplified Prompt: Standard visual description and direct auction estimation, skipping complex rules.
 */
function getSimplifiedPrompt(
  currency: string,
  userNotes?: string,
  hasSignature?: boolean,
  hasDamage?: boolean,
  hasScale?: boolean
): string {
  return `Perform a fast, standard visual identification and estimation of this fine art print. Identify the artist, title, estimated date of creation, and primary techniques.

CURRENCY REQUIREMENTS:
preferred currency: "${currency}". All prices, estimates, and sales records MUST be formatted and scaled in "${currency}".

GENERAL ESTIMATION RULES:
Estimate the market value based on similar prints by the same artist. Give a low and high auction estimate.
Do not write long academic paragraphs; keep descriptions clean, objective, and brief.

FILES PROVIDED:
- Primary artwork photograph.
${hasSignature ? "- Signature closeup." : ""}
${hasDamage ? "- Damage closeup." : ""}
${hasScale ? "- Scale calibration photo." : ""}

${userNotes ? `User Notes: "${userNotes}"` : ""}

EVIDENCE CROP REQUIREMENT:
Locate 1 to 2 key visual elements in the scan (like the signature or central artwork region) using bounding boxes. Return them in visualEvidenceHighlights.
For each, provide a box_2d [ymin, xmin, ymax, xmax] from 0 to 1000, a label, and a short observation.`;
}

/**
 * Strict / Defensive Prompt: Deep focus on condition penalty, authentication doubts, and reproduction warnings.
 */
function getStrictPrompt(
  currency: string,
  userNotes?: string,
  hasSignature?: boolean,
  hasDamage?: boolean,
  hasScale?: boolean
): string {
  return `Perform an extremely critical, defensive authenticity and condition analysis of this fine art print. You are acting as a skeptic who assumes any print might be a modern poster, digital reproduction, or bookplate facsimile unless proven otherwise by clear visual traits.

CURRENCY REQUIREMENTS:
Evaluate and format all estimates and sale records in: "${currency}".

DEFENSIVE RULES & PENALTIES:
1. Condition Skepticism: Assume any spots, stains, or border issues represent structural paper decay. Penalize low and high estimates by 40% to 75% defensively if there are any signs of foxing, creases, light strike, or trimmed margins.
2. Reproduction Risks: If there are no clear hand-pulled qualities visible (such as plate lines, ink texture, or graphite signature), flag it as a suspected mechanical reproduction (set 'isLikelyReproductionOrPoster' to true) and provide a detailed warning in 'reproductionExplanation'.
3. Conservative Valuations: Set estimates at the absolute floor of the historical price distribution.

FILES PROVIDED:
- Primary overall photograph of the print.
${hasSignature ? "- Close-up of signature/stamp." : ""}
${hasDamage ? "- Close-up of damage/decay." : ""}
${hasScale ? "- Scale calibration photo." : ""}

${userNotes ? `User Inscriptions/Notes: "${userNotes}"` : ""}

CURATOR EVIDENCE HIGHLIGHTS:
Locate 3 to 4 points of visual evidence supporting either the printmaking techniques, signs of condition degradation, or authentication clues (like signature detail or plate marks). Return them in visualEvidenceHighlights.
For each, provide a normalized bounding box \`box_2d\` in \`[ymin, xmin, ymax, xmax]\` format from 0 to 1000, a label, and a detailed skeptical observation.`;
}
