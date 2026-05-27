import React from "react";
import { Check, Loader2 } from "lucide-react";

interface LotCreatorModalProps {
  selectedItemIds: string[];
  lotNumberInput: string;
  lotTitleInput: string;
  aiProposingLot: boolean;
  onLotNumberChange: (val: string) => void;
  onLotTitleChange: (val: string) => void;
  onClearSelection: () => void;
}

export default function LotCreatorModal({
  selectedItemIds,
  lotNumberInput,
  lotTitleInput,
  aiProposingLot,
  onLotNumberChange,
  onLotTitleChange,
  onClearSelection,
}: LotCreatorModalProps) {
  if (selectedItemIds.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-stone-50 border border-rosebery-border rounded-xs p-3.5 items-end shadow-gallery-soft transition-all duration-200">
      <div className="md:col-span-3 space-y-1">
        <label className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider block font-bold">
          Lot ID / Reference <span className="text-[9px] text-rosebery-gold font-normal italic lowercase">(auto-suggested)</span>
        </label>
        <input
          type="text"
          value={lotNumberInput}
          onChange={(e) => onLotNumberChange(e.target.value)}
          placeholder="e.g. Lot 101"
          className="w-full bg-rosebery-card border border-rosebery-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-xs px-2.5 py-1.5 text-xs text-rosebery-charcoal font-mono outline-none transition-all duration-200"
        />
      </div>
      <div className="md:col-span-7 space-y-1">
        <label className="text-[10px] font-mono text-rosebery-primary uppercase tracking-wider block font-bold">
          Scholarly Lot Title{" "}
          <span className="text-[9px] text-rosebery-gold font-normal italic">
            {aiProposingLot ? "(Refining with Gemini AI...)" : "(Edit to override automated suggestion)"}
          </span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={lotTitleInput}
            onChange={(e) => onLotTitleChange(e.target.value)}
            placeholder="e.g. Fine Nineteenth Century Prints Portfolio"
            className="w-full bg-rosebery-card border border-rosebery-border focus:border-rosebery-primary focus:ring-1 focus:ring-rosebery-primary/20 rounded-xs px-2.5 py-1.5 text-xs text-rosebery-charcoal outline-none transition-all duration-200"
          />
          {aiProposingLot && (
            <div className="absolute right-2 top-2.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rosebery-primary opacity-60" />
            </div>
          )}
        </div>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button
          onClick={onClearSelection}
          className="w-full py-1.5 bg-rosebery-primary hover:bg-rosebery-primary-hover text-white rounded-xs text-[10px] uppercase font-mono font-bold tracking-widest transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-gallery-soft"
        >
          <Check className="w-3 h-3" />
          <span>Done Editing</span>
        </button>
      </div>
    </div>
  );
}
