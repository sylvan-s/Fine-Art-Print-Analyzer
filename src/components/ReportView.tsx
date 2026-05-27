import React from "react";
import { PrintAnalysisReport } from "../types";
import { 
  User, 
  Award, 
  Clock, 
  Info, 
  ShieldAlert, 
  CheckCircle2, 
  Percent, 
  Coins, 
  Layers, 
  Clipboard, 
  Compass, 
  ExternalLink,
  Upload,
  X,
  Sparkles,
  Hash,
  FileText
} from "lucide-react";

interface ReportViewProps {
  report: PrintAnalysisReport;
  fileName?: string;
  fileSize?: string;
  imageUrl?: string;

  // Auxiliary upload functionality
  signatureFile?: File | null;
  signaturePreview?: string | null;
  setSignatureFile?: (file: File | null) => void;
  setSignaturePreview?: (url: string | null) => void;
  signatureInputRef?: React.RefObject<HTMLInputElement | null>;

  damageFile?: File | null;
  damagePreview?: string | null;
  setDamageFile?: (file: File | null) => void;
  setDamagePreview?: (url: string | null) => void;
  damageInputRef?: React.RefObject<HTMLInputElement | null>;

  scaleFile?: File | null;
  scalePreview?: string | null;
  setScaleFile?: (file: File | null) => void;
  setScalePreview?: (url: string | null) => void;
  scaleInputRef?: React.RefObject<HTMLInputElement | null>;

  onReAnalyze?: () => void;
  isLoading?: boolean;
  currency?: "USD" | "GBP" | "EUR";
  setCurrency?: (currency: "USD" | "GBP" | "EUR") => void;

  onUpdateReport?: (updated: PrintAnalysisReport) => void;
}

