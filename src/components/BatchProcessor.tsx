import React, { useState, useRef } from "react";
import { 
  FolderOpen, 
  Play, 
  Loader2, 
  Scissors
} from "lucide-react";
import { PrintAnalysisReport, AnalysisHistoryItem, CatalogMetadata } from "../types";

interface BatchProcessorProps {
  catalogHistory: AnalysisHistoryItem[];
  updateHistory: (newHistory: AnalysisHistoryItem[]) => Promise<AnalysisHistoryItem[]>;
  currency: "USD" | "GBP" | "EUR";
  catalogs: CatalogMetadata[];
  activeCatalogId: string;
  onSwitchCatalog: (id: string) => Promise<void>;
  targetOption: "current" | "new";
  setTargetOption: (option: "current" | "new") => void;
  newCatalogName: string;
  setNewCatalogName: (name: string) => void;
  createNewCatalog: (name: string) => Promise<string>;
}

interface BatchFile {
  id: string;
  name: string;
  sourceType: "local" | "upload";
  localPath?: string; // used for local directory files
  fileObject?: File;   // used for browser upload files
  status: "pending" | "detecting" | "splitting" | "appraising" | "completed" | "failed";
  error?: string;
  splitItemsCount?: number;
  lotNumber?: string;
  lotTitle?: string;
  artworks?: ProcessedArtwork[];
}

const isModelUnavailableError = (errorMsg: string): boolean => {
  if (!errorMsg) return false;
  const msg = errorMsg.toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("resourceexhausted") ||
    msg.includes("resource_exhausted") ||
    msg.includes("service unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("fetch failed") ||
    msg.includes("model is overloaded")
  );
};

interface ProcessedArtwork {
  label: string;
  imagePreview: string; // cropped base64
  status: "pending" | "appraising" | "completed" | "failed";
  error?: string;
  report?: PrintAnalysisReport;
}

