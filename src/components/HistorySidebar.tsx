import React from "react";
import { Check, GripVertical, Trash2 } from "lucide-react";
import { AnalysisHistoryItem, CatalogMetadata } from "../types";

interface HistorySidebarProps {
  catalogHistory: AnalysisHistoryItem[];
  selectedHistoryId: string | null;
  setSelectedHistoryId: (id: string | null) => void;
  selectedItemIds: string[];
  setSelectedItemIds: (ids: string[]) => void;
  toggleItemSelection: (id: string) => void;
  isGroupedByLot: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  handleHistoryDragStart: (e: React.DragEvent, index: number) => void;
  handleHistoryDragOver: (e: React.DragEvent, index: number) => void;
  handleHistoryDragEnd: () => void;
  handleHistoryDrop: (e: React.DragEvent, targetIndex: number) => void;
  deleteHistoryItem: (id: string, e: React.MouseEvent) => void;
  updateHistory: (newHistory: AnalysisHistoryItem[]) => void;
  catalogs: CatalogMetadata[];
  updateMultipleItemsCatalogue: (ids: string[], catalogueId: string | null) => void;
}

export default function HistorySidebar({
  catalogHistory,
  selectedHistoryId,
  setSelectedHistoryId,
  selectedItemIds,
  setSelectedItemIds,
  toggleItemSelection,
  isGroupedByLot,
  draggedIndex,
  dragOverIndex,
  handleHistoryDragStart,
  handleHistoryDragOver,
  handleHistoryDragEnd,
  handleHistoryDrop,
  deleteHistoryItem,
  updateHistory,
  catalogs,
  updateMultipleItemsCatalogue,
}: HistorySidebarProps) {
  const [bulkCatalogId, setBulkCatalogId] = React.useState<string>("");

  const allVisibleSelected = React.useMemo(() => {
    return catalogHistory.length > 0 && catalogHistory.every(item => selectedItemIds.includes(item.id));
  }, [catalogHistory, selectedItemIds]);

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = catalogHistory.map(item => item.id);
      setSelectedItemIds(selectedItemIds.filter(id => !visibleIds.includes(id)));
    } else {
      const visibleIds = catalogHistory.map(item => item.id);
      const union = Array.from(new Set([...selectedItemIds, ...visibleIds]));
      setSelectedItemIds(union);
    }
  };

  const handleClearSelection = () => {
    setSelectedItemIds([]);
  };

  const handleApplyBulkCatalog = () => {
    if (!bulkCatalogId) {
      alert("Please choose a catalogue to allocate the selected items to.");
      return;
    }
    const val = bulkCatalogId === "none" ? null : bulkCatalogId;
    updateMultipleItemsCatalogue(selectedItemIds, val);
    alert(`Successfully allocated ${selectedItemIds.length} items to the selected catalogue.`);
    setSelectedItemIds([]);
    setBulkCatalogId("");
  };

  return (
    <div
      className="lg:col-span-1 space-y-4 max-h-[700px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-200"
      onDragOver={(e) => {
        e.preventDefault();
        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const threshold = 70; // scroll when within 70px of top/bottom
        const scrollSpeed = 15; // speed of scroll

        if (relativeY < threshold) {
          container.scrollTop -= scrollSpeed;
        } else if (rect.height - relativeY < threshold) {
          container.scrollTop += scrollSpeed;
        }

        // Handle window auto-scrolling when dragging near viewport edges
        const viewportY = e.clientY;
        const viewportHeight = window.innerHeight;
        const winThreshold = 90;
        if (viewportY < winThreshold) {
          window.scrollBy(0, -12);
        } else if (viewportHeight - viewportY < winThreshold) {
          window.scrollBy(0, 12);
        }
      }}
    >
      {/* Selection & Bulk Actions Panel */}
      <div className="bg-rosebery-card border border-rosebery-border rounded-sm p-3.5 space-y-3 shadow-gallery-soft mb-4">
        <div className="flex items-center justify-between border-b border-rosebery-border/60 pb-2">
          <span className="text-[10px] font-mono text-rosebery-primary font-bold uppercase tracking-wider block">
            Selection & Bulk Actions
          </span>
          {selectedItemIds.length > 0 && (
            <span className="text-[9px] font-mono text-rosebery-primary font-bold uppercase bg-rosebery-primary/10 border border-rosebery-primary/20 px-2 py-0.5 rounded-sm">
              {selectedItemIds.length} Selected
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAllVisible}
            className="flex-1 py-1.5 px-2 bg-rosebery-cream-bg hover:bg-stone-200/60 border border-rosebery-border hover:border-rosebery-primary text-rosebery-primary rounded-xs text-[9px] uppercase font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer text-center"
          >
            {allVisibleSelected ? "Deselect All" : `Select All (${catalogHistory.length})`}
          </button>
          {selectedItemIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="py-1.5 px-3 bg-red-50 hover:bg-red-100/80 border border-red-200 text-red-800 rounded-xs text-[9px] uppercase font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer text-center"
            >
              Clear
            </button>
          )}
        </div>

        {selectedItemIds.length > 0 && (
          <div className="space-y-2 pt-2.5 border-t border-rosebery-border/60">
            <label className="text-[9px] font-mono text-stone-500 uppercase block font-semibold">
              Allocate Selection to:
            </label>
            <div className="flex gap-2">
              <select
                value={bulkCatalogId}
                onChange={(e) => setBulkCatalogId(e.target.value)}
                className="flex-1 bg-white border border-rosebery-border rounded-xs px-2.5 py-1 text-xs text-rosebery-charcoal outline-none focus:border-rosebery-primary font-serif cursor-pointer"
              >
                <option value="">-- Choose Catalogue --</option>
                <option value="none">None / Uncatalogued</option>
                {catalogs.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleApplyBulkCatalog}
                className="py-1 px-3 bg-rosebery-primary hover:bg-rosebery-primary-hover text-white rounded-xs text-[9px] uppercase font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer font-bold"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {!isGroupedByLot ? (
        /* Flat list representation */
        <div className="space-y-3">
          {catalogHistory.map((item, index) => {
            const isSelected =
              selectedHistoryId === item.id || (!selectedHistoryId && catalogHistory[0].id === item.id);
            const isDragging = draggedIndex === index;
            const isOver = dragOverIndex === index;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedHistoryId(item.id)}
                draggable={true}
                onDragStart={(e) => handleHistoryDragStart(e, index)}
                onDragOver={(e) => handleHistoryDragOver(e, index)}
                onDragEnd={handleHistoryDragEnd}
                onDrop={(e) => handleHistoryDrop(e, index)}
                className={`p-3 rounded-sm border cursor-grab active:cursor-grabbing transition-all duration-200 ease-out flex gap-1 relative group/item select-none ${
                  isSelected
                    ? "bg-rosebery-card border-rosebery-primary shadow-gallery-soft scale-[1.01]"
                    : "bg-rosebery-card border-rosebery-border hover:border-rosebery-primary/50"
                } ${isDragging ? "opacity-30 border-dashed border-rosebery-primary scale-[0.98]" : ""} ${
                  isOver ? "border-t-2 border-t-rosebery-primary bg-rosebery-cream-bg" : ""
                }`}
              >
                {/* Checkbox selector for lots */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItemSelection(item.id);
                  }}
                  className="px-1.5 flex items-center justify-center shrink-0 cursor-pointer relative z-10"
                  title="Mark for Lot Grouping"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center transition-all duration-200 ${
                      selectedItemIds.includes(item.id)
                        ? "bg-rosebery-primary border-rosebery-primary text-white"
                        : "border-stone-300 hover:border-rosebery-primary bg-rosebery-card"
                    }`}
                  >
                    {selectedItemIds.includes(item.id) && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>

                {/* Drag handle */}
                <div className="flex items-center justify-center text-stone-400 group-hover/item:text-rosebery-primary transition-colors shrink-0 pr-0.5">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Image Preview */}
                <div className="w-12 h-12 bg-stone-50 rounded-sm border border-rosebery-border shrink-0 overflow-hidden flex items-center justify-center p-0.5 shadow-inner">
                  <img
                    src={item.imageUrl}
                    alt={item.imageFileName}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0 pr-12">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-mono text-[#A28A5C] block">
                      {item.timestamp}
                    </span>
                    {item.lotNumber && (
                      <span className="bg-rosebery-primary/10 border border-rosebery-primary/20 text-rosebery-primary px-1 rounded-sm text-[8px] font-mono tracking-tight font-semibold">
                        {item.lotNumber}
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif font-bold text-xs text-[#1C1115] truncate mt-1">
                    {item.report.artworkTitle}
                  </h4>
                  <p className="text-[11px] text-[#6B5E62] truncate italic font-serif">
                    {item.report.likelyArtist}
                  </p>
                </div>

                {/* Delete controller overlay */}
                <div className="absolute right-2 top-2 bottom-2 flex flex-col justify-center items-end opacity-70 group-hover/item:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    className="text-stone-400 hover:text-red-600 p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                    title="Delete this Appraisal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Grouped items by Lot context rendering */
        <div className="space-y-5">
          {(() => {
            // Grouping items visually by Lot configuration
            const lotsMap: {
              [key: string]: {
                number: string;
                title: string;
                items: { item: AnalysisHistoryItem; origIdx: number }[];
              };
            } = {};
            catalogHistory.forEach((item, index) => {
              const lotKey = item.lotNumber ? item.lotNumber.trim().toUpperCase() : "GENERAL";
              if (!lotsMap[lotKey]) {
                lotsMap[lotKey] = {
                  number: item.lotNumber ? item.lotNumber.trim() : "Unassigned Lots",
                  title: item.lotTitle ? item.lotTitle.trim() : "Unsorted Cabinet Files",
                  items: [],
                };
              }
              lotsMap[lotKey].items.push({ item, origIdx: index });
            });

            // Sort lots so Unassigned is at the end
            const sortedLots = Object.keys(lotsMap).sort((a, b) => {
              if (a === "GENERAL") return 1;
              if (b === "GENERAL") return -1;
              return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
            });

            return sortedLots.map((lotKey) => {
              const lot = lotsMap[lotKey];
              return (
                <div key={lotKey} className="space-y-2 border-l-2 border-rosebery-primary/20 pl-2 ml-1">
                  {/* Group Lot Header */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex === null) return;
                      const list = catalogHistory.map((it) => ({ ...it }));
                      const draggedItem = list[draggedIndex];
                      if (lotKey === "GENERAL") {
                        draggedItem.lotNumber = undefined;
                        draggedItem.lotTitle = undefined;
                      } else {
                        draggedItem.lotNumber = lot.number;
                        draggedItem.lotTitle = lot.title;
                      }

                      // Reposition inside list: Find the index of the first item of this lot, or put it at the end/beginning
                      let firstItemOfLotIdx = list.findIndex((item) => {
                        if (lotKey === "GENERAL") {
                          return !item.lotNumber;
                        }
                        return item.lotNumber?.trim().toUpperCase() === lotKey;
                      });

                      list.splice(draggedIndex, 1);
                      if (firstItemOfLotIdx === -1) {
                        list.push(draggedItem);
                      } else {
                        if (draggedIndex < firstItemOfLotIdx) {
                          firstItemOfLotIdx--;
                        }
                        list.splice(firstItemOfLotIdx, 0, draggedItem);
                      }

                      updateHistory(list);
                      handleHistoryDragEnd(); // Reset indices
                    }}
                    className="bg-stone-50 p-2 rounded-xs border border-rosebery-border flex items-center justify-between hover:bg-rosebery-cream-bg transition-colors duration-200"
                  >
                    <span className="text-[9px] font-mono text-rosebery-primary uppercase font-extrabold tracking-widest pl-1">
                      📂 {lot.number}
                    </span>
                    <span className="text-[8px] font-mono text-[#6B5E62] max-w-[110px] truncate italic" title={lot.title}>
                      {lot.title}
                    </span>
                  </div>

                  {/* Nested items inside Lot */}
                  <div className="space-y-2 pl-1.5">
                    {lot.items.map(({ item, origIdx }) => {
                      const isSelected =
                        selectedHistoryId === item.id || (!selectedHistoryId && catalogHistory[0].id === item.id);
                      const isDragging = draggedIndex === origIdx;
                      const isOver = dragOverIndex === origIdx;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedHistoryId(item.id)}
                          draggable={true}
                          onDragStart={(e) => handleHistoryDragStart(e, origIdx)}
                          onDragOver={(e) => handleHistoryDragOver(e, origIdx)}
                          onDragEnd={handleHistoryDragEnd}
                          onDrop={(e) => handleHistoryDrop(e, origIdx)}
                          className={`p-2 rounded-sm border cursor-grab active:cursor-grabbing transition-all duration-200 ease-out flex gap-1 relative group/item select-none ${
                            isSelected
                              ? "bg-rosebery-card border-rosebery-primary shadow-gallery-soft scale-[1.01]"
                              : "bg-rosebery-card border-rosebery-border hover:border-rosebery-primary/40"
                          } ${isDragging ? "opacity-30 border-dashed border-rosebery-primary scale-[0.98]" : ""} ${
                            isOver ? "border-t-2 border-t-rosebery-primary bg-rosebery-cream-bg" : ""
                          }`}
                        >
                          {/* Checkbox selector for lots */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!item.lotNumber) {
                                toggleItemSelection(item.id);
                              }
                            }}
                            className={`px-1 flex items-center justify-center shrink-0 relative z-10 ${
                              item.lotNumber ? "cursor-not-allowed opacity-30" : "cursor-pointer"
                            }`}
                            title={
                              item.lotNumber
                                ? "This item is already assigned to a Group Lot and cannot be broken down or re-allocated"
                                : "Mark for Lot Grouping"
                            }
                          >
                            <div
                              className={`w-3 h-3 rounded-xs border flex items-center justify-center transition-all duration-200 ${
                                selectedItemIds.includes(item.id)
                                  ? "bg-rosebery-primary border-rosebery-primary text-white"
                                  : item.lotNumber
                                    ? "border-stone-200 bg-stone-50"
                                    : "border-stone-300 hover:border-rosebery-primary bg-rosebery-card"
                              }`}
                            >
                              {selectedItemIds.includes(item.id) && <Check className="w-2 h-2 stroke-[3]" />}
                            </div>
                          </div>

                          {/* Drag handle */}
                          <div className="flex items-center justify-center text-stone-400 group-hover/item:text-rosebery-primary transition-colors shrink-0 pr-0.5">
                            <GripVertical className="w-3 h-3" />
                          </div>

                          {/* Tiny Thumbnail */}
                          <div className="w-9 h-9 bg-stone-50 rounded-sm border border-rosebery-border shrink-0 overflow-hidden flex items-center justify-center p-0.5">
                            <img
                              src={item.imageUrl}
                              alt={item.imageFileName}
                              className="w-full h-full object-contain"
                            />
                          </div>

                          <div className="flex-1 min-w-0 pr-8">
                            <h4 className="font-serif font-bold text-[11px] text-[#1C1115] truncate">
                              {item.report.artworkTitle}
                            </h4>
                            <p className="text-[10px] text-[#6B5E62] truncate italic block font-serif">
                              {item.report.likelyArtist}
                            </p>
                          </div>

                          {/* Context quick buttons */}
                          <div className="absolute right-1.5 top-1 bottom-1 flex flex-col justify-center items-end opacity-45 group-hover/item:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="text-stone-400 hover:text-red-600 p-0.5 rounded hover:bg-[#FAF8F5] transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