export default function ReportView({ 
  report, 
  fileName, 
  fileSize, 
  imageUrl,
  signatureFile,
  signaturePreview,
  setSignatureFile,
  setSignaturePreview,
  signatureInputRef,
  damageFile,
  damagePreview,
  setDamageFile,
  setDamagePreview,
  damageInputRef,
  scaleFile,
  scalePreview,
  setScaleFile,
  setScalePreview,
  scaleInputRef,
  onReAnalyze,
  isLoading,
  currency: propCurrency,
  setCurrency: propSetCurrency,
  onUpdateReport
}: ReportViewProps) {
  const [localCurrency, setLocalCurrency] = React.useState<"USD" | "GBP" | "EUR">("USD");
  const currency = propCurrency || localCurrency;
  const setCurrency = propSetCurrency || setLocalCurrency;

  // Curation / Editing States
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editArtist, setEditArtist] = React.useState("");
  const [editPeriod, setEditPeriod] = React.useState("");
  const [editArtistConfidence, setEditArtistConfidence] = React.useState(0);
  const [editTitleConfidence, setEditTitleConfidence] = React.useState(0);
  const [editIsReproduction, setEditIsReproduction] = React.useState(false);
  const [editReproductionExplanation, setEditReproductionExplanation] = React.useState("");
  const [editEditionSize, setEditEditionSize] = React.useState("");
  const [editLowEstimate, setEditLowEstimate] = React.useState(0);
  const [editHighEstimate, setEditHighEstimate] = React.useState(0);
  const [editValuationContext, setEditValuationContext] = React.useState("");
  const [editOverallGrade, setEditOverallGrade] = React.useState<'Poor' | 'Fair' | 'Good' | 'Excellent' | 'Mint'>('Good');
  const [editSignatureStatus, setEditSignatureStatus] = React.useState("");
  const [editMattingAndMargins, setEditMattingAndMargins] = React.useState("");
  const [editAnalysisDetails, setEditAnalysisDetails] = React.useState("");
  const [editVisualDescription, setEditVisualDescription] = React.useState("");
  const [editHistoricalContext, setEditHistoricalContext] = React.useState("");
  const [editInferredDimensions, setEditInferredDimensions] = React.useState("");
  const [editSignatureAnalysis, setEditSignatureAnalysis] = React.useState("");
  const [editDamageAnalysis, setEditDamageAnalysis] = React.useState("");

  // Sync edit states when report changes
  React.useEffect(() => {
    setEditTitle(report.artworkTitle);
    setEditArtist(report.likelyArtist);
    setEditPeriod(report.creationPeriod);
    setEditArtistConfidence(report.artistConfidence);
    setEditTitleConfidence(report.titleConfidence);
    setEditIsReproduction(report.isLikelyReproductionOrPoster);
    setEditReproductionExplanation(report.reproductionExplanation);
    setEditEditionSize(report.editionSizeAndPrintNumber || "");
    setEditLowEstimate(report.auctionEstimate.lowEstimate);
    setEditHighEstimate(report.auctionEstimate.highEstimate);
    setEditValuationContext(report.auctionEstimate.valuationContext);
    setEditOverallGrade(report.conditionNotes.overallGrade);
    setEditSignatureStatus(report.conditionNotes.signatureStatus);
    setEditMattingAndMargins(report.conditionNotes.mattingAndMargins);
    setEditAnalysisDetails(report.conditionNotes.analysisDetails);
    setEditVisualDescription(report.visualDescription);
    setEditHistoricalContext(report.historicalContext);
    setEditInferredDimensions(report.inferredDimensions || "");
    setEditSignatureAnalysis(report.signatureAnalysis || "");
    setEditDamageAnalysis(report.damageAnalysis || "");
  }, [report]);

  const handleCancel = () => {
    setEditTitle(report.artworkTitle);
    setEditArtist(report.likelyArtist);
    setEditPeriod(report.creationPeriod);
    setEditArtistConfidence(report.artistConfidence);
    setEditTitleConfidence(report.titleConfidence);
    setEditIsReproduction(report.isLikelyReproductionOrPoster);
    setEditReproductionExplanation(report.reproductionExplanation);
    setEditEditionSize(report.editionSizeAndPrintNumber || "");
    setEditLowEstimate(report.auctionEstimate.lowEstimate);
    setEditHighEstimate(report.auctionEstimate.highEstimate);
    setEditValuationContext(report.auctionEstimate.valuationContext);
    setEditOverallGrade(report.conditionNotes.overallGrade);
    setEditSignatureStatus(report.conditionNotes.signatureStatus);
    setEditMattingAndMargins(report.conditionNotes.mattingAndMargins);
    setEditAnalysisDetails(report.conditionNotes.analysisDetails);
    setEditVisualDescription(report.visualDescription);
    setEditHistoricalContext(report.historicalContext);
    setEditInferredDimensions(report.inferredDimensions || "");
    setEditSignatureAnalysis(report.signatureAnalysis || "");
    setEditDamageAnalysis(report.damageAnalysis || "");
    setIsEditing(false);
  };

  const handleSave = () => {
    if (onUpdateReport) {
      const baseCurrency = report.auctionEstimate.currency || "USD";
      const updatedReport: PrintAnalysisReport = {
        ...report,
        artworkTitle: editTitle,
        likelyArtist: editArtist,
        creationPeriod: editPeriod,
        artistConfidence: editArtistConfidence,
        titleConfidence: editTitleConfidence,
        isLikelyReproductionOrPoster: editIsReproduction,
        reproductionExplanation: editReproductionExplanation,
        editionSizeAndPrintNumber: editEditionSize || undefined,
        auctionEstimate: {
          ...report.auctionEstimate,
          lowEstimate: editLowEstimate,
          highEstimate: editHighEstimate,
          valuationContext: editValuationContext,
          formattedEstimate: `${getCurrencySymbol(baseCurrency)}${editLowEstimate.toLocaleString()} - ${getCurrencySymbol(baseCurrency)}${editHighEstimate.toLocaleString()} ${baseCurrency}`
        },
        conditionNotes: {
          ...report.conditionNotes,
          overallGrade: editOverallGrade,
          signatureStatus: editSignatureStatus,
          mattingAndMargins: editMattingAndMargins,
          analysisDetails: editAnalysisDetails,
        },
        visualDescription: editVisualDescription,
        historicalContext: editHistoricalContext,
        inferredDimensions: editInferredDimensions || undefined,
        signatureAnalysis: editSignatureAnalysis || undefined,
        damageAnalysis: editDamageAnalysis || undefined,
      };
      onUpdateReport(updatedReport);
    }
    setIsEditing(false);
  };

  // Currency Conversion Helpers
  const convertValue = (val: number, from: string, to: string): number => {
    if (!from || !to || from.toUpperCase() === to.toUpperCase()) return val;
    
    let valInUSD = val;
    const origin = from.toUpperCase();
    const target = to.toUpperCase();
    
    // Convert to base USD
    if (origin === "GBP") {
      valInUSD = val * 1.25;
    } else if (origin === "EUR") {
      valInUSD = val * 1.09;
    }
    
    // Convert from USD to target
    if (target === "USD") {
      return Math.round(valInUSD);
    } else if (target === "GBP") {
      return Math.round(valInUSD * 0.80);
    } else if (target === "EUR") {
      return Math.round(valInUSD * 0.92);
    }
    
    return val;
  };

  const getCurrencySymbol = (code: string) => {
    if (code === "USD") return "$";
    if (code === "GBP") return "£";
    if (code === "EUR") return "€";
    return "";
  };

  const formatAndConvertPriceRealized = (priceStr: string, targetCurrency: string) => {
    if (!priceStr) return priceStr;
    
    // Find all currency figures in the string using regex, e.g. "$12,000" or "£10,000" or "€55,200"
    // and replace them with converted figures in-place!
    const regex = /(?:USD|GBP|EUR|\$|£|€)\s*[\d,]+|[\d,]+\s*(?:USD|GBP|EUR)/gi;
    const foundMatches = priceStr.match(regex);
    
    if (foundMatches) {
      let result = priceStr;
      for (const m of foundMatches) {
        const digits = m.replace(/[^0-9]/g, "");
        if (!digits) continue;
        const val = parseInt(digits, 10);
        
        let origCur = "USD";
        if (m.includes("GBP") || m.includes("£")) {
          origCur = "GBP";
        } else if (m.includes("EUR") || m.includes("€")) {
          origCur = "EUR";
        }
        
        if (origCur.toUpperCase() !== targetCurrency.toUpperCase()) {
          const converted = convertValue(val, origCur, targetCurrency);
          const formatted = `${getCurrencySymbol(targetCurrency)}${converted.toLocaleString()} ${targetCurrency}`;
          result = result.replace(m, formatted);
        }
      }
      return result;
    }
    
    const digitsOnly = priceStr.replace(/[^0-9]/g, "");
    if (!digitsOnly) return priceStr;
    const originalValue = parseInt(digitsOnly, 10);
    
    let originalCurrency = "USD";
    if (priceStr.includes("GBP") || priceStr.includes("£")) {
      originalCurrency = "GBP";
    } else if (priceStr.includes("EUR") || priceStr.includes("€")) {
      originalCurrency = "EUR";
    }
    
    if (originalCurrency.toUpperCase() === targetCurrency.toUpperCase()) return priceStr;
    
    const converted = convertValue(originalValue, originalCurrency, targetCurrency);
    return `${getCurrencySymbol(targetCurrency)}${converted.toLocaleString()} ${targetCurrency}`;
  };

  // Determine Grade Badge color
  const getGradeStyle = (grade: string) => {
    switch (grade) {
      case "Mint":
        return "bg-teal-50 border-teal-200 text-teal-800";
      case "Excellent":
        return "bg-emerald-50 border-emerald-200 text-emerald-800";
      case "Good":
        return "bg-amber-50 border-amber-200 text-amber-800";
      case "Fair":
        return "bg-orange-50 border-orange-200 text-orange-800";
      default: // Poor
        return "bg-rose-50 border-rose-200 text-rose-800";
    }
  };

  return (
    <div id="art-report-view" className="space-y-8 animate-fadeIn text-rosebery-text-normal">
      {/* Sleek Curation Bar */}
      <div className="flex justify-between items-center bg-rosebery-card border border-rosebery-border rounded-sm px-5 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="bg-rosebery-primary text-white p-1.5 rounded-sm">
            <Clipboard className="w-4 h-4" />
          </span>
          <div>
            <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block">
              REPORT CURATION MODE
            </span>
            <span className="text-[11px] text-rosebery-muted font-serif">
              {isEditing ? "Curating appraisal overrides..." : "Professional Art Appraiser Review"}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-rosebery-muted hover:text-rosebery-primary font-bold flex items-center gap-1.5 border border-rosebery-border hover:bg-rosebery-cream-bg px-4 py-2 rounded-sm transition-all cursor-pointer bg-white font-mono uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="text-xs text-white bg-rosebery-primary hover:bg-rosebery-primary-hover font-bold flex items-center gap-1.5 border border-rosebery-primary px-4 py-2 rounded-sm transition-all cursor-pointer font-mono uppercase tracking-wider shadow-gallery-soft"
              >
                Save Curation
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs text-rosebery-primary hover:text-white font-bold flex items-center gap-1.5 border border-rosebery-primary hover:bg-rosebery-primary px-4 py-2 rounded-sm transition-all cursor-pointer bg-transparent font-mono uppercase tracking-wider"
              >
                Edit Report
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="text-xs text-rosebery-primary hover:text-white font-bold flex items-center gap-1.5 border border-rosebery-primary hover:bg-rosebery-primary px-4 py-2 rounded-sm transition-all cursor-pointer bg-transparent font-mono uppercase tracking-wider flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview Card */}
      <div className="bg-white border border-rosebery-border rounded-xl p-6 md:p-8 shadow-gallery-soft">
        <div className="flex flex-col lg:flex-row justify-between gap-6 border-b border-rosebery-border pb-6 mb-6">
          <div className="flex-1 space-y-4">
            <div>
              <span className="text-xs font-mono tracking-[0.25em] text-rosebery-primary uppercase font-bold block mb-1">
                ESTABLISHED EXHIBITION RECORD
              </span>
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block">Artwork Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm px-3 py-1.5 text-base font-serif text-rosebery-charcoal focus:outline-none"
                  />
                </div>
              ) : (
                <h2 className="text-2xl md:text-3xl font-serif text-rosebery-charcoal font-semibold tracking-wide leading-none">
                  {report.artworkTitle}
                </h2>
              )}

              {isEditing ? (
                <div className="space-y-1 mt-2.5">
                  <label className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block">Likely Artist</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-rosebery-primary" />
                    <input
                      type="text"
                      value={editArtist}
                      onChange={(e) => setEditArtist(e.target.value)}
                      className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm pl-9 pr-3 py-1.5 text-sm font-sans font-semibold text-rosebery-primary focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-md text-rosebery-muted mt-2 font-serif italic flex items-center gap-2">
                  <User className="w-4 h-4 inline text-rosebery-primary" />
                  attributed to <span className="font-sans font-semibold text-rosebery-primary not-italic">{report.likelyArtist}</span>
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2.5 items-end">
              {fileName && (
                <span className="text-[11px] font-mono bg-rosebery-cream-bg border border-rosebery-border px-3 py-1.5 rounded-full text-rosebery-muted">
                  Scan File: <span className="text-rosebery-charcoal font-semibold">{fileName}</span> {fileSize ? `(${fileSize})` : ""}
                </span>
              )}
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block">Creation Period</label>
                  <input
                    type="text"
                    value={editPeriod}
                    onChange={(e) => setEditPeriod(e.target.value)}
                    className="bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 text-xs font-mono text-rosebery-charcoal px-3.5 py-1.5 rounded-sm focus:outline-none"
                  />
                </div>
              ) : (
                <span className="text-xs font-mono bg-rosebery-primary text-white px-3.5 py-1.5 rounded-sm font-semibold uppercase tracking-wider">
                  {report.creationPeriod}
                </span>
              )}
            </div>
          </div>

          {imageUrl && (
            <div className="shrink-0 lg:max-w-[220px] w-full flex justify-center lg:justify-end">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#4C0B2A] to-[#8E7950] opacity-20 blur-xs rounded-sm"></div>
                <div className="relative bg-stone-50 p-2 border border-rosebery-border shadow-gallery-soft rounded-sm">
                  <img 
                    src={imageUrl} 
                    alt={report.artworkTitle}
                    className="max-h-[140px] w-auto object-contain rounded-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confidence Grid and Key Findings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Artist Confidence Card */}
          <div className="bg-stone-50 border border-rosebery-border p-5 rounded-lg shadow-xs">
            <span className="text-[10px] font-mono text-rosebery-muted uppercase tracking-widest block mb-2 font-semibold">Artist Attribution Probability</span>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editArtistConfidence}
                  onChange={(e) => setEditArtistConfidence(parseInt(e.target.value) || 0)}
                  className="w-full accent-[#4C0B2A]"
                />
                <div className="flex justify-between text-xs font-mono">
                  <span>Confidence:</span>
                  <span className="font-bold text-rosebery-primary">{editArtistConfidence}%</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-rosebery-charcoal font-serif">{report.artistConfidence}%</span>
                  <span className="text-xs font-mono text-rosebery-primary font-semibold">confident</span>
                </div>
                <div className="w-full bg-[#E8E2D7] h-1.5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-rosebery-primary h-full rounded-full transition-all duration-500" 
                    style={{ width: `${report.artistConfidence}%` }}
                  />
                </div>
              </>
            )}
            <p className="text-xs text-rosebery-muted mt-3 leading-relaxed">
              Based on stylistic cataloging, composition weight, color pigments, and inscription fidelity.
            </p>
          </div>

          {/* Title Identification Card */}
          <div className="bg-stone-50 border border-rosebery-border p-5 rounded-lg shadow-xs">
            <span className="text-[10px] font-mono text-rosebery-muted uppercase tracking-widest block mb-1 font-semibold">Catalog Raisonné Match</span>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editTitleConfidence}
                  onChange={(e) => setEditTitleConfidence(parseInt(e.target.value) || 0)}
                  className="w-full accent-[#4C0B2A]"
                />
                <div className="flex justify-between text-xs font-mono">
                  <span>Compatibility:</span>
                  <span className="font-bold text-rosebery-primary">{editTitleConfidence}%</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-rosebery-charcoal font-serif">{report.titleConfidence}%</span>
                  <span className="text-xs font-mono text-rosebery-primary font-semibold font-bold">compatibility</span>
                </div>
                <div className="w-full bg-[#E8E2D7] h-1.5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-rosebery-primary h-full rounded-full transition-all duration-500" 
                    style={{ width: `${report.titleConfidence}%` }}
                  />
                </div>
              </>
            )}
            <p className="text-xs text-rosebery-muted mt-3 leading-relaxed">
              Comparison made with known registry dimensions, published states, and design elements.
            </p>
          </div>

          {/* Originality indicator */}
          <div className={`p-5 rounded-lg border shadow-xs ${
            isEditing
              ? "bg-stone-50 border-rosebery-border text-rosebery-text-normal"
              : report.isLikelyReproductionOrPoster 
                ? "bg-amber-50 border-amber-200 text-amber-800" 
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}>
            <span className="text-xs font-mono uppercase tracking-widest block mb-2 flex items-center gap-1.5 font-bold text-rosebery-primary">
              <ShieldAlert className="w-3.5 h-3.5" />
              Originality Check
            </span>
            {isEditing ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsReproduction}
                    onChange={(e) => setEditIsReproduction(e.target.checked)}
                    className="rounded border-rosebery-border text-rosebery-primary focus:ring-rosebery-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Likely Reproduction / Poster Scan</span>
                </label>
                <textarea
                  value={editReproductionExplanation}
                  onChange={(e) => setEditReproductionExplanation(e.target.value)}
                  rows={2}
                  className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm p-2 text-xs font-sans text-rosebery-text-normal focus:outline-none"
                  placeholder="Explain why it is or is not a reproduction..."
                />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-serif text-rosebery-charcoal">
                    {report.isLikelyReproductionOrPoster ? "Speculative / Modern Scan" : "Authentic Fine Art Print"}
                  </span>
                </div>
                <p className="text-xs mt-3 leading-relaxed text-rosebery-muted">
                  {report.reproductionExplanation}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Edition & Printing Number Details Block */}
        {(isEditing || report.editionSizeAndPrintNumber) && (
          <div className="bg-stone-50 border border-rosebery-border p-5 rounded-lg shadow-xs flex flex-col md:flex-row items-start md:items-center gap-4 border-l-4 border-l-[#4C0B2A] mt-6">
            <div className="bg-rosebery-primary text-white p-2.5 rounded-sm shrink-0">
              <Hash className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-rosebery-primary font-bold block">
                Edition Size & Print Numbering Information
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={editEditionSize}
                  onChange={(e) => setEditEditionSize(e.target.value)}
                  placeholder="e.g. 45 / 100, Artists Proof, Unlimited Open Edition"
                  className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm px-3 py-1.5 text-xs font-serif italic text-rosebery-charcoal focus:outline-none"
                />
              ) : (
                <p className="text-xs text-rosebery-charcoal font-serif italic leading-relaxed">
                  {report.editionSizeAndPrintNumber}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Valuation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-4">
              <span className="text-xs font-mono tracking-[0.2em] text-rosebery-primary uppercase flex items-center gap-1.5 font-bold mt-1">
                <Coins className="w-4 h-4 text-rosebery-primary" />
                ESTIMATED MARKET VALUATION
              </span>
              {/* Compact currency selector in the right corner */}
              <div className="flex border border-rosebery-border rounded-sm overflow-hidden text-[10px] font-mono shadow-xs shrink-0 bg-stone-50">
                {(["USD", "GBP", "EUR"] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    className={`px-2 py-1 font-bold transition-colors cursor-pointer ${
                      currency === curr
                        ? "bg-rosebery-primary text-white"
                        : "text-rosebery-muted hover:text-rosebery-primary hover:bg-[#E8E2D7]/20"
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
            <h3 className="text-xs font-sans font-medium text-rosebery-muted uppercase tracking-wider block">AUCTION VALUE RANGE</h3>
            {isEditing ? (
              <div className="space-y-3 my-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-rosebery-muted uppercase">Low ({report.auctionEstimate.currency})</label>
                    <input
                      type="number"
                      value={editLowEstimate}
                      onChange={(e) => setEditLowEstimate(parseInt(e.target.value) || 0)}
                      className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm px-2.5 py-1 text-sm font-bold text-rosebery-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-rosebery-muted uppercase">High ({report.auctionEstimate.currency})</label>
                    <input
                      type="number"
                      value={editHighEstimate}
                      onChange={(e) => setEditHighEstimate(parseInt(e.target.value) || 0)}
                      className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm px-2.5 py-1 text-sm font-bold text-rosebery-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-5">
                <span className="text-2xl md:text-3xl font-serif font-bold tracking-wide text-rosebery-primary block">
                  {report.auctionEstimate.lowEstimate === 0 
                    ? "speculative value" 
                    : `${getCurrencySymbol(currency)}${convertValue(report.auctionEstimate.lowEstimate, report.auctionEstimate.currency, currency).toLocaleString()} - ${getCurrencySymbol(currency)}${convertValue(report.auctionEstimate.highEstimate, report.auctionEstimate.currency, currency).toLocaleString()} ${currency}`}
                </span>
                <p className="text-xs font-mono text-rosebery-primary font-semibold mt-2.5">
                  ESTIMATED IN GLOBAL CURRENCY MARKET ({currency})
                </p>
              </div>
            )}
          </div>
          
          <div className="bg-stone-50 border border-rosebery-border p-4 rounded-lg mt-4 flex-1">
            <span className="text-xs font-mono text-rosebery-primary font-semibold uppercase tracking-widest block mb-1.5">Auction Market Context</span>
            {isEditing ? (
              <textarea
                value={editValuationContext}
                onChange={(e) => setEditValuationContext(e.target.value)}
                rows={3}
                className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm p-2 text-xs text-rosebery-text-normal focus:outline-none"
                placeholder="Market context details..."
              />
            ) : (
              <p className="text-xs text-rosebery-muted leading-relaxed">
                {report.auctionEstimate.valuationContext}
              </p>
            )}
          </div>
        </div>

        {/* Condition Report Profile */}
        <div className="lg:col-span-2 bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft">
          <span className="text-xs font-mono tracking-[0.2em] text-rosebery-primary uppercase flex items-center gap-2 mb-4 font-bold">
            <Clipboard className="w-4 h-4" />
            DETAILED CONDITION RECAP & NOTES
          </span>

          <div className="flex flex-wrap items-center gap-6 mb-5 border-b border-rosebery-border pb-5">
            <div>
              <span className="text-xs text-rosebery-muted block mb-1">Preservation Grading</span>
              {isEditing ? (
                <select
                  value={editOverallGrade}
                  onChange={(e) => setEditOverallGrade(e.target.value as any)}
                  className="bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm px-2 py-1 text-xs font-bold text-rosebery-primary focus:outline-none cursor-pointer"
                >
                  <option value="Mint">Mint</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              ) : (
                <span className={`inline-flex items-center px-3 py-1 rounded border text-xs font-bold uppercase tracking-wider ${getGradeStyle(report.conditionNotes.overallGrade)}`}>
                  ★ {report.conditionNotes.overallGrade} Grade
                </span>
              )}
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <span className="text-xs text-rosebery-muted block mb-1">Plate Ink / Border Signature</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editSignatureStatus}
                  onChange={(e) => setEditSignatureStatus(e.target.value)}
                  className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm px-2.5 py-1 text-xs font-semibold text-rosebery-charcoal focus:outline-none"
                />
              ) : (
                <span className="text-xs font-semibold text-rosebery-charcoal block">
                  {report.conditionNotes.signatureStatus}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-rosebery-primary uppercase block mb-2.5 font-bold">VISIBLE SURFACE IRREGULARITIES</span>
              {report.conditionNotes.issuesDetected.length === 0 || (report.conditionNotes.issuesDetected.length === 1 && report.conditionNotes.issuesDetected[0].toLowerCase().includes("no obvious")) ? (
                <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  No high-risk environmental stains or tears observed in photography.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {report.conditionNotes.issuesDetected.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-rosebery-muted">
                      <span className="text-rosebery-primary font-bold mt-0.5 shrink-0">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-rosebery-primary uppercase block mb-2 font-bold">PRESENTATION & SHEET EDGE</span>
                {isEditing ? (
                  <textarea
                    value={editMattingAndMargins}
                    onChange={(e) => setEditMattingAndMargins(e.target.value)}
                    rows={3}
                    className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm p-2 text-xs text-rosebery-text-normal focus:outline-none"
                    placeholder="Matting and margins notes..."
                  />
                ) : (
                  <p className="text-xs text-rosebery-muted leading-relaxed">
                    {report.conditionNotes.mattingAndMargins}
                  </p>
                )}
              </div>
              
              <div className="bg-stone-50 border border-rosebery-border p-3 rounded">
                <span className="text-[10px] font-mono text-rosebery-primary font-semibold uppercase block mb-1">APPRAISER ANNOTATION</span>
                {isEditing ? (
                  <textarea
                    value={editAnalysisDetails}
                    onChange={(e) => setEditAnalysisDetails(e.target.value)}
                    rows={3}
                    className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm p-2 text-xs text-rosebery-text-normal focus:outline-none"
                    placeholder="Analysis details..."
                  />
                ) : (
                  <p className="text-xs text-rosebery-muted leading-relaxed">
                    {report.conditionNotes.analysisDetails}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Auction Sales block */}
      {report.recentAuctionSales && report.recentAuctionSales.length > 0 && (
        <div className="bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-rosebery-border pb-3">
            <span className="text-xs font-mono tracking-[0.2em] text-rosebery-primary uppercase flex items-center gap-2 font-bold">
              <Coins className="w-4 h-4 text-rosebery-primary" />
              RECENT BENCHMARK SALES (SAME OR SIMILAR PRINTS)
            </span>
            <span className="text-[10px] font-mono text-rosebery-muted uppercase tracking-wider">
              Market Pricing Indexes
            </span>
          </div>
          <div className="text-xs text-rosebery-muted bg-stone-50 p-3 rounded border border-rosebery-border leading-relaxed font-sans">
            These are public record benchmarks for corresponding print states, catalog editions, and impressions by this printmaker or similar contemporary runs of this medium/period.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {report.recentAuctionSales.map((sale, sIdx) => (
              <div key={sIdx} className="bg-stone-50 border border-rosebery-border p-4 rounded-lg flex flex-col justify-between space-y-3 shadow-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <h5 className="font-serif font-semibold text-rosebery-charcoal text-sm line-clamp-1">{sale.artworkTitle}</h5>
                    <span className="text-xs font-mono font-bold text-rosebery-primary bg-white px-2 py-0.5 rounded border border-rosebery-border shrink-0">
                      {formatAndConvertPriceRealized(sale.priceRealized, currency)}
                    </span>
                  </div>
                  <p className="text-[11px] text-rosebery-muted">{sale.artist} • <span className="italic font-serif">{sale.technique}</span></p>
                </div>
                
                <div className="border-t border-rosebery-border pt-2.5 space-y-1 text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-rosebery-muted font-mono">AUCTION HOUSE</span>
                    <span className="text-rosebery-charcoal font-semibold">{sale.auctionHouse}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-rosebery-muted font-mono">SALE DATE</span>
                    <span className="text-rosebery-muted">{sale.saleDate}</span>
                  </div>
                  <div className="text-[11px] text-rosebery-muted mt-1.5 pt-1.5 border-t border-rosebery-border italic leading-relaxed">
                    <span className="text-rosebery-muted font-mono not-italic block text-[9px] uppercase tracking-wider mb-0.5 font-bold">STATE RECORD NOTE</span>
                    "{sale.conditionState}"
                  </div>
                  {sale.wasSoldInBroaderLot !== undefined && (
                    <div className="text-[11px] mt-2.5 pt-2 border-t border-rosebery-border leading-relaxed">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-rosebery-muted font-mono text-[9px] uppercase tracking-wider font-bold">GROUP LOT ALLOCATION</span>
                      </div>
                      {sale.wasSoldInBroaderLot ? (
                        <div className="bg-[#FFF9F2] border border-[#F0DDC5] p-2 rounded-xs">
                          <p className="text-rosebery-primary text-[10px] font-sans font-semibold leading-tight">
                            Sold inside broader lot (Fractional value applied)
                          </p>
                          {sale.broaderLotPriceAdjustment && (
                            <p className="text-[10px] font-mono text-rosebery-muted mt-1">
                              Value Allocation: <span className="text-emerald-700 font-bold">{formatAndConvertPriceRealized(sale.broaderLotPriceAdjustment, currency)}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xs text-emerald-800 font-sans text-[10px] leading-tight flex items-center gap-1">
                          <span>Standalone Transaction</span>
                          <span className="text-[9px] text-emerald-700 font-mono">• No Allocation Needed</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technical Printmaking Detail Block */}
      <div className="bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft">
        <span className="text-xs font-mono tracking-[0.2em] text-rosebery-primary uppercase flex items-center gap-2 mb-5 border-b border-rosebery-border pb-3 font-bold">
          <Layers className="w-4 h-4 text-rosebery-primary" />
          IDENTIFIED PRINT ARCHIVAL TECHNIQUES
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {report.techniques.map((tech, index) => (
            <div key={index} className="bg-stone-50 border border-rosebery-border p-5 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <h4 className="font-serif font-semibold text-rosebery-charcoal text-md tracking-wide">{tech.technique}</h4>
                  <span className="text-[10px] font-mono bg-white text-rosebery-primary border border-rosebery-border px-2 py-1 rounded font-bold">
                    {tech.confidence}% matched
                  </span>
                </div>
                <p className="text-xs text-rosebery-muted mb-4 italic leading-relaxed">
                  {tech.description}
                </p>
              </div>

              <div className="border-t border-rosebery-border pt-3">
                <span className="text-[9px] font-mono text-rosebery-primary uppercase tracking-widest block mb-1.5 font-bold">
                  CORROBORATIVE EVIDENCE IN PHOTO
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tech.evidenceIdentified.map((ev, evIdx) => (
                    <span 
                      key={evIdx} 
                      className="text-[10px] bg-rosebery-cream-bg border border-rosebery-border text-rosebery-charcoal px-2 py-0.5 rounded"
                    >
                      ✓ {ev}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual & Historical Context Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Visual Description */}
        <div className="bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft">
          <span className="text-xs font-mono tracking-[0.2em] text-rosebery-primary uppercase flex items-center gap-2 mb-3.5 font-bold">
            <Info className="w-4 h-4" />
            COMPOSITION & ICONOGRAPHY NOTES
          </span>
          {isEditing ? (
            <textarea
              value={editVisualDescription}
              onChange={(e) => setEditVisualDescription(e.target.value)}
              rows={6}
              className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm p-3 text-xs text-rosebery-text-normal focus:outline-none leading-relaxed"
              placeholder="Visual composition notes..."
            />
          ) : (
            <p className="text-xs text-rosebery-muted leading-relaxed">
              {report.visualDescription}
            </p>
          )}
        </div>

        {/* Historical Context */}
        <div className="bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft">
          <span className="text-xs font-mono tracking-[0.2em] text-rosebery-primary uppercase flex items-center gap-2 mb-3.5 font-bold">
            <Compass className="w-4 h-4" />
            HISTORICAL SIGNIFICANCE & BACKGROUND
          </span>
          {isEditing ? (
            <textarea
              value={editHistoricalContext}
              onChange={(e) => setEditHistoricalContext(e.target.value)}
              rows={6}
              className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm p-3 text-xs text-rosebery-text-normal focus:outline-none leading-relaxed"
              placeholder="Historical context notes..."
            />
          ) : (
            <p className="text-xs text-rosebery-muted leading-relaxed">
              {report.historicalContext}
            </p>
          )}
        </div>
      </div>

      {/* Supplementary Microscopic / Closeup Analytics block */}
      {(isEditing || report.signatureAnalysis || report.damageAnalysis || report.inferredDimensions) && (
        <div className="bg-white border border-rosebery-border rounded-xl p-6 md:p-8 shadow-gallery-soft space-y-6">
          <div className="border-b border-rosebery-border pb-3.5">
            <span className="text-xs font-mono tracking-[0.2em] text-rosebery-primary uppercase block mb-1 font-bold">
              HIGH-MAGNIFICATION SPECIMEN EXAMINATIONS
            </span>
            <h3 className="text-xl md:text-2xl font-serif text-rosebery-charcoal font-semibold">Macro Closeup Analysis</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Signature analysis block */}
            {(isEditing || (report.signatureAnalysis && report.signatureAnalysis !== "No custom closeup scan provided. Overview signature status analyzed under condition details.")) && (
              <div className="bg-stone-50 border border-rosebery-border p-5 rounded-lg space-y-3 shadow-xs flex-1">
                <span className="text-[10px] font-mono tracking-wider text-rosebery-primary uppercase block border-b border-rosebery-border pb-1.5 flex items-center gap-1.5 font-bold">
                  ✒️ SIGNATURE & EDITION VERIFIER
                </span>
                {isEditing ? (
                  <textarea
                    value={editSignatureAnalysis}
                    onChange={(e) => setEditSignatureAnalysis(e.target.value)}
                    rows={4}
                    className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm p-2.5 text-xs text-rosebery-text-normal focus:outline-none leading-relaxed font-sans"
                    placeholder="Signature analysis details..."
                  />
                ) : (
                  <p className="text-xs text-rosebery-muted leading-relaxed font-sans mt-2">
                    {report.signatureAnalysis}
                  </p>
                )}
              </div>
            )}

            {/* Damage analysis block */}
            {(isEditing || (report.damageAnalysis && report.damageAnalysis !== "No custom damage closeup scan provided.")) && (
              <div className="bg-stone-50 border border-rosebery-border p-5 rounded-lg space-y-3 shadow-xs flex-1">
                <span className="text-[10px] font-mono tracking-wider text-rosebery-primary uppercase block border-b border-rosebery-border pb-1.5 flex items-center gap-1.5 font-bold">
                  🔍 DETAIL CONSERVATION ANALYTICS
                </span>
                {isEditing ? (
                  <textarea
                    value={editDamageAnalysis}
                    onChange={(e) => setEditDamageAnalysis(e.target.value)}
                    rows={4}
                    className="w-full bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-sm p-2.5 text-xs text-rosebery-text-normal focus:outline-none leading-relaxed font-sans"
                    placeholder="Damage analysis details..."
                  />
                ) : (
                  <p className="text-xs text-rosebery-muted leading-relaxed font-sans mt-2">
                    {report.damageAnalysis}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Inferred Dimensions Row inside closer */}
          {(isEditing || report.inferredDimensions) && (
            <div className="bg-stone-50 border border-rosebery-border px-4 py-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-l-2 border-l-[#4C0B2A]">
              <div className="space-y-0.5">
                <span className="text-[9px] font-mono text-rosebery-primary uppercase tracking-wider block font-bold">INFERRED DIMENSIONS (CALIBRATED METRICS)</span>
                <p className="text-xs font-serif italic text-rosebery-muted">Calculated or estimated using standard comparative coordinates.</p>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editInferredDimensions}
                  onChange={(e) => setEditInferredDimensions(e.target.value)}
                  placeholder="e.g. 45 x 60 cm"
                  className="text-xs font-mono font-bold text-rosebery-primary bg-rosebery-sage border border-rosebery-sage-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 px-3 py-1.5 rounded-sm focus:outline-none"
                />
              ) : (
                <span className="text-xs font-mono font-bold text-rosebery-primary bg-white px-3 py-1.5 border border-rosebery-border rounded-sm select-all sm:text-right">
                  {report.inferredDimensions}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Auxiliary Uploads Section inside Report */}
      {onReAnalyze && (
        <div className="bg-white border border-rosebery-border rounded-xl p-6 md:p-8 shadow-gallery-soft space-y-6">
          <div className="border-b border-rosebery-border pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-rosebery-primary block mb-1 font-bold">
                RE-EVALUATE / REFINE SPECIMEN DETAILS
              </span>
              <h3 className="text-xl font-serif text-rosebery-charcoal font-semibold">Optimize Appraisal with Macro Close-Ups</h3>
            </div>
            <span className="text-[9px] font-mono text-rosebery-muted uppercase tracking-wider">
              Auxiliary Scan Inputs
            </span>
          </div>

          <p className="text-xs text-rosebery-muted leading-relaxed">
            Enhance the authentication and valuation accuracy. You can upload close-up views of the plate signature, printmaker stamps, condition damage/staining, or place a coin adjacent to the print margins to automatically infer the physical dimensions of the artwork.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Signature Close-Up */}
            <div className="bg-stone-50 border border-rosebery-border rounded-sm p-3.5 flex flex-col justify-between space-y-3 relative overflow-hidden group">
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && setSignatureFile && setSignaturePreview) {
                     setSignatureFile(file);
                     setSignaturePreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
              />
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-rosebery-charcoal font-bold block uppercase tracking-wider">
                  ✒️ 1. Signature Closeup
                </label>
                <p className="text-[10.5px] text-rosebery-muted leading-relaxed">
                  Upload a high-fidelity macro photo of the signature, monogram or edition numbers.
                </p>
              </div>
              {signaturePreview ? (
                <div className="relative aspect-video rounded-sm overflow-hidden bg-black border border-rosebery-border shadow-gallery-soft">
                  <img src={signaturePreview} alt="Signature zoom" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      if (setSignatureFile && setSignaturePreview) {
                        setSignatureFile(null);
                        if (signaturePreview) URL.revokeObjectURL(signaturePreview);
                        setSignaturePreview(null);
                      }
                    }}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded p-1 shadow transition-all cursor-pointer"
                    title="Delete Zoom"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => signatureInputRef?.current?.click()}
                  className="py-2 px-3 border border-dashed border-rosebery-border hover:border-rosebery-primary bg-white text-[11px] font-mono text-rosebery-muted hover:text-rosebery-primary rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-rosebery-primary" />
                  Upload Closeup
                </button>
              )}
            </div>

            {/* 2. Damage Close-up */}
            <div className="bg-stone-50 border border-rosebery-border rounded-sm p-3.5 flex flex-col justify-between space-y-3 relative overflow-hidden group">
              <input
                ref={damageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && setDamageFile && setDamagePreview) {
                    setDamageFile(file);
                    setDamagePreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
              />
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-rosebery-charcoal font-bold block uppercase tracking-wider">
                  🔍 2. Damage Detail
                </label>
                <p className="text-[10.5px] text-rosebery-muted leading-relaxed font-sans">
                  Upload details of water stains, tears, raking light creasing or foxing dots.
                </p>
              </div>
              {damagePreview ? (
                <div className="relative aspect-video rounded-sm overflow-hidden bg-black border border-rosebery-border shadow-gallery-soft">
                  <img src={damagePreview} alt="Damage zoom" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      if (setDamageFile && setDamagePreview) {
                        setDamageFile(null);
                        if (damagePreview) URL.revokeObjectURL(damagePreview);
                        setDamagePreview(null);
                      }
                    }}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded p-1 shadow transition-all cursor-pointer"
                    title="Delete Zoom"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => damageInputRef?.current?.click()}
                  className="py-2 px-3 border border-dashed border-rosebery-border hover:border-rosebery-primary bg-white text-[11px] font-mono text-rosebery-muted hover:text-rosebery-primary rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-rosebery-primary" />
                  Upload Closeup
                </button>
              )}
            </div>

            {/* 3. Coin scale reference */}
            <div className="bg-stone-50 border border-rosebery-border rounded-sm p-3.5 flex flex-col justify-between space-y-3 relative overflow-hidden group">
              <input
                ref={scaleInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && setScaleFile && setScalePreview) {
                    setScaleFile(file);
                    setScalePreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
              />
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-rosebery-charcoal font-bold block uppercase tracking-wider">
                  📏 3. Coin/Ruler Calibration
                </label>
                <p className="text-[10.5px] text-rosebery-muted leading-relaxed font-sans">
                  Upload a photo containing a coin or ruler near margins to infer physical sheet size.
                </p>
              </div>
              {scalePreview ? (
                <div className="relative aspect-video rounded-sm overflow-hidden bg-black border border-rosebery-border shadow-gallery-soft">
                  <img src={scalePreview} alt="Coin calibration" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      if (setScaleFile && setScalePreview) {
                        setScaleFile(null);
                        if (scalePreview) URL.revokeObjectURL(scalePreview);
                        setScalePreview(null);
                      }
                    }}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded p-1 shadow transition-all cursor-pointer"
                    title="Delete Zoom"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => scaleInputRef?.current?.click()}
                  className="py-2 px-3 border border-dashed border-rosebery-border hover:border-rosebery-primary bg-white text-[11px] font-mono text-rosebery-muted hover:text-rosebery-primary rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-rosebery-primary" />
                  Upload Closeup
                </button>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-rosebery-border flex justify-end">
            <button
              onClick={onReAnalyze}
              disabled={isLoading || (!signatureFile && !damageFile && !scaleFile)}
              className={`py-3 px-6 rounded-sm text-xs font-mono font-bold tracking-[0.2em] uppercase transition-all duration-300 flex items-center gap-2 ${
                (signatureFile || damageFile || scaleFile) && !isLoading
                  ? "bg-rosebery-primary text-white hover:bg-rosebery-primary-hover cursor-pointer shadow-gallery-deep hover:scale-[1.01]"
                  : "bg-rosebery-cream-bg border border-rosebery-border text-stone-400 cursor-not-allowed cursor-default"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {isLoading ? "REFRESHING APPRAISAL..." : "Refresh Appraisal with Closeups"}
            </button>
          </div>
        </div>
      )}

      {/* Conservator Recommendations Card */}
      <div className="bg-stone-50 border border-rosebery-border text-rosebery-text-normal rounded-xl p-6 md:p-8 shadow-gallery-soft">
        <div className="flex items-center gap-2.5 border-b border-rosebery-border pb-4 mb-5">
          <Award className="w-5 h-5 text-rosebery-primary shrink-0" />
          <div>
            <h4 className="text-md font-serif font-semibold text-rosebery-charcoal tracking-wide uppercase">ARCHIVAL CARE RECOMMENDATIONS</h4>
            <span className="text-[9px] font-mono text-rosebery-primary font-semibold uppercase tracking-[0.25em] block mt-0.5">
              PRESERVING AND AUTHENTICATING HAND-PULLED GRAPHICS
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 font-sans">
            <p className="text-xs leading-relaxed text-rosebery-muted">
              Hand-pulled prints are printed on reactive organic fiber sheets (such as cotton linen rag or traditional mulberry washi webs). They are fragile to temperature swings, direct raw sunlight waves, and permanent hinge binders.
            </p>
            <div className="bg-white p-4 rounded border border-rosebery-border">
              <span className="text-[10px] font-mono text-rosebery-primary block mb-1 font-bold">CRUCIAL CURATOR MANDATE</span>
              <p className="text-[11px] text-rosebery-muted italic leading-relaxed">
                Never trim paper borders or clean surface marks yourself! Trimming graphic print margins reduces market value by up to 50% as boundaries carry critical watermark details or cataloger pencil notations.
              </p>
            </div>
          </div>

          <div className="space-y-3 font-sans">
            <span className="text-xs font-mono text-rosebery-primary uppercase tracking-wider block font-bold">RECOMMENDED PRESERVATION STRATEGY</span>
            <ul className="space-y-2.5 text-xs">
              {report.nextSteps.map((rec, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center bg-white text-rosebery-primary rounded-full w-4.5 h-4.5 shrink-0 font-sans text-[10px] font-bold border border-rosebery-border">
                    {index + 1}
                  </span>
                  <span className="text-rosebery-muted leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Hidden Certificate Print View */}
      <div className="hidden print:flex bg-white text-rosebery-charcoal font-sans p-8 border-8 border-double border-[#C0AA84] rounded-sm max-w-4xl mx-auto my-4 min-h-[297mm] relative flex-col justify-between certificate-print-container">
        <div>
          {/* Certificate Header */}
          <div className="text-center border-b-2 border-rosebery-primary pb-6 mb-8">
            <span className="text-[10px] font-mono tracking-[0.3em] text-rosebery-primary uppercase font-bold block mb-1">
              ESTABLISHED fine art register
            </span>
            <h1 className="text-3xl font-serif font-black tracking-widest text-rosebery-primary uppercase">
              Appraisal Certificate
            </h1>
            <p className="text-[10px] font-mono text-rosebery-muted uppercase tracking-[0.25em] mt-1">
              PrintMasterAI Secure Archival Authentication
            </p>
          </div>

          {/* Certificate Content Grid */}
          <div className="grid grid-cols-3 gap-8 items-start mb-8">
            {/* Image Thumbnail */}
            <div className="col-span-1">
              {imageUrl ? (
                <div className="border border-rosebery-border p-2 bg-stone-50 shadow-gallery-soft rounded-sm">
                  <img 
                    src={imageUrl} 
                    alt={report.artworkTitle}
                    className="w-full h-auto object-contain rounded-sm max-h-[200px]"
                  />
                </div>
              ) : (
                <div className="border border-rosebery-border p-6 bg-stone-50 text-center text-[10px] font-mono text-rosebery-muted">
                  No Image Available
                </div>
              )}
            </div>

            {/* Core Artwork Metadata */}
            <div className="col-span-2 space-y-4">
              <div>
                <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block mb-0.5">ARTWORK TITLE</span>
                <h2 className="text-2xl font-serif text-rosebery-charcoal font-bold tracking-wide leading-tight">
                  {report.artworkTitle}
                </h2>
              </div>

              <div>
                <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block mb-0.5">ATTRIBUTED ARTIST</span>
                <p className="text-md font-sans font-bold text-rosebery-primary">
                  {report.likelyArtist} <span className="text-xs font-normal text-rosebery-muted">({report.artistConfidence}% Attribution Probability)</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block mb-0.5">CREATION PERIOD</span>
                  <p className="text-xs font-mono font-semibold text-rosebery-charcoal">{report.creationPeriod}</p>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block mb-0.5">EDITION SIZE / NO.</span>
                  <p className="text-xs font-serif italic text-rosebery-charcoal">{report.editionSizeAndPrintNumber || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Appraisal Metrics Grid */}
          <div className="grid grid-cols-3 gap-4 border-y border-rosebery-border py-6 mb-8 text-center bg-rosebery-cream-bg">
            <div>
              <span className="text-[10px] font-mono text-rosebery-muted uppercase tracking-widest block mb-1">Preservation Grade</span>
              <span className="text-sm font-bold text-rosebery-primary uppercase tracking-wider">
                ★ {report.conditionNotes.overallGrade} Grade
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-rosebery-muted uppercase tracking-widest block mb-1">Archival Technique</span>
              <span className="text-sm font-bold text-rosebery-charcoal">
                {report.techniques[0]?.technique || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-rosebery-muted uppercase tracking-widest block mb-1">Auction Value Estimate</span>
              <span className="text-sm font-serif font-bold text-rosebery-primary">
                {report.auctionEstimate.lowEstimate === 0 
                  ? "Speculative" 
                  : `${getCurrencySymbol(report.auctionEstimate.currency)}${report.auctionEstimate.lowEstimate.toLocaleString()} - ${getCurrencySymbol(report.auctionEstimate.currency)}${report.auctionEstimate.highEstimate.toLocaleString()} ${report.auctionEstimate.currency}`}
              </span>
            </div>
          </div>

          {/* Descriptive Content Blocks */}
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block mb-1">Composition & Iconography Notes</span>
              <p className="text-xs text-rosebery-text-normal leading-relaxed text-justify">
                {report.visualDescription}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block mb-1">Historical Significance</span>
              <p className="text-xs text-rosebery-text-normal leading-relaxed text-justify">
                {report.historicalContext}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold block mb-1">Condition & Conservation Recapitulation</span>
              <p className="text-xs text-rosebery-text-normal leading-relaxed text-justify">
                {report.conditionNotes.analysisDetails || "No conservation anomalies logged."}
              </p>
            </div>
          </div>
        </div>

        {/* Certificate Footer */}
        <div className="mt-12 pt-8 border-t border-rosebery-border flex justify-between items-end">
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-rosebery-muted uppercase tracking-wider block">secure verification hash</span>
            <span className="text-[9px] font-mono text-rosebery-charcoal bg-rosebery-cream-bg px-2 py-1 border border-rosebery-border rounded-sm uppercase">
              PM-CERT-{report.artworkTitle.substring(0,4).replace(/[^a-zA-Z]/g, "").toUpperCase()}-{Math.random().toString(36).substring(2,7).toUpperCase()}
            </span>
          </div>

          <div className="text-center space-y-1 w-48 border-t border-dashed border-[#6B5E62] pt-2">
            <span className="text-[10px] font-sans text-rosebery-charcoal block">Authorized Curator Signature</span>
            <span className="text-[9px] font-mono text-rosebery-muted block">Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
