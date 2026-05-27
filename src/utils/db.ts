import { AnalysisHistoryItem } from "../types";

const DB_NAME = "PrintMasterDB";
const STORE_NAME = "keyval";
const DB_VERSION = 1;
const HISTORY_KEY = "history";

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

export async function getHistoryDB(): Promise<AnalysisHistoryItem[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(HISTORY_KEY);

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result)) {
          resolve(result);
        } else {
          resolve([]);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB getHistoryDB failed, fallback to empty list:", err);
    return [];
  }
}

export async function setHistoryDB(items: AnalysisHistoryItem[]): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(items, HISTORY_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB setHistoryDB failed:", err);
    throw err;
  }
}
