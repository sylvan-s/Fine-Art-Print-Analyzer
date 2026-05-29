import React from "react";
import { Upload, X } from "lucide-react";

interface UploadPanelProps {
  selectedFile: File | null;
  previewUrl: string | null;
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  signaturePreview: string | null;
  setSignatureFile: (file: File | null) => void;
  setSignaturePreview: (url: string | null) => void;
  signatureInputRef: React.RefObject<HTMLInputElement | null>;

  damagePreview: string | null;
  setDamageFile: (file: File | null) => void;
  setDamagePreview: (url: string | null) => void;
  damageInputRef: React.RefObject<HTMLInputElement | null>;

  scalePreview: string | null;
  setScaleFile: (file: File | null) => void;
  setScalePreview: (url: string | null) => void;
  scaleInputRef: React.RefObject<HTMLInputElement | null>;

  // Multi-catalogue props
  catalogs: { id: string; name: string }[];
  activeCatalogId: string;
  targetOption: "current" | "new";
  setTargetOption: (val: "current" | "new") => void;
  newCatalogName: string;
  setNewCatalogName: (val: string) => void;
  onSwitchCatalog: (id: string) => Promise<void>;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export default function UploadPanel({
  selectedFile,
  previewUrl,
  dragActive,
  onDrag,
  onDrop,
  onFileSelect,
  onClear,
  fileInputRef,
  signaturePreview,
  setSignatureFile,
  setSignaturePreview,
  signatureInputRef,
  damagePreview,
  setDamageFile,
  setDamagePreview,
  damageInputRef,
  scalePreview,
  setScaleFile,
  setScalePreview,
  scaleInputRef,
  catalogs,
  activeCatalogId,
  targetOption,
  setTargetOption,
  newCatalogName,
  setNewCatalogName,
  onSwitchCatalog,
}: UploadPanelProps) {
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="lg:col-span-7 space-y-6">
      {/* Explanatory introduction */}
      <div className="text-center space-y-2.5">
        <span className="inline-flex bg-rosebery-cream-bg border border-rosebery-border px-3.5 py-1.5 rounded-sm text-xs font-serif text-rosebery-primary font-medium tracking-wide italic">
          Identify lithographs, copper engravings, serigraphs, and limited runs.
        </span>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-rosebery-charcoal tracking-wide">
          Photographic Evidence
        </h2>
        <p className="text-xs md:text-sm text-rosebery-muted leading-relaxed">
          Upload a high-fidelity photograph of the print sheet. Our AI engine scans line engraving depth, plate marks, registration boundaries, and paper aging traits to instantly detail matching printmakers, catalogue references, and physical conditions.
        </p>
      </div>

      {/* Dropzone container */}
      <div
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        onClick={triggerFileInput}
        className={`border-2 border-dashed rounded-sm p-8 md:p-12 text-center cursor-pointer transition-all duration-200 ease-out relative ${
          dragActive
            ? "border-rosebery-primary bg-rosebery-cream-bg shadow-gallery-soft"
            : "border-rosebery-border hover:border-rosebery-primary bg-stone-50 hover:bg-rosebery-cream-bg"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
          className="hidden"
        />

        {previewUrl ? (
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative mx-auto max-w-[280px] rounded-sm overflow-hidden border border-rosebery-border shadow-gallery-deep bg-rosebery-card">
              <img
                src={previewUrl}
                alt="Uploaded Print Preview"
                className="max-h-56 mx-auto object-contain p-2"
              />
              <button
                onClick={onClear}
                className="absolute top-2.5 right-2.5 bg-rosebery-primary text-white hover:bg-rosebery-primary-hover rounded-full p-2 hover:scale-105 cursor-pointer transition-all duration-200"
                title="Remove Photo"
              >
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
            <div className="text-xs text-rosebery-muted bg-rosebery-cream-bg p-3 rounded border border-rosebery-border inline-block font-mono">
              <p className="font-semibold text-rosebery-charcoal">{selectedFile?.name}</p>
              <p className="text-rosebery-gold mt-0.5">
                {selectedFile?.size ? formatBytes(selectedFile.size) : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-rosebery-primary text-white flex items-center justify-center shadow-gallery-soft">
              <Upload className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rosebery-charcoal font-serif tracking-wide">
                Drag and drop high-resolution print photograph here, or browse
              </p>
              <p className="text-[11px] text-rosebery-muted mt-1 font-mono">
                Supports PNG, JPEG, WEBP files (Max size 15 MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Auxiliary Uploads Section */}
      <div className="bg-stone-50 border border-rosebery-border p-4 md:p-5 rounded-sm space-y-4">
        <div className="border-b border-rosebery-border pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-rosebery-primary block font-bold">
            AUXILIARY EXHIBITION DETAIL VIEWS (OPTIONAL)
          </span>
          <span className="text-[9px] font-mono text-rosebery-gold uppercase tracking-wider font-semibold">
            Enhance Appraisal Accuracy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Signature Close-Up */}
          <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-3 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:shadow-gallery-soft transition-all duration-200">
            <input
              ref={signatureInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSignatureFile(file);
                  setSignaturePreview(URL.createObjectURL(file));
                }
              }}
              className="hidden"
            />
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-rosebery-charcoal font-bold block uppercase tracking-wider">
                1. Signature Closeup
              </label>
              <p className="text-[10.5px] text-rosebery-muted leading-relaxed">
                Upload a high-fidelity macro photo of the signature, monogram or edition numbers.
              </p>
            </div>
            {signaturePreview ? (
              <div className="relative aspect-video rounded-sm overflow-hidden bg-rosebery-cream-bg border border-rosebery-border">
                <img src={signaturePreview} alt="Signature zoom" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setSignatureFile(null);
                    if (signaturePreview) URL.revokeObjectURL(signaturePreview);
                    setSignaturePreview(null);
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
                onClick={() => signatureInputRef.current?.click()}
                className="py-2 px-3 border border-dashed border-rosebery-border hover:border-rosebery-primary bg-stone-50 text-[11px] font-mono text-rosebery-muted hover:text-rosebery-primary rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer duration-200"
              >
                <Upload className="w-3.5 h-3.5 text-rosebery-primary" />
                Upload Closeup
              </button>
            )}
          </div>

          {/* 2. Damage Close-up */}
          <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-3 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:shadow-gallery-soft transition-all duration-200">
            <input
              ref={damageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setDamageFile(file);
                  setDamagePreview(URL.createObjectURL(file));
                }
              }}
              className="hidden"
            />
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-rosebery-charcoal font-bold block uppercase tracking-wider">
                2. Damage Detail
              </label>
              <p className="text-[10.5px] text-rosebery-muted leading-relaxed">
                Upload details of water stains, tears, raking light creasing or foxing dots.
              </p>
            </div>
            {damagePreview ? (
              <div className="relative aspect-video rounded-sm overflow-hidden bg-rosebery-cream-bg border border-rosebery-border">
                <img src={damagePreview} alt="Damage zoom" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setDamageFile(null);
                    if (damagePreview) URL.revokeObjectURL(damagePreview);
                    setDamagePreview(null);
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
                onClick={() => damageInputRef.current?.click()}
                className="py-2 px-3 border border-dashed border-rosebery-border hover:border-rosebery-primary bg-stone-50 text-[11px] font-mono text-rosebery-muted hover:text-rosebery-primary rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer duration-200"
              >
                <Upload className="w-3.5 h-3.5 text-rosebery-primary" />
                Upload Closeup
              </button>
            )}
          </div>

          {/* 3. Coin scale reference */}
          <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-3 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:shadow-gallery-soft transition-all duration-200">
            <input
              ref={scaleInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setScaleFile(file);
                  setScalePreview(URL.createObjectURL(file));
                }
              }}
              className="hidden"
            />
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-rosebery-charcoal font-bold block uppercase tracking-wider">
                3. Coin/Ruler Calibration
              </label>
              <p className="text-[10.5px] text-rosebery-muted leading-relaxed">
                Upload a photo containing a coin or ruler near margins to infer physical sheet size.
              </p>
            </div>
            {scalePreview ? (
              <div className="relative aspect-video rounded-sm overflow-hidden bg-rosebery-cream-bg border border-rosebery-border">
                <img src={scalePreview} alt="Coin calibration" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setScaleFile(null);
                    if (scalePreview) URL.revokeObjectURL(scalePreview);
                    setScalePreview(null);
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
                onClick={() => scaleInputRef.current?.click()}
                className="py-2 px-3 border border-dashed border-rosebery-border hover:border-rosebery-primary bg-stone-50 text-[11px] font-mono text-rosebery-muted hover:text-rosebery-primary rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer duration-200"
              >
                <Upload className="w-3.5 h-3.5 text-rosebery-primary" />
                Upload Closeup
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Destination Catalogue selector */}
      <div className="bg-stone-50 border border-rosebery-border p-4 md:p-5 rounded-sm space-y-4">
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
                name="targetOption"
                value="current"
                checked={targetOption === "current"}
                onChange={() => setTargetOption("current")}
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
                name="targetOption"
                value="new"
                checked={targetOption === "new"}
                onChange={() => setTargetOption("new")}
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
                onChange={(e) => setNewCatalogName(e.target.value)}
                className="w-full bg-white border border-rosebery-border focus:border-rosebery-primary rounded-sm px-3 py-2 text-xs text-rosebery-charcoal outline-hidden placeholder:text-stone-400"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
