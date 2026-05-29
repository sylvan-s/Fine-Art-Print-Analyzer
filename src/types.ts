export interface AuctionEstimate {
  lowEstimate: number;
  highEstimate: number;
  currency: string;
  formattedEstimate: string;
  valuationContext: string;
}

export interface TechnicalDetail {
  technique: string;
  confidence: number; // 0-100 percent
  evidenceIdentified: string[];
  description: string;
}

export interface ConditionNotes {
  overallGrade: 'Poor' | 'Fair' | 'Good' | 'Excellent' | 'Mint';
  issuesDetected: string[];
  signatureStatus: string; // e.g. "Signed in graphite", "Signed in plate", "Unsigned"
  mattingAndMargins: string;
  analysisDetails: string;
}

export interface PrintAnalysisReport {
  likelyArtist: string;
  artistConfidence: number; // 0-100 percent
  artworkTitle: string;
  titleConfidence: number; // 0-100 percent
  creationPeriod: string;
  techniques: TechnicalDetail[];
  auctionEstimate: AuctionEstimate;
  conditionNotes: ConditionNotes;
  visualDescription: string;
  historicalContext: string;
  nextSteps: string[];
  isLikelyReproductionOrPoster: boolean;
  reproductionExplanation: string;
  recentAuctionSales?: RecentSale[]; // Recent auction transactions for similar prints
  inferredDimensions?: string; // Estimated physical dimensions of the print (e.g. inferred from coin ratio)
  signatureAnalysis?: string; // Appraiser's transcription and authentication analysis of the uploaded signature
  damageAnalysis?: string; // Close-up analysis regarding paper tears, foxing, acidity or pigment preservation
  editionSizeAndPrintNumber?: string; // Verified printing number and overall edition details (e.g., "45 / 100", "Artists Proof", "Unlimited Open Edition")
  visualEvidenceHighlights?: VisualEvidenceHighlight[];
}

export interface VisualEvidenceHighlight {
  label: string;
  observation: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] coordinates from 0 to 1000
}

export interface RecentSale {
  artworkTitle: string;
  artist: string;
  technique: string;
  saleDate: string;
  priceRealized: string;
  auctionHouse: string;
  conditionState: string;
  wasSoldInBroaderLot?: boolean;
  broaderLotPriceAdjustment?: string;
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: string;
  imageUrl: string;
  imageFileName: string;
  imageSize: string;
  report: PrintAnalysisReport;
  lotNumber?: string; // e.g. "Lot 101"
  lotTitle?: string;  // e.g. "Post-war Prints"
  signatureImageUrl?: string;
  damageImageUrl?: string;
  scaleImageUrl?: string;
  catalogue_id?: string | null;
  lot_id?: string | null;
}

export interface CatalogMetadata {
  id: string;
  name: string;
  timestamp: string;
}

