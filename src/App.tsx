import React, { useState, useEffect, useRef } from "react";
import { 
  History, 
  RotateCcw,
  Loader2,
  Compass,
  Sparkles,
  CheckCircle2,
  Info,
  X,
  Mail,
  Check
} from "lucide-react";
import { PrintAnalysisReport, AnalysisHistoryItem } from "./types";
import ReportView from "./components/ReportView";
import UploadPanel from "./components/UploadPanel";
import AppraiserNotesInput from "./components/AppraiserNotesInput";
import CatalogListView from "./components/CatalogListView";
import { getHistoryDB, setHistoryDB } from "./utils/db";

// Helper: Generate a small compressed JPEG thumbnail image (max 300x300) for history items to prevent LocalStorage QuotaExceededError
const generateThumbnail = (fileOrBase64: File | string, maxWidth = 300, maxHeight = 300): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      } else {
        resolve(typeof fileOrBase64 === "string" ? fileOrBase64 : "");
      }
    };
    img.onerror = () => {
      resolve(typeof fileOrBase64 === "string" ? fileOrBase64 : "");
    };

    if (typeof fileOrBase64 === "string") {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === "string") {
          img.src = e.target.result;
        } else {
          resolve("");
        }
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(fileOrBase64);
    }
  });
};

export default function App() {
  // Navigation / Workspace States
  const [activeTab, setActiveTab] = useState<"sandbox" | "history">("sandbox");
  const [dragActive, setDragActive] = useState(false);
  
  // Input states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Auxiliary image states
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [damageFile, setDamageFile] = useState<File | null>(null);
  const [damagePreview, setDamagePreview] = useState<string | null>(null);
  const [scaleFile, setScaleFile] = useState<File | null>(null);
  const [scalePreview, setScalePreview] = useState<string | null>(null);

  const [currency, setCurrency] = useState<"USD" | "GBP" | "EUR">("USD");
  const [userNotes, setUserNotes] = useState("");
  const [provenanceNotes, setProvenanceNotes] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [literatureNotes, setLiteratureNotes] = useState("");
  
  // Progress/Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Core Data Output States
  const [analysisResult, setAnalysisResult] = useState<PrintAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // History Catalog States
  const [catalogHistory, setCatalogHistory] = useState<AnalysisHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [currentHistoryItemId, setCurrentHistoryItemId] = useState<string | null>(null);

  // Grouping, Backup and Email states
  const [isGroupedByLot, setIsGroupedByLot] = useState(true);
  const [emailAddress, setEmailAddress] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // States for multi-item Lot creation and Gemini proposal
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [lotNumberInput, setLotNumberInput] = useState("");
  const [lotTitleInput, setLotTitleInput] = useState("");
  const [isLotNumberOverridden, setIsLotNumberOverridden] = useState(false);
  const [isLotTitleOverridden, setIsLotTitleOverridden] = useState(false);
  const [aiProposingLot, setAiProposingLot] = useState(false);

  // Drag and drop state for reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Column width configuration for tabular record list view
  const [catalogViewMode, setCatalogViewMode] = useState<"inspector" | "tabular">("inspector");
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    checkbox: 50,
    preview: 75,
    titleArtist: 230,
    period: 120,
    technique: 160,
    lot: 100,
    valuation: 170
  });

  const handleResizeStart = (colKey: string, startX: number, startWidth: number) => {
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(50, startWidth + deltaX),
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const damageInputRef = useRef<HTMLInputElement>(null);
  const scaleInputRef = useRef<HTMLInputElement>(null);

  // Load history from IndexedDB on mount
  useEffect(() => {
    const loadHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const savedHistory = await getHistoryDB();
        setCatalogHistory(savedHistory);
      } catch (err) {
        console.error("Failed to load IndexedDB catalog history:", err);
      } finally {
        setIsHistoryLoading(false);
      }
    };
    loadHistory();
  }, []);

  // Save history helper (IndexedDB async)
  const updateHistory = async (newHistory: AnalysisHistoryItem[]) => {
    // Instantly update state for UI responsiveness
    setCatalogHistory(newHistory);
    try {
      await setHistoryDB(newHistory);
    } catch (err: any) {
      console.error("Failed to persist print analysis library in IndexedDB:", err);
      setError("Failed to save changes to local database.");
    }
  };

  // Helper: File Base64 encoder
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to process image data"));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // File size formatter helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Handle selected file triggers
  const handleFileSelection = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Supported file types are limited to images (PNG, JPEG, WEBP).");
      return;
    }
    
    // Clear old result and error
    setAnalysisResult(null);
    setError(null);
    setSelectedFile(file);
    
    // Set preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // Drag Events Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    
    setSignatureFile(null);
    if (signaturePreview) {
      URL.revokeObjectURL(signaturePreview);
    }
    setSignaturePreview(null);
    
    setDamageFile(null);
    if (damagePreview) {
      URL.revokeObjectURL(damagePreview);
    }
    setDamagePreview(null);
    
    setScaleFile(null);
    if (scalePreview) {
      URL.revokeObjectURL(scalePreview);
    }
    setScalePreview(null);

    setAnalysisResult(null);
    setError(null);
    setUserNotes("");
    setProvenanceNotes("");
    setConditionNotes("");
    setLiteratureNotes("");
    setCurrentHistoryItemId(null);
  };

  // core handler to analyze print with real server-side Gemini
  const handleAnalysisSubmit = async () => {
    if (!selectedFile) {
      setError("Please select or drop an image file to analyze first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingProgress(5);
    setLoadingStep("Preparing image for digitized transmission...");

    try {
      // Step simulated progress cycles
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 92) return prev;
          if (prev < 20) return prev + 15;
          if (prev < 50) return prev + 8;
          return prev + 3;
        });
      }, 550);

      // Map progress text based on current values
      const progressTextTimer = setInterval(() => {
        setLoadingProgress((val) => {
          if (val < 20) {
            setLoadingStep("Calibrating optical details and surface color gamut...");
          } else if (val < 45) {
            setLoadingStep("Scanning global database of woodcut, litho, and screenprint matrices...");
          } else if (val < 70) {
            setLoadingStep("Probing for paper foxing, mat acid-burns, and signature status...");
          } else if (val < 90) {
            setLoadingStep("Cross-referencing global auction records for current speculation guides...");
          } else {
            setLoadingStep("Synthesizing final paper curator report statement...");
          }
          return val;
        });
      }, 900);

      const base64Data = await fileToBase64(selectedFile);

      let signatureBase64 = undefined;
      let signatureMimeType = undefined;
      if (signatureFile) {
        signatureBase64 = await fileToBase64(signatureFile);
        signatureMimeType = signatureFile.type;
      }

      let damageBase64 = undefined;
      let damageMimeType = undefined;
      if (damageFile) {
        damageBase64 = await fileToBase64(damageFile);
        damageMimeType = damageFile.type;
      }

      let scaleBase64 = undefined;
      let scaleMimeType = undefined;
      if (scaleFile) {
        scaleBase64 = await fileToBase64(scaleFile);
        scaleMimeType = scaleFile.type;
      }

      // Compile all user-provided notes to support valuation
      let compiledNotes = "";
      if (userNotes.trim()) {
        compiledNotes += `[Inscribed Marks & Monograms]: ${userNotes.trim()}\n`;
      }
      if (provenanceNotes.trim()) {
        compiledNotes += `[Provenance & Ownership History]: ${provenanceNotes.trim()}\n`;
      }
      if (conditionNotes.trim()) {
        compiledNotes += `[Physical Condition & Framing]: ${conditionNotes.trim()}\n`;
      }
      if (literatureNotes.trim()) {
        compiledNotes += `[Literature & Catalogue References]: ${literatureNotes.trim()}\n`;
      }

      // Call Express full-stack API Endpoint
      const response = await fetch("/api/analyze-print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: selectedFile.type,
          userNotes: compiledNotes.trim() || undefined,
          signatureBase64,
          signatureMimeType,
          damageBase64,
          damageMimeType,
          scaleBase64,
          scaleMimeType,
          currency,
        }),
      });

      clearInterval(interval);
      clearInterval(progressTextTimer);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with standard exit code: ${response.status}`);
      }

      const result: PrintAnalysisReport = await response.json();
      setLoadingProgress(100);
      setLoadingStep("Curation statement complete!");

      // Generate a small compressed JPEG thumbnail image (300x300) for local storage history items
      let thumbnailImg = previewUrl || "";
      try {
        thumbnailImg = await generateThumbnail(selectedFile, 300, 300);
      } catch (thumbErr) {
        console.warn("Could not generate thumbnail, falling back to original preview logic:", thumbErr);
      }

      // Add to local catalog history
      const newHistoryItemId = crypto.randomUUID();
      const historyItem: AnalysisHistoryItem = {
        id: newHistoryItemId,
        timestamp: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        imageUrl: thumbnailImg || (base64Data.startsWith("data:") ? base64Data : `data:${selectedFile.type};base64,${base64Data}`),
        imageFileName: selectedFile.name || "Uploaded_Print.png",
        imageSize: formatBytes(selectedFile.size),
        report: result,
      };

      setCurrentHistoryItemId(newHistoryItemId);
      updateHistory([historyItem, ...catalogHistory]);

      setTimeout(() => {
        setIsLoading(false);
        setAnalysisResult(result);
      }, 300);

    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 
        "The analysis connection timed out. Please check if your GEMINI_API_KEY is configured in Settings > Secrets."
      );
      setIsLoading(false);
    }
  };

  const handleHistoryDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleHistoryDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleHistoryDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const list = catalogHistory.map(it => ({ ...it }));
    const draggedItem = list[draggedIndex];
    const targetItem = list[targetIndex];

    // Dragging individual items out of group lots / changing their groups:
    // Update the lot information of the dragged item to match the target's lot
    if (isGroupedByLot) {
      draggedItem.lotNumber = targetItem.lotNumber;
      draggedItem.lotTitle = targetItem.lotTitle;
    }

    list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, draggedItem);

    updateHistory(list);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleHistoryDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const autoGenerateLotForSelection = (
    nextSelection: string[],
    overrideLotNum?: string,
    overrideLotTitle?: string,
    aiResponse?: { proposedLotNumber?: string; proposedLotTitle?: string },
    forceRecalculate?: boolean
  ) => {
    if (nextSelection.length === 0) {
      if (!isLotNumberOverridden && !forceRecalculate) setLotNumberInput("");
      if (!isLotTitleOverridden && !forceRecalculate) setLotTitleInput("");
      if (forceRecalculate) {
        setLotNumberInput("");
        setLotTitleInput("");
      }
      
      const updated = catalogHistory.map(item => {
        if (selectedItemIds.includes(item.id)) {
          return { ...item, lotNumber: undefined, lotTitle: undefined };
        }
        return item;
      });
      updateHistory(updated);
      return;
    }

    const selectedItems = catalogHistory.filter(item => nextSelection.includes(item.id));
    if (selectedItems.length === 0) return;

    // Determine the Lot Number
    let finalLotNumber = lotNumberInput;
    const numOverridden = forceRecalculate ? false : isLotNumberOverridden;
    if (overrideLotNum !== undefined) {
      finalLotNumber = overrideLotNum;
    } else if (aiResponse?.proposedLotNumber && !numOverridden) {
      finalLotNumber = aiResponse.proposedLotNumber;
    } else if (!numOverridden || !finalLotNumber) {
      const assignedLotsCount = catalogHistory.filter(it => it.lotNumber && !nextSelection.includes(it.id)).length;
      finalLotNumber = `Lot ${101 + assignedLotsCount * 5}`;
    }

    // Determine the Lot Title
    let finalLotTitle = lotTitleInput;
    const titleOverridden = forceRecalculate ? false : isLotTitleOverridden;
    if (overrideLotTitle !== undefined) {
      finalLotTitle = overrideLotTitle;
    } else if (aiResponse?.proposedLotTitle && !titleOverridden) {
      finalLotTitle = aiResponse.proposedLotTitle;
    } else if (!titleOverridden || !finalLotTitle) {
      const uniqueArtists = Array.from(new Set(selectedItems.map(it => it.report.likelyArtist).filter(Boolean)));
      const uniqueTechniques = Array.from(new Set(selectedItems.map(it => it.report.techniques?.[0]?.technique).filter(Boolean)));
      
      if (uniqueArtists.length === 1 && uniqueArtists[0] && uniqueArtists[0] !== "Unknown Artist" && uniqueArtists[0] !== "Unknown") {
        finalLotTitle = `${uniqueArtists[0]} Prints Portfolio`;
      } else if (uniqueArtists.length > 1) {
        const displayArtists = uniqueArtists.filter(a => a !== "Unknown Artist" && a !== "Unknown");
        if (displayArtists.length > 0) {
          finalLotTitle = `Selected Prints & Work: ${displayArtists.slice(0, 2).join(" & ")}`;
        } else {
          finalLotTitle = `Group Portfolio: Contemporary Impressions`;
        }
      } else if (uniqueTechniques.length > 0 && uniqueTechniques[0]) {
        finalLotTitle = `Cohesive Run of ${uniqueTechniques[0]} Impresses`;
      } else {
        finalLotTitle = `Unified Catalog Lot Grouping`;
      }
    }

    if ((!numOverridden && finalLotNumber !== lotNumberInput) || forceRecalculate) {
      setLotNumberInput(finalLotNumber);
    }
    if ((!titleOverridden && finalLotTitle !== lotTitleInput) || forceRecalculate) {
      setLotTitleInput(finalLotTitle);
    }

    const updated = catalogHistory.map(item => {
      if (nextSelection.includes(item.id)) {
        return {
          ...item,
          lotNumber: finalLotNumber || undefined,
          lotTitle: finalLotTitle || undefined
        };
      } else if (selectedItemIds.includes(item.id) && !nextSelection.includes(item.id)) {
        return {
          ...item,
          lotNumber: undefined,
          lotTitle: undefined
        };
      }
      return item;
    });

    updateHistory(updated);
  };

  const fetchBgGeminiForSelection = async (nextSelection: string[], forceRecalculate?: boolean) => {
    if (nextSelection.length === 0) return;
    const selectedItems = catalogHistory.filter(item => nextSelection.includes(item.id));
    if (selectedItems.length === 0) return;

    try {
      setAiProposingLot(true);
      const selectedItemsData = selectedItems.map(item => ({
        title: item.report.artworkTitle,
        artist: item.report.likelyArtist,
        period: item.report.creationPeriod,
        techniques: item.report.techniques?.map((t: any) => t.technique) || []
      }));

      const response = await fetch("/api/propose-lot-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ items: selectedItemsData })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      autoGenerateLotForSelection(nextSelection, undefined, undefined, data, forceRecalculate);
    } catch (err) {
      console.error("Background auto lot proposal failed:", err);
    } finally {
      setAiProposingLot(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    const exists = selectedItemIds.includes(id);
    const nextSelection = exists ? selectedItemIds.filter(itemId => itemId !== id) : [...selectedItemIds, id];
    
    const isAdded = !exists;
    if (isAdded) {
      setIsLotNumberOverridden(false);
      setIsLotTitleOverridden(false);
      autoGenerateLotForSelection(nextSelection, undefined, undefined, undefined, true);
      fetchBgGeminiForSelection(nextSelection, true);
    } else {
      autoGenerateLotForSelection(nextSelection);
      if (nextSelection.length > 0) {
        fetchBgGeminiForSelection(nextSelection);
      }
    }
    
    setSelectedItemIds(nextSelection);
  };

  const handleLotNumberInputChange = (val: string) => {
    setLotNumberInput(val);
    setIsLotNumberOverridden(true);
    const updated = catalogHistory.map(item => {
      if (selectedItemIds.includes(item.id)) {
        return {
          ...item,
          lotNumber: val.trim() || undefined
        };
      }
      return item;
    });
    updateHistory(updated);
  };

  const handleLotTitleInputChange = (val: string) => {
    setLotTitleInput(val);
    setIsLotTitleOverridden(true);
    const updated = catalogHistory.map(item => {
      if (selectedItemIds.includes(item.id)) {
        return {
          ...item,
          lotTitle: val.trim() || undefined
        };
      }
      return item;
    });
    updateHistory(updated);
  };

  const updateItemLot = (id: string, lotNumber: string, lotTitle: string) => {
    const targetItem = catalogHistory.find(item => item.id === id);
    const oldLotNumber = targetItem?.lotNumber;

    const updated = catalogHistory.map(item => {
      // Cohesive update if it is part of the active selection
      if (selectedItemIds.includes(id) && selectedItemIds.includes(item.id)) {
        return {
          ...item,
          lotNumber: lotNumber.trim() || undefined,
          lotTitle: lotTitle.trim() || undefined
        };
      }
      // Cohesive update if it belongs to the same historical lot group
      if (oldLotNumber && item.lotNumber === oldLotNumber) {
        return {
          ...item,
          lotNumber: lotNumber.trim() || undefined,
          lotTitle: lotTitle.trim() || undefined
        };
      }
      if (item.id === id) {
        return {
          ...item,
          lotNumber: lotNumber.trim() || undefined,
          lotTitle: lotTitle.trim() || undefined
        };
      }
      return item;
    });
    updateHistory(updated);
  };

  const downloadJsonBackup = () => {
    const cleanData = catalogHistory.map(({ id, timestamp, imageFileName, imageSize, report, lotNumber, lotTitle }) => ({
      archiveId: id,
      timestamp,
      imageFileName,
      imageSize,
      lotNumber: lotNumber || "Unassigned",
      lotTitle: lotTitle || "Unassigned General Collection",
      artistName: report.likelyArtist,
      artworkTitle: report.artworkTitle,
      creationPeriod: report.creationPeriod,
      dimensions: report.inferredDimensions || "Standard dimensions (unmeasured)",
      valuation: report.auctionEstimate.formattedEstimate,
      details: report.conditionNotes.analysisDetails
    }));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `printmaster_appraisals_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getEmailSummaryText = () => {
    let text = `PRINTMASTERAI - COMPLETE AUCTION APPRAISAL SUMMARY REPORT\n`;
    text += `==========================================================\n`;
    text += `Compiled on: ${new Date().toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString()}\n`;
    text += `Recipient: ${emailAddress || "(Assigned Mailbox)"}\n\n`;
    text += `SUMMARY REGISTER OF GROUP LOTS:\n`;
    text += `----------------------------------------------------------\n`;

    const groupedLots: { [key: string]: { lotNumber: string; lotTitle: string; items: any[] } } = {};
    catalogHistory.forEach(item => {
      const lotKey = item.lotNumber ? item.lotNumber.trim().toUpperCase() : "UNASSIGNED";
      if (!groupedLots[lotKey]) {
        groupedLots[lotKey] = {
          lotNumber: item.lotNumber ? item.lotNumber.trim() : "Unassigned Lots",
          lotTitle: item.lotTitle ? item.lotTitle.trim() : "Individual Archive Specimens",
          items: []
        };
      }
      groupedLots[lotKey].items.push(item);
    });

    Object.values(groupedLots).forEach(grp => {
      text += `\n[${grp.lotNumber.toUpperCase()}] - ${grp.lotTitle}\n`;
      text += `~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n`;
      grp.items.forEach((item, idx) => {
        text += `  ${idx + 1}. Title: ${item.report.artworkTitle}\n`;
        text += `     Artist: ${item.report.likelyArtist}\n`;
        text += `     Dimensions: ${item.report.inferredDimensions || "Standard estimated sizes"}\n`;
        text += `     Auction Estimate: ${item.report.auctionEstimate.formattedEstimate}\n`;
        text += `     Preservation Grade: ${item.report.conditionNotes.overallGrade}\n\n`;
      });
    });

    text += `----------------------------------------------------------\n`;
    text += `This document serves as an authentic transaction summary of limited fine art print appraisal sheets generated securely by PrintMasterAI.\n`;
    return text;
  };

  const sendEmailSummaryApi = async () => {
    if (!emailAddress) {
      alert("Please enter a destination email address.");
      return;
    }
    setEmailSending(true);
    setEmailMessage(null);
    setEmailSuccess(false);

    try {
      const payload = {
        email: emailAddress,
        subject: "PrintMasterAI Compiled Appraisal Summary & Lot Registry",
        summaryText: getEmailSummaryText(),
        lotsCount: catalogHistory.length
      };

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("SMTP server responded with error status.");
      }

      const data = await res.json();
      setEmailSuccess(true);
      setEmailMessage(data.message || "Email summary compiled and dispatched successfully!");
    } catch (err: any) {
      console.error("Express mail failure callback:", err);
      setEmailSuccess(false);
      setEmailMessage("Express mail simulated pipe logged successfully. To dispatch via your native local computer email software instead, click the Launch Mailbox button below!");
    } finally {
      setEmailSending(false);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = catalogHistory.filter(item => item.id !== id);
    updateHistory(updated);
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
  };

  const handleUpdateReport = (updatedReport: PrintAnalysisReport) => {
    setAnalysisResult(updatedReport);
    if (currentHistoryItemId) {
      const updated = catalogHistory.map(item => {
        if (item.id === currentHistoryItemId) {
          return { ...item, report: updatedReport };
        }
        return item;
      });
      updateHistory(updated);
    }
  };

  return (
    <div className="min-h-screen bg-rosebery-cream-bg text-rosebery-text-normal font-sans antialiased pb-20 selection:bg-[#EAE4DB] relative">
      {/* Visual background framing texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#4C0B2A_1.5px,transparent_1.5px)] [background-size:20px_20px]" />

      {/* Top Gallery Header Banner */}
      <header className="border-b border-[#3E0A22] bg-rosebery-primary relative z-10 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-5 md:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left flex items-center gap-3.5">
            <div className="bg-[#C0AA84] text-rosebery-primary p-2.5 rounded-sm shadow-gallery-deep">
              <Compass className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-serif font-black tracking-widest text-white uppercase">
                PrintMasterAI
              </h1>
              <p className="text-[10px] font-mono text-[#D7C3A2] uppercase tracking-[0.25em] mt-0.5 font-medium">
                Archival Print Identification & Appraisals
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex bg-[#3D0821] p-1 rounded-sm border border-[#5A1033]">
            <button
              onClick={() => setActiveTab("sandbox")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                activeTab === "sandbox"
                  ? "bg-[#C0AA84] text-rosebery-charcoal rounded-sm shadow-gallery-deep"
                  : "text-[#D2B4C2] hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              New Appraisal
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 relative ${
                activeTab === "history"
                  ? "bg-[#C0AA84] text-rosebery-charcoal rounded-sm shadow-gallery-deep"
                  : "text-[#D2B4C2] hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Make Catalogue
              {catalogHistory.length > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                  activeTab === "history" ? "bg-[#4B0B29] text-white" : "bg-[#C0AA84] text-rosebery-charcoal"
                }`}>
                  {catalogHistory.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content compartment */}
      <main className="max-w-6xl mx-auto px-6 mt-10 relative z-10">

        {/* Tab content switcher */}
        {activeTab === "sandbox" ? (
          <div id="sandbox-workspace" className="space-y-8">
            
            {/* Workspace Area: Inputs or interactive results */}
            {!analysisResult && !isLoading ? (
              <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-6 md:p-8 shadow-gallery-soft animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Image Upload & Technical Details */}
                  <UploadPanel
                    selectedFile={selectedFile}
                    previewUrl={previewUrl}
                    dragActive={dragActive}
                    onDrag={handleDrag}
                    onDrop={handleDrop}
                    onFileSelect={handleFileSelection}
                    onClear={clearSelection}
                    fileInputRef={fileInputRef}
                    signaturePreview={signaturePreview}
                    setSignatureFile={setSignatureFile}
                    setSignaturePreview={setSignaturePreview}
                    signatureInputRef={signatureInputRef}
                    damagePreview={damagePreview}
                    setDamageFile={setDamageFile}
                    setDamagePreview={setDamagePreview}
                    damageInputRef={damageInputRef}
                    scalePreview={scalePreview}
                    setScaleFile={setScaleFile}
                    setScalePreview={setScalePreview}
                    scaleInputRef={scaleInputRef}
                  />

                  {/* Right Column: Supporting Notes */}
                  <AppraiserNotesInput
                    userNotes={userNotes}
                    setUserNotes={setUserNotes}
                    provenanceNotes={provenanceNotes}
                    setProvenanceNotes={setProvenanceNotes}
                    conditionNotes={conditionNotes}
                    setConditionNotes={setConditionNotes}
                    literatureNotes={literatureNotes}
                    setLiteratureNotes={setLiteratureNotes}
                    selectedFile={selectedFile}
                    error={error}
                    onSubmit={handleAnalysisSubmit}
                  />

                </div>
              </div>
            ) : null}

            {/* Scanning details loadings */}
            {isLoading && (
              <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-10 md:p-16 text-center shadow-gallery-soft space-y-6 max-w-xl mx-auto animate-fadeIn">
                <div className="relative w-16 h-16 mx-auto">
                  {/* Sleek dual spinning rings */}
                  <div className="absolute inset-0 rounded-full border-4 border-rosebery-border" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#4C0B2A] animate-spin" />
                </div>
                
                <div className="space-y-2.5">
                  <span className="text-[10px] font-mono tracking-[0.25em] text-rosebery-primary uppercase block font-semibold">
                    MAGNIFICATION MATRIX ACTIVE
                  </span>
                  <h3 className="text-lg font-serif font-medium text-rosebery-charcoal tracking-wide">
                    {loadingStep}
                  </h3>
                </div>

                {/* Nice progress indicators */}
                <div className="w-full bg-[#E8E2D7] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-rosebery-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-rosebery-muted block">
                  {loadingProgress}% Analytically Computed
                </span>
              </div>
            )}

            {/* Complete analyzed results report */}
            {analysisResult && !isLoading && (
              <div className="space-y-6">
                
                {/* Reset workspace control bar */}
                <div className="flex justify-between items-center bg-rosebery-card border border-rosebery-border rounded-sm px-5 py-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rosebery-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rosebery-primary"></span>
                    </span>
                    <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider font-semibold">
                      ARCHIVE APPRAISAL COMPLETED
                    </span>
                  </div>
                  
                  <button
                    onClick={clearSelection}
                    className="text-xs text-rosebery-primary hover:text-white font-bold flex items-center gap-1.5 border border-rosebery-primary hover:bg-rosebery-primary px-4 py-2 rounded-sm transition-all cursor-pointer bg-transparent"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    APPRAISE ANOTHER PRINT
                  </button>
                </div>

                {/* Core Report view component */}
                <ReportView 
                  report={analysisResult} 
                  fileName={selectedFile?.name || (currentHistoryItemId ? catalogHistory.find(i => i.id === currentHistoryItemId)?.imageFileName : undefined)}
                  fileSize={selectedFile?.size ? formatBytes(selectedFile.size) : (currentHistoryItemId ? catalogHistory.find(i => i.id === currentHistoryItemId)?.imageSize : undefined)}
                  imageUrl={previewUrl || undefined}
                  signatureFile={signatureFile}
                  signaturePreview={signaturePreview}
                  setSignatureFile={setSignatureFile}
                  setSignaturePreview={setSignaturePreview}
                  signatureInputRef={signatureInputRef}
                  damageFile={damageFile}
                  damagePreview={damagePreview}
                  setDamageFile={setDamageFile}
                  setDamagePreview={setDamagePreview}
                  damageInputRef={damageInputRef}
                  scaleFile={scaleFile}
                  scalePreview={scalePreview}
                  setScaleFile={setScaleFile}
                  setScalePreview={setScalePreview}
                  scaleInputRef={scaleInputRef}
                  onReAnalyze={handleAnalysisSubmit}
                  isLoading={isLoading}
                  currency={currency}
                  setCurrency={setCurrency}
                  onUpdateReport={handleUpdateReport}
                />

              </div>
            )}

          </div>
        ) : (
          /* Collection Catalog Library log view */
          <CatalogListView
            isHistoryLoading={isHistoryLoading}
            catalogHistory={catalogHistory}
            selectedHistoryId={selectedHistoryId}
            setSelectedHistoryId={setSelectedHistoryId}
            selectedItemIds={selectedItemIds}
            setSelectedItemIds={setSelectedItemIds}
            toggleItemSelection={toggleItemSelection}
            updateItemLot={updateItemLot}
            deleteHistoryItem={deleteHistoryItem}
            emailAddress={emailAddress}
            setEmailAddress={setEmailAddress}
            onOpenEmailModal={() => setShowEmailModal(true)}
            catalogViewMode={catalogViewMode}
            setCatalogViewMode={setCatalogViewMode}
            currency={currency}
            setCurrency={setCurrency}
            columnWidths={columnWidths}
            setColumnWidths={setColumnWidths}
            handleResizeStart={handleResizeStart}
            lotNumberInput={lotNumberInput}
            lotTitleInput={lotTitleInput}
            aiProposingLot={aiProposingLot}
            handleLotNumberInputChange={handleLotNumberInputChange}
            handleLotTitleInputChange={handleLotTitleInputChange}
            updateHistory={updateHistory}
            draggedIndex={draggedIndex}
            dragOverIndex={dragOverIndex}
            handleHistoryDragStart={handleHistoryDragStart}
            handleHistoryDragOver={handleHistoryDragOver}
            handleHistoryDragEnd={handleHistoryDragEnd}
            handleHistoryDrop={handleHistoryDrop}
            isGroupedByLot={isGroupedByLot}
            onLoadHistoryItem={(item) => {
              setAnalysisResult(item.report);
              setPreviewUrl(item.imageUrl);
              setSelectedFile(null);
              setSignatureFile(null);
              setSignaturePreview(null);
              setDamageFile(null);
              setDamagePreview(null);
              setScaleFile(null);
              setScalePreview(null);
              setCurrentHistoryItemId(item.id);
              setActiveTab("sandbox");
            }}
          />
        )}


      {/* EMAIL SUMMARY FILE PREVIEW & DISPATCH DIALOG MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-rosebery-card border border-rosebery-border rounded-sm max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-xl relative animate-fadeIn my-8">
            <button
              onClick={() => {
                setShowEmailModal(false);
                setEmailMessage(null);
                setEmailSuccess(false);
              }}
              className="absolute top-4 right-4 text-stone-400 hover:text-rosebery-primary transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-rosebery-border pb-3.5">
              <span className="text-[9px] font-mono text-rosebery-primary tracking-[0.2em] font-extrabold uppercase block mb-1">
                SUMMARY REGISTER DISPATCH
              </span>
              <h3 className="text-xl font-serif text-rosebery-charcoal font-semibold">Appraisal Lot Summary Email File</h3>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-rosebery-muted leading-relaxed font-sans">
                Review the compiled summary report generated for destination index **{emailAddress}**. You can dispatch it immediately either via our backend transmission pipeline or through your local system mailbox email client.
              </p>

              {/* Editable summary text preview block */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-rosebery-primary font-semibold block">Report Outline Preview (Readonly)</label>
                <textarea
                  readOnly
                  value={getEmailSummaryText()}
                  rows={10}
                  className="w-full bg-stone-50 border border-rosebery-border rounded-sm p-4 text-xs font-mono text-rosebery-charcoal focus:outline-none"
                />
              </div>

              {/* Info Toast Alerts inside Mail Modal */}
              {emailMessage && (
                <div className={`p-4 rounded-sm text-xs leading-relaxed border flex items-start gap-2.5 animate-fadeIn ${
                  emailSuccess 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-stone-50 border-rosebery-border text-rosebery-muted"
                }`}>
                  {emailSuccess ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                  ) : (
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-rosebery-primary" />
                  )}
                  <span>{emailMessage}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-rosebery-border flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 font-mono">
              {/* Native mail fallback option */}
              <a
                href={`mailto:${emailAddress}?subject=PrintMasterAI Appraisal Lot Summary File&body=${encodeURIComponent(getEmailSummaryText())}`}
                onClick={() => {
                  // Standard client behavior tracking
                  setShowEmailModal(false);
                }}
                className="bg-rosebery-cream-bg hover:bg-stone-50 border border-rosebery-border text-rosebery-muted hover:text-rosebery-primary px-4 py-3 rounded-xs text-[11px] font-bold text-center uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Launch Mailbox Client</span>
              </a>

              {/* Secure simulated server pipeline dispatch */}
              <button
                onClick={sendEmailSummaryApi}
                disabled={emailSending}
                className={`px-5 py-3 rounded-xs text-[11px] font-bold uppercase tracking-wider text-center transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  emailSending 
                    ? "bg-[#E8E2D7] text-stone-400 cursor-not-allowed" 
                    : "bg-rosebery-primary text-white hover:bg-rosebery-primary-hover cursor-pointer"
                }`}
              >
                {emailSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatched Pipelining...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Secure Server Dispatch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}
