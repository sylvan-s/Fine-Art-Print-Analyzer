import { AnalysisHistoryItem, CatalogMetadata } from "../types";

const DB_NAME = "PrintMasterDB";
const STORE_NAME = "keyval";
const DB_VERSION = 1;
const HISTORY_KEY = "history";
const CATALOG_LIST_KEY = "catalog_list";
const ACTIVE_CATALOG_ID_KEY = "active_catalog_id";

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Helper to get raw value from IndexedDB
async function getValueDB<T>(key: string): Promise<T | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`IndexedDB getValueDB for key ${key} failed:`, err);
    return null;
  }
}

// Helper to set raw value in IndexedDB
async function setValueDB<T>(key: string, val: T): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(val, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`IndexedDB setValueDB for key ${key} failed:`, err);
    throw err;
  }
}

// Helper to delete key in IndexedDB
async function deleteValueDB(key: string): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`IndexedDB deleteValueDB for key ${key} failed:`, err);
    throw err;
  }
}

// Legacy getHistoryDB
export async function getHistoryDB(): Promise<AnalysisHistoryItem[]> {
  const result = await getValueDB<AnalysisHistoryItem[]>(HISTORY_KEY);
  return Array.isArray(result) ? result : [];
}

// Legacy setHistoryDB
export async function setHistoryDB(items: AnalysisHistoryItem[]): Promise<void> {
  await setValueDB(HISTORY_KEY, items);
}

// Multi-catalogue: Get list of catalogues with auto-migration
export async function getCatalogsListDB(): Promise<CatalogMetadata[]> {
  let list = await getValueDB<CatalogMetadata[]>(CATALOG_LIST_KEY);
  
  if (!list || !Array.isArray(list) || list.length === 0) {
    // Check for legacy data to migrate
    const legacyHistory = await getHistoryDB();
    const defaultCatalog: CatalogMetadata = {
      id: "default",
      name: "Default Catalogue",
      timestamp: new Date().toISOString()
    };
    
    list = [defaultCatalog];
    await setCatalogsListDB(list);
    await setActiveCatalogIdDB("default");
    await setCatalogItemsDB("default", legacyHistory);
  }
  
  return list;
}

// Multi-catalogue: Save list of catalogues
export async function setCatalogsListDB(list: CatalogMetadata[]): Promise<void> {
  await setValueDB(CATALOG_LIST_KEY, list);
}

// Multi-catalogue: Get active catalogue ID
export async function getActiveCatalogIdDB(): Promise<string> {
  const activeId = await getValueDB<string>(ACTIVE_CATALOG_ID_KEY);
  if (!activeId) {
    await getCatalogsListDB(); // triggers migration if necessary
    const fallbackId = await getValueDB<string>(ACTIVE_CATALOG_ID_KEY);
    return fallbackId || "default";
  }
  return activeId;
}

// Multi-catalogue: Set active catalogue ID
export async function setActiveCatalogIdDB(id: string): Promise<void> {
  await setValueDB(ACTIVE_CATALOG_ID_KEY, id);
}

// Multi-catalogue: Get catalog items
export async function getCatalogItemsDB(id: string): Promise<AnalysisHistoryItem[]> {
  const key = `catalog_items_${id}`;
  const result = await getValueDB<AnalysisHistoryItem[]>(key);
  return Array.isArray(result) ? result : [];
}

// Multi-catalogue: Save catalog items
export async function setCatalogItemsDB(id: string, items: AnalysisHistoryItem[]): Promise<void> {
  const key = `catalog_items_${id}`;
  await setValueDB(key, items);
}

// Multi-catalogue: Delete catalog items
export async function deleteCatalogItemsDB(id: string): Promise<void> {
  const key = `catalog_items_${id}`;
  await deleteValueDB(key);
}

const ITEM_DATABASE_KEY = "item_database";

export async function getItemDatabaseDB(): Promise<AnalysisHistoryItem[]> {
  const result = await getValueDB<AnalysisHistoryItem[]>(ITEM_DATABASE_KEY);
  if (!result || !Array.isArray(result)) {
    const list = await getCatalogsListDB();
    const allItems: AnalysisHistoryItem[] = [];
    for (const cat of list) {
      const items = await getCatalogItemsDB(cat.id);
      items.forEach(it => {
        if (!it.catalogue_id) it.catalogue_id = cat.id;
      });
      allItems.push(...items);
    }
    if (allItems.length > 0) {
      await setValueDB(ITEM_DATABASE_KEY, allItems);
      return allItems;
    }
    return [];
  }
  return result;
}

export async function setItemDatabaseDB(items: AnalysisHistoryItem[]): Promise<void> {
  await setValueDB(ITEM_DATABASE_KEY, items);
}


