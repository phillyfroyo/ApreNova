/**
 * Admin Storage Module
 *
 * Uses IndexedDB for async storage and a Web Worker for compression.
 * This keeps the UI responsive even with large story data.
 */

import LZString from "lz-string";

const DB_NAME = "admin-story-upload";
const DB_VERSION = 1;
const STORE_NAME = "state";
const STATE_KEY = "current";

// ============================================
// Types
// ============================================

export interface StoredState {
  storyData: unknown;
  currentStep: number;
  savedAt: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// ============================================
// IndexedDB Helpers
// ============================================

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function writeToIndexedDB(key: string, value: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

async function readFromIndexedDB(key: string): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);

    transaction.oncomplete = () => db.close();
  });
}

async function deleteFromIndexedDB(key: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

// ============================================
// Web Worker for Compression (Inline)
// ============================================

const workerCode = `
  importScripts('https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js');

  self.onmessage = function(e) {
    const { type, data, id } = e.data;

    try {
      if (type === 'compress') {
        const compressed = LZString.compressToUTF16(data);
        self.postMessage({ id, success: true, result: compressed });
      } else if (type === 'decompress') {
        const decompressed = LZString.decompressFromUTF16(data);
        self.postMessage({ id, success: true, result: decompressed });
      }
    } catch (error) {
      self.postMessage({ id, success: false, error: error.message });
    }
  };
`;

let compressionWorker: Worker | null = null;
let messageId = 0;
const pendingMessages = new Map<number, { resolve: (value: string) => void; reject: (error: Error) => void }>();

function getWorker(): Worker | null {
  if (typeof window === "undefined") return null;

  if (!compressionWorker) {
    try {
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      compressionWorker = new Worker(url);

      compressionWorker.onmessage = (e) => {
        const { id, success, result, error } = e.data;
        const pending = pendingMessages.get(id);
        if (pending) {
          pendingMessages.delete(id);
          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error));
          }
        }
      };

      compressionWorker.onerror = (e) => {
        console.error("[AdminStorage] Worker error:", e);
      };
    } catch (e) {
      console.warn("[AdminStorage] Failed to create worker, falling back to main thread");
      return null;
    }
  }

  return compressionWorker;
}

async function compressWithWorker(data: string): Promise<string> {
  const worker = getWorker();

  if (!worker) {
    // Fallback to main thread (less ideal but works)
    return LZString.compressToUTF16(data);
  }

  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingMessages.set(id, { resolve, reject });
    worker.postMessage({ type: "compress", data, id });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id);
        reject(new Error("Compression timeout"));
      }
    }, 30000);
  });
}

async function decompressWithWorker(data: string): Promise<string | null> {
  const worker = getWorker();

  if (!worker) {
    return LZString.decompressFromUTF16(data);
  }

  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingMessages.set(id, { resolve, reject });
    worker.postMessage({ type: "decompress", data, id });

    setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id);
        reject(new Error("Decompression timeout"));
      }
    }, 30000);
  });
}

// ============================================
// Public API
// ============================================

/**
 * Save state to IndexedDB with compression (async, non-blocking)
 */
export async function saveState(state: StoredState): Promise<{ originalKB: number; compressedKB: number }> {
  const jsonData = JSON.stringify(state);
  const originalKB = jsonData.length / 1024;

  const compressed = await compressWithWorker(jsonData);
  const compressedKB = (compressed.length * 2) / 1024;

  await writeToIndexedDB(STATE_KEY, compressed);

  return { originalKB, compressedKB };
}

/**
 * Load state from IndexedDB with decompression
 */
export async function loadState(): Promise<StoredState | null> {
  try {
    const compressed = await readFromIndexedDB(STATE_KEY);
    if (!compressed) return null;

    const decompressed = await decompressWithWorker(compressed);
    if (!decompressed) return null;

    return JSON.parse(decompressed) as StoredState;
  } catch (e) {
    console.error("[AdminStorage] Failed to load state:", e);
    return null;
  }
}

/**
 * Clear saved state from IndexedDB
 */
export async function clearState(): Promise<void> {
  await deleteFromIndexedDB(STATE_KEY);
}

/**
 * Migrate from localStorage to IndexedDB (one-time migration)
 */
export async function migrateFromLocalStorage(storageKey: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const compressed = localStorage.getItem(storageKey);
    if (!compressed) return false;

    // Check if already migrated to IndexedDB
    const existingState = await readFromIndexedDB(STATE_KEY);
    if (existingState) {
      // Already have data in IndexedDB, skip migration
      localStorage.removeItem(storageKey);
      return false;
    }

    // Migrate the compressed data directly
    await writeToIndexedDB(STATE_KEY, compressed);
    localStorage.removeItem(storageKey);
    console.log("[AdminStorage] Migrated from localStorage to IndexedDB");
    return true;
  } catch (e) {
    console.error("[AdminStorage] Migration failed:", e);
    return false;
  }
}

/**
 * Cleanup worker when done
 */
export function cleanup(): void {
  if (compressionWorker) {
    compressionWorker.terminate();
    compressionWorker = null;
  }
  pendingMessages.clear();
}