export default function BatchProcessor({ 
  catalogHistory, 
  updateHistory, 
  currency,
  catalogs,
  activeCatalogId,
  onSwitchCatalog,
  targetOption,
  setTargetOption,
  newCatalogName,
  setNewCatalogName,
  createNewCatalog
}: BatchProcessorProps) {
  // Keep latest catalogHistory in a ref to avoid stale closures in long-running async loops
  const catalogHistoryRef = useRef(catalogHistory);
  catalogHistoryRef.current = catalogHistory;

  // Input sources
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(-1);
  const [currentArtworks, setCurrentArtworks] = useState<ProcessedArtwork[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedFolderName, setSelectedFolderName] = useState<string>("");

  const batchFilesRef = useRef(batchFiles);
  batchFilesRef.current = batchFiles;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
  };

  // 2. Scan Browser Selected Directory (Client-side)
  const handleBrowserFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const list = Array.from(files) as File[];
    const imageList = list.filter((file) => {
      return file.type.startsWith("image/");
    });

    if (imageList.length > 0) {
      const firstFile = imageList[0];
      if (firstFile && firstFile.webkitRelativePath) {
        const pathParts = firstFile.webkitRelativePath.split("/");
        if (pathParts.length > 1) {
          setSelectedFolderName(pathParts[0]);
        }
      }
      const newFiles = imageList.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        sourceType: "upload",
        fileObject: file,
        status: "pending"
      }));
      setBatchFiles((prev) => [...prev, ...newFiles]);
      addLog(`Selected browser directory. Found ${imageList.length} images.`);
    } else {
      addLog("No valid image files found in browser selected folder.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearBatch = () => {
    setBatchFiles([]);
    setIsProcessing(false);
    setCurrentFileIndex(-1);
    setCurrentArtworks([]);
    setLogs([]);
    setSelectedFolderName("");
    addLog("Batch queue cleared.");
  };

  // Helper: File Base64 encoder (Client-side)
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

  // Dynamic Crop Helper (via HTML5 Canvas)
  const cropImageCanvas = (
    base64Data: string, 
    box_2d: number[]
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const [ymin, xmin, ymax, xmax] = box_2d;
        
        // Bounding box coordinates are normalized on a 0 to 1000 scale
        const x = (xmin / 1000) * img.width;
        const y = (ymin / 1000) * img.height;
        const w = ((xmax - xmin) / 1000) * img.width;
        const h = ((ymax - ymin) / 1000) * img.height;

        const canvas = document.createElement("canvas");
        const cropW = Math.max(1, w);
        const cropH = Math.max(1, h);
        
        canvas.width = cropW;
        canvas.height = cropH;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, x, y, cropW, cropH, 0, 0, cropW, cropH);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          reject(new Error("Failed to get 2D canvas context."));
        }
      };
      img.onerror = () => reject(new Error("Failed to load source image for crop."));
      img.src = base64Data;
    });
  };

  // Core Processing Orchestrator
  const startProcessing = async () => {
    if (batchFiles.length === 0) return;

    if (targetOption === "new") {
      if (!newCatalogName.trim()) {
        addLog("❌ Error: Please provide a Catalogue Name.");
        return;
      }
    }

    setIsProcessing(true);
    addLog("Batch processing queue initialized.");

    let targetHistory = [...catalogHistoryRef.current];

    if (targetOption === "new") {
      try {
        const cleanId = await createNewCatalog(newCatalogName);
        targetHistory = [];
        setTargetOption("current");
        setNewCatalogName("");
        addLog(`Created new catalogue: "${newCatalogName}" (${cleanId})`);
      } catch (catErr: any) {
        addLog(`❌ Failed to create new catalogue: ${catErr.message}`);
        setIsProcessing(false);
        return;
      }
    }

    // Loop sequentially
    for (let i = 0; i < batchFiles.length; i++) {
      const file = batchFiles[i];
      if (file.status === "completed") continue;

      setCurrentFileIndex(i);
      updateFileStatus(file.id, "detecting");
      addLog(`Processing file [${i + 1}/${batchFiles.length}]: ${file.name}`);

      try {
        // Step A: Retrieve Base64 data of image
        let imageBase64 = "";
        let mimeType = "image/jpeg";

        if (file.sourceType === "upload" && file.fileObject) {
          imageBase64 = await fileToBase64(file.fileObject);
          mimeType = file.fileObject.type;
        } else if (file.sourceType === "local" && file.localPath) {
          addLog("Retrieving file payload from server...");
          const res = await fetch("/api/get-local-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePath: file.localPath })
          });
          if (!res.ok) throw new Error(`Failed to load server file: ${res.status}`);
          const fileData = await res.json();
          imageBase64 = fileData.base64;
          mimeType = fileData.mimeType;
        } else {
          throw new Error("Missing source file content references.");
        }

        // Step B: Ask Gemini to detect multiple artworks (Collage Check)
        addLog("Detecting print bounds and checking for multi-artwork collages...");
        const detectRes = await fetch("/api/detect-artworks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64, mimeType })
        });
        if (!detectRes.ok) {
          const errData = await detectRes.json().catch(() => ({}));
          throw new Error(errData.error || `Collage detection returned error status ${detectRes.status}`);
        }
        const detection = await detectRes.json();

        let splitArtworks: ProcessedArtwork[] = [];
        
        // Define shared Lot identifiers for grouping
        const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const cleanName = file.name.substring(0, 8).replace(/[^a-zA-Z0-9]/g, "");
        const sharedLotNumber = `Lot B-${cleanName}-${randomCode}`;
        const sharedLotTitle = `Split Group Lot: ${file.name}`;

        if (detection.containsMultipleArtworks && detection.artworks.length > 1) {
          // Multiple pieces detected! Slicing...
          updateFileStatus(file.id, "splitting");
          addLog(`✂️ Collage Detected! Splitting scan sheet into ${detection.artworks.length} distinct print cropped scans.`);

          for (let j = 0; j < detection.artworks.length; j++) {
            const art = detection.artworks[j];
            try {
              addLog(`Slicing cropped artwork bounds for: ${art.label}...`);
              const croppedBase64 = await cropImageCanvas(imageBase64, art.box_2d);
              splitArtworks.push({
                label: art.label,
                imagePreview: croppedBase64,
                status: "pending"
              });
            } catch (cropErr: any) {
              addLog(`Failed to slice crop bounds for ${art.label}: ${cropErr.message}`);
            }
          }
        } else {
          // Single piece detected. Proceed with original image bounds.
          splitArtworks.push({
            label: "Primary Artwork",
            imagePreview: imageBase64,
            status: "pending"
          });
        }

        setCurrentArtworks(splitArtworks);
        setBatchFiles((prev) => prev.map((f) => f.id === file.id ? { 
          ...f, 
          splitItemsCount: splitArtworks.length,
          lotNumber: splitArtworks.length > 1 ? sharedLotNumber : undefined,
          lotTitle: splitArtworks.length > 1 ? sharedLotTitle : undefined,
          artworks: splitArtworks,
        } : f));

        // Step C: Iterate and Appraise each split artwork
        updateFileStatus(file.id, "appraising");
        const appHistoryItems: AnalysisHistoryItem[] = [];

        for (let j = 0; j < splitArtworks.length; j++) {
          const art = splitArtworks[j];
          addLog(`Appraising print [${j + 1}/${splitArtworks.length}]: "${art.label}"...`);
          
          // Update current split artworks UI display
          updateArtStatusForFile(file.id, j, "appraising");

          try {
            const analyzeRes = await fetch("/api/analyze-print", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageBase64: art.imagePreview,
                mimeType: "image/jpeg",
                currency
              }),
            });

            if (!analyzeRes.ok) {
              const errData = await analyzeRes.json().catch(() => ({}));
              throw new Error(errData.error || "Detailed print appraisal analysis failed.");
            }
            const report: PrintAnalysisReport = await analyzeRes.json();

            // Success, save report locally
            splitArtworks[j].report = report;
            splitArtworks[j].status = "completed";
            updateArtStatusForFile(file.id, j, "completed", report);

            // Create catalog record
            const historyItem: AnalysisHistoryItem = {
              id: crypto.randomUUID(),
              timestamp: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              imageUrl: art.imagePreview, // cropped print photo
              imageFileName: `${file.name}_${art.label.replace(/\s+/g, "_")}.jpg`,
              imageSize: "Split Scan Crop",
              report,
              // Group together into a single lot if split from same collage scan
              lotNumber: splitArtworks.length > 1 ? sharedLotNumber : undefined,
              lotTitle: splitArtworks.length > 1 ? sharedLotTitle : undefined
            };
            appHistoryItems.push(historyItem);
            addLog(`✓ Appraised "${report.artworkTitle}" by ${report.likelyArtist}. Value: ${report.auctionEstimate.formattedEstimate}`);
          } catch (appErr: any) {
            console.error(appErr);
            splitArtworks[j].status = "failed";
            splitArtworks[j].error = appErr.message;
            updateArtStatusForFile(file.id, j, "failed", undefined, appErr.message);
            addLog(`Error appraising artwork bounds "${art.label}": ${appErr.message}`);
          }
        }

        // Add successful appraisals to history database
        if (appHistoryItems.length > 0) {
          const newHistory = [...appHistoryItems, ...targetHistory];
          targetHistory = await updateHistory(newHistory);
        }

        // Evaluate overall file success
        const allSucceeded = splitArtworks.every(art => art.status === "completed");
        updateFileStatus(file.id, allSucceeded ? "completed" : "failed", allSucceeded ? undefined : "Some split artworks failed appraisal.");
        addLog(`File analysis completed. Successfully catalogued ${appHistoryItems.length} records.`);

      } catch (err: any) {
        console.error(err);
        updateFileStatus(file.id, "failed", err.message);
        addLog(`❌ Failed to process file ${file.name}: ${err.message}`);
      }
    }

    // --- RETRY CYCLE FOR MODEL UNAVAILABILITY ---
    let unavailableFiles = batchFilesRef.current.filter(file => {
      if (file.status !== "failed") return false;
      if (file.error && isModelUnavailableError(file.error)) return true;
      if (file.artworks && file.artworks.some(art => art.status === "failed" && art.error && isModelUnavailableError(art.error))) {
        return true;
      }
      return false;
    });

    if (unavailableFiles.length > 0) {
      addLog(`⚠️ Found ${unavailableFiles.length} file(s) that failed due to model unavailability. Initiating rate-limit cooling retry cycle...`);
      
      for (let pass = 1; pass <= 2; pass++) {
        // Wait for rate limit cooling
        addLog(`[Retry Pass ${pass}/2] Waiting 6 seconds for rate limits / model availability to clear...`);
        await new Promise((resolve) => setTimeout(resolve, 6000));
        
        // Re-read latest state of unavailable files
        unavailableFiles = batchFilesRef.current.filter(file => {
          if (file.status !== "failed") return false;
          if (file.error && isModelUnavailableError(file.error)) return true;
          if (file.artworks && file.artworks.some(art => art.status === "failed" && art.error && isModelUnavailableError(art.error))) {
            return true;
          }
          return false;
        });

        if (unavailableFiles.length === 0) {
          addLog("All model-unavailable failures have been resolved successfully.");
          break;
        }

        addLog(`Retrying ${unavailableFiles.length} failed file(s) that match model unavailability...`);
        
        for (let i = 0; i < unavailableFiles.length; i++) {
          const file = unavailableFiles[i];
          addLog(`Retrying file: ${file.name}`);
          
          try {
            let imageBase64 = "";
            let mimeType = "image/jpeg";
            
            if (file.sourceType === "upload" && file.fileObject) {
              imageBase64 = await fileToBase64(file.fileObject);
              mimeType = file.fileObject.type;
            } else if (file.sourceType === "local" && file.localPath) {
              const res = await fetch("/api/get-local-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filePath: file.localPath })
              });
              if (!res.ok) throw new Error(`Failed to load server file: ${res.status}`);
              const fileData = await res.json();
              imageBase64 = fileData.base64;
              mimeType = fileData.mimeType;
            }

            // Case A: Failed at detection level
            if (!file.artworks || file.artworks.length === 0 || (file.error && isModelUnavailableError(file.error))) {
              setCurrentFileIndex(batchFilesRef.current.findIndex(f => f.id === file.id));
              updateFileStatus(file.id, "detecting");
              
              const detectRes = await fetch("/api/detect-artworks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64, mimeType })
              });
              if (!detectRes.ok) {
                const errData = await detectRes.json().catch(() => ({}));
                throw new Error(errData.error || `Collage detection returned error status ${detectRes.status}`);
              }
              const detection = await detectRes.json();
              
              let splitArtworks: ProcessedArtwork[] = [];
              const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
              const cleanName = file.name.substring(0, 8).replace(/[^a-zA-Z0-9]/g, "");
              const sharedLotNumber = `Lot B-${cleanName}-${randomCode}`;
              const sharedLotTitle = `Split Group Lot: ${file.name}`;
              
              if (detection.containsMultipleArtworks && detection.artworks.length > 1) {
                updateFileStatus(file.id, "splitting");
                for (let j = 0; j < detection.artworks.length; j++) {
                  const art = detection.artworks[j];
                  const croppedBase64 = await cropImageCanvas(imageBase64, art.box_2d);
                  splitArtworks.push({
                    label: art.label,
                    imagePreview: croppedBase64,
                    status: "pending"
                  });
                }
              } else {
                splitArtworks.push({
                  label: "Primary Artwork",
                  imagePreview: imageBase64,
                  status: "pending"
                });
              }

              setCurrentArtworks(splitArtworks);
              setBatchFiles((prev) => prev.map((f) => f.id === file.id ? { 
                ...f, 
                splitItemsCount: splitArtworks.length,
                lotNumber: splitArtworks.length > 1 ? sharedLotNumber : undefined,
                lotTitle: splitArtworks.length > 1 ? sharedLotTitle : undefined,
                artworks: splitArtworks,
                error: undefined
              } : f));
              
              await new Promise((resolve) => setTimeout(resolve, 150));
            }

            // Case B: Process any pending/failed artworks
            const updatedFile = batchFilesRef.current.find(f => f.id === file.id)!;
            const artworksToProcess = updatedFile.artworks || [];
            
            updateFileStatus(updatedFile.id, "appraising");
            const appHistoryItems: AnalysisHistoryItem[] = [];
            const sharedLotNumber = updatedFile.lotNumber;
            const sharedLotTitle = updatedFile.lotTitle;

            for (let j = 0; j < artworksToProcess.length; j++) {
              const art = artworksToProcess[j];
              if (art.status === "completed") continue;
              
              addLog(`Retrying appraisal of print [${j + 1}/${artworksToProcess.length}]: "${art.label}"...`);
              updateArtStatusForFile(updatedFile.id, j, "appraising");

              try {
                const analyzeRes = await fetch("/api/analyze-print", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    imageBase64: art.imagePreview,
                    mimeType: "image/jpeg",
                    currency
                  }),
                });

                if (!analyzeRes.ok) {
                  const errData = await analyzeRes.json().catch(() => ({}));
                  throw new Error(errData.error || "Detailed print appraisal analysis failed.");
                }
                const report: PrintAnalysisReport = await analyzeRes.json();

                updateArtStatusForFile(updatedFile.id, j, "completed", report);

                const historyItem: AnalysisHistoryItem = {
                  id: crypto.randomUUID(),
                  timestamp: new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  imageUrl: art.imagePreview,
                  imageFileName: `${updatedFile.name}_${art.label.replace(/\s+/g, "_")}.jpg`,
                  imageSize: "Split Scan Crop",
                  report,
                  lotNumber: artworksToProcess.length > 1 ? sharedLotNumber : undefined,
                  lotTitle: artworksToProcess.length > 1 ? sharedLotTitle : undefined
                };
                appHistoryItems.push(historyItem);
                addLog(`✓ Appraised "${report.artworkTitle}" by ${report.likelyArtist}. Value: ${report.auctionEstimate.formattedEstimate}`);
              } catch (appErr: any) {
                updateArtStatusForFile(updatedFile.id, j, "failed", undefined, appErr.message);
                addLog(`Error appraising artwork bounds "${art.label}": ${appErr.message}`);
              }
            }

            if (appHistoryItems.length > 0) {
              const newHistory = [...appHistoryItems, ...targetHistory];
              targetHistory = await updateHistory(newHistory);
            }

            await new Promise((resolve) => setTimeout(resolve, 150));
            const finalFileState = batchFilesRef.current.find(f => f.id === file.id)!;
            const allSucceeded = finalFileState.artworks?.every(art => art.status === "completed") ?? false;
            updateFileStatus(finalFileState.id, allSucceeded ? "completed" : "failed", allSucceeded ? undefined : "Some split artworks failed appraisal.");
            
          } catch (err: any) {
            updateFileStatus(file.id, "failed", err.message);
            addLog(`❌ Failed to retry file ${file.name}: ${err.message}`);
          }
        }
      }
    }

    setIsProcessing(false);
    addLog("Batch processing queue finished.");
  };

  const updateFileStatus = (
    id: string, 
    status: BatchFile["status"], 
    error?: string
  ) => {
    setBatchFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status, error } : f))
    );
  };

  const updateArtStatusForFile = (
    fileId: string,
    index: number, 
    status: ProcessedArtwork["status"], 
    report?: PrintAnalysisReport,
    error?: string
  ) => {
    setCurrentArtworks((prev) =>
      prev.map((a, idx) => (idx === index ? { ...a, status, report, error } : a))
    );
    setBatchFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? {
              ...f,
              artworks: f.artworks
                ? f.artworks.map((a, idx) =>
                    idx === index ? { ...a, status, report, error } : a
                  )
                : undefined,
            }
          : f
      )
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn text-rosebery-text-normal">
      {/* Introduction */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <span className="inline-flex bg-rosebery-cream-bg border border-rosebery-border px-3.5 py-1 rounded-sm text-xs font-serif text-rosebery-primary font-semibold uppercase tracking-widest">
          LOT ENGINE BATCH CONSOLE
        </span>
        <h2 className="text-3xl font-serif font-semibold text-rosebery-charcoal tracking-wide">
          Automated Batch Appraisal
        </h2>
        <p className="text-xs md:text-sm text-rosebery-muted leading-relaxed">
          Upload entire folders of print sheets. The engine checks for print collages, automatically splits multi-artwork images using Gemini bounds, runs appraisals, and groups split-out items under unified auction lots.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Console: Inputs & Queue */}
        <div className="lg:col-span-7 space-y-6">
          {/* Destination Catalogue selector */}
          <div className="bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft space-y-4">
            <div className="border-b border-rosebery-border pb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-rosebery-primary block font-bold">
                DESTINATION CATALOGUE
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <label className="flex items-center gap-2 text-xs text-rosebery-charcoal cursor-pointer">
                  <input
                    type="radio"
                    name="batchTargetOption"
                    value="current"
                    checked={targetOption === "current"}
                    onChange={() => setTargetOption("current")}
                    disabled={isProcessing}
                    className="accent-rosebery-primary"
                  />
                  <span className="flex items-center gap-1.5">
                    Add to catalogue:
                    <select
                      value={activeCatalogId}
                      onChange={(e) => {
                        setTargetOption("current");
                        onSwitchCatalog(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isProcessing}
                      className="bg-white border border-rosebery-border rounded-xs px-2 py-1 text-xs text-rosebery-charcoal outline-none focus:border-rosebery-primary font-serif cursor-pointer ml-1"
                    >
                      {catalogs.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.id})
                        </option>
                      ))}
                    </select>
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs text-rosebery-charcoal cursor-pointer">
                  <input
                    type="radio"
                    name="batchTargetOption"
                    value="new"
                    checked={targetOption === "new"}
                    onChange={() => setTargetOption("new")}
                    disabled={isProcessing}
                    className="accent-rosebery-primary"
                  />
                  <span>Create new catalogue</span>
                </label>
              </div>

              {targetOption === "new" && (
                <div className="space-y-1.5 pt-1 animate-fadeIn">
                  <label className="text-[9px] font-mono text-rosebery-primary font-bold uppercase tracking-wider block">
                    Catalogue Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Picasso Prints, Lithos 2026..."
                    value={newCatalogName}
                    disabled={isProcessing}
                    onChange={(e) => setNewCatalogName(e.target.value)}
                    className="w-full bg-white border border-rosebery-border focus:border-rosebery-primary rounded-sm px-3 py-2 text-xs text-rosebery-charcoal outline-hidden placeholder:text-stone-400"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft space-y-6">
            <h3 className="text-base font-serif font-semibold text-rosebery-charcoal flex items-center gap-2 border-b border-rosebery-border pb-3">
              <FolderOpen className="w-5 h-5 text-rosebery-primary" />
              Batch Folder Sources
            </h3>

            {/* Source Options Grid */}
            {/* Folder Directory Selector */}
            <div className="bg-stone-50 border border-rosebery-border p-6 rounded-lg flex flex-col items-center justify-center text-center space-y-4">
              <div className="space-y-1.5 max-w-md">
                <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-widest font-semibold block">
                  Folder Directory Selector
                </span>
                <p className="text-xs text-rosebery-muted">
                  Select a folder on your machine via the standard web directory selector. All image scans inside will be loaded and queued for collage detection and batch appraisal.
                </p>
              </div>
              <div className="w-full max-w-xs pt-1 flex flex-col items-center space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={handleBrowserFolderUpload}
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full bg-white hover:bg-rosebery-cream-bg border border-rosebery-primary text-rosebery-primary font-mono text-xs tracking-wider uppercase py-3 rounded-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors duration-200"
                >
                  <FolderOpen className="w-4 h-4 text-rosebery-primary" />
                  Select Folder Directory
                </button>
                {selectedFolderName && (
                  <span className="text-[11px] font-mono text-rosebery-primary/80 bg-rosebery-cream-bg/35 border border-rosebery-border px-3 py-1.5 rounded-sm truncate max-w-full">
                    Location: <strong className="text-rosebery-charcoal">{selectedFolderName}/</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Queue Controls */}
            {batchFiles.length > 0 && (
              <div className="flex justify-between items-center bg-rosebery-cream-bg border border-rosebery-border p-3.5 rounded-lg">
                <div className="text-xs text-rosebery-charcoal font-medium">
                  Queue: <span className="font-mono font-bold text-rosebery-primary">{batchFiles.length} Scans Enqueued</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearBatch}
                    disabled={isProcessing}
                    className="text-[10px] font-mono font-bold uppercase tracking-wider text-rosebery-muted hover:text-rosebery-primary px-3 py-1.5 cursor-pointer transition-colors"
                  >
                    Clear Queue
                  </button>
                  <button
                    type="button"
                    onClick={startProcessing}
                    disabled={isProcessing}
                    className="bg-rosebery-primary hover:bg-rosebery-primary-hover disabled:bg-stone-300 text-white font-mono text-[10px] font-bold tracking-widest uppercase px-5 py-2 rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Start Batch
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Queue List */}
          {batchFiles.length > 0 && (
            <div className="bg-white border border-rosebery-border rounded-xl p-5 shadow-gallery-soft space-y-4 max-h-[380px] overflow-y-auto">
              <span className="text-[10px] font-mono text-rosebery-primary uppercase tracking-widest font-bold block border-b border-rosebery-border pb-2">
                Processing Queue List
              </span>
              <div className="space-y-2">
                {batchFiles.map((file, idx) => (
                  <div 
                    key={file.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-colors duration-200 ${
                      idx === currentFileIndex 
                        ? "border-rosebery-primary bg-rosebery-cream-bg/40 font-semibold"
                        : file.status === "completed"
                          ? "border-emerald-100 bg-emerald-50/40 text-emerald-900"
                          : file.status === "failed"
                            ? "border-rose-100 bg-rose-50/40 text-rose-900"
                            : "border-stone-100 bg-stone-50/30 text-rosebery-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                      <span className="text-[10px] font-mono text-rosebery-muted">#{idx + 1}</span>
                      <span className="truncate font-sans">{file.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Split tag */}
                      {file.splitItemsCount && file.splitItemsCount > 1 && (
                        <span className="bg-stone-100 text-rosebery-primary border border-rosebery-border text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs flex items-center gap-0.5">
                          <Scissors className="w-2.5 h-2.5" />
                          Split x{file.splitItemsCount}
                        </span>
                      )}
                      
                      {/* Status indicator */}
                      <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        file.status === "detecting" || file.status === "splitting" || file.status === "appraising"
                          ? "bg-amber-50 border-amber-200 text-amber-800 animate-pulse"
                          : file.status === "completed"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : file.status === "failed"
                              ? "bg-rose-50 border-rose-200 text-rose-800"
                              : "bg-white border-stone-200 text-stone-400"
                      }`}>
                        {file.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Console: Live Splitting & Real-time logs */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          {/* Active Split Preview */}
          {currentFileIndex >= 0 && currentArtworks.length > 0 && (
            <div className="bg-white border border-rosebery-border rounded-xl p-6 shadow-gallery-soft space-y-5 animate-fadeIn">
              <h3 className="text-base font-serif font-semibold text-rosebery-charcoal flex items-center gap-2 border-b border-rosebery-border pb-3">
                <Scissors className="w-5 h-5 text-rosebery-primary" />
                Collage Split Preview
              </h3>

              <div className="bg-rosebery-cream-bg/30 border border-rosebery-border p-3.5 rounded-lg space-y-1 text-xs">
                <div className="flex justify-between font-mono text-[10px] text-rosebery-primary font-bold">
                  <span>SOURCE FILE:</span>
                  <span className="truncate max-w-[200px]">{batchFiles[currentFileIndex]?.name}</span>
                </div>
                {batchFiles[currentFileIndex]?.lotNumber && (
                  <div className="flex justify-between font-mono text-[10px] text-rosebery-muted pt-1">
                    <span>SHARED GROUP LOT:</span>
                    <span className="font-bold text-rosebery-charcoal">{batchFiles[currentFileIndex].lotNumber}</span>
                  </div>
                )}
              </div>

              {/* Grid of cropped works */}
              <div className="grid grid-cols-2 gap-4">
                {currentArtworks.map((art, idx) => (
                  <div key={idx} className="bg-stone-50 border border-rosebery-border p-3 rounded-lg flex flex-col space-y-2 shadow-xs relative overflow-hidden group">
                    <div className="relative aspect-square rounded-sm overflow-hidden bg-white border border-rosebery-border flex items-center justify-center">
                      <img src={art.imagePreview} alt={art.label} className="max-w-full max-h-full object-contain" />
                    </div>
                    
                    <div className="space-y-1 text-center">
                      <span className="text-[10px] font-mono text-rosebery-primary font-semibold block truncate">
                        {art.label}
                      </span>
                      
                      <span className={`text-[8.5px] font-mono uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border inline-block ${
                        art.status === "appraising"
                          ? "bg-amber-50 border-amber-200 text-amber-800 animate-pulse"
                          : art.status === "completed"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : art.status === "failed"
                              ? "bg-rose-50 border-rose-200 text-rose-800"
                              : "bg-white border-stone-200 text-stone-400"
                      }`}>
                        {art.status}
                      </span>
                    </div>

                    {art.report && (
                      <div className="absolute inset-0 bg-[#4C0B2A]/90 text-white p-3 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg">
                        <div className="space-y-1 text-[10px] leading-tight">
                          <p className="font-serif font-bold truncate">{art.report.artworkTitle}</p>
                          <p className="text-stone-300 font-sans truncate">{art.report.likelyArtist}</p>
                          <p className="text-stone-300 font-sans font-semibold pt-1">{art.report.creationPeriod}</p>
                        </div>
                        <div className="bg-white text-rosebery-primary rounded-xs py-1 text-center text-[9px] font-mono font-bold">
                          {art.report.auctionEstimate.formattedEstimate}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-time Logger Console */}
          <div className="bg-rosebery-charcoal text-[#A8D39F] font-mono text-xs rounded-xl p-5 shadow-gallery-deep border border-stone-800 space-y-3.5 flex-1 flex flex-col">
            <div className="flex justify-between items-center border-b border-stone-800 pb-2.5">
              <span className="text-[10px] text-stone-400 uppercase tracking-widest font-bold font-sans">
                BATCH CONSOLE LOGS
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] text-stone-400 font-sans uppercase">Online</span>
              </div>
            </div>
            <div className="space-y-2 flex-1 min-h-[220px] overflow-y-auto flex flex-col-reverse text-[11px] leading-relaxed custom-scrollbar selection:bg-emerald-800 selection:text-white">
              {logs.length === 0 ? (
                <p className="text-stone-500 italic">No activity logged. Select folder source and start queue.</p>
              ) : (
                logs.map((log, idx) => (
                  <p 
                    key={idx} 
                    className={
                      log.includes("✓") || log.includes("Successfully")
                        ? "text-emerald-400" 
                        : log.includes("❌") || log.includes("Failed") || log.includes("Error")
                          ? "text-rose-400 font-semibold"
                          : log.includes("✂️")
                            ? "text-amber-400"
                            : "text-[#E3EAE0]"
                    }
                  >
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
