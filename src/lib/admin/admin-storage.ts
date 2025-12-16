/**
 * Admin Storage Module
 *
 * Uses IndexedDB for async storage and a Web Worker for compression.
 * This keeps the UI responsive even with large story data.
 *
 * Features:
 * - Version tracking for schema migrations
 * - Multiple drafts indexed by slug
 * - Step checkpoints for recovery
 * - Auto-cleanup of old drafts
 */

import LZString from "lz-string";

const DB_NAME = "admin-story-upload";
const DB_VERSION = 2; // Bumped for new schema with drafts store
const STORE_NAME = "state";
const DRAFTS_STORE_NAME = "drafts";
const STATE_KEY = "current";

// Storage limits
const MAX_DRAFTS_PER_SLUG = 5;
const MAX_DRAFT_AGE_DAYS = 30;
const STORAGE_VERSION = 2;

// ============================================
// Types
// ============================================

export interface StepCheckpoint {
  step: number;
  timestamp: string;
  hash: string;
}

export interface StoredState {
  version: number;
  storyData: unknown;
  currentStep: number;
  savedAt: string;
  storySlug?: string;
  checkpoints?: StepCheckpoint[];
}

export interface DraftMetadata {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentStep: number;
  version: number;
}

export interface DraftEntry {
  metadata: DraftMetadata;
  compressedData: string;
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
      const oldVersion = event.oldVersion;

      // Create main state store if doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }

      // Create drafts store (new in v2)
      if (oldVersion < 2 && !db.objectStoreNames.contains(DRAFTS_STORE_NAME)) {
        const draftsStore = db.createObjectStore(DRAFTS_STORE_NAME, { keyPath: "metadata.id" });
        draftsStore.createIndex("slug", "metadata.slug", { unique: false });
        draftsStore.createIndex("updatedAt", "metadata.updatedAt", { unique: false });
      }
    };
  });
}

/**
 * Generate a simple hash for checkpoint comparison
 */
function generateHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a unique draft ID
 */
function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

// ============================================
// Draft Management API
// ============================================

/**
 * Save a draft with metadata
 */
export async function saveDraft(
  state: StoredState,
  title: string
): Promise<{ id: string; originalKB: number; compressedKB: number }> {
  const slug = state.storySlug || "untitled";
  const now = new Date().toISOString();

  // Add version to state if not present
  const stateWithVersion: StoredState = {
    ...state,
    version: STORAGE_VERSION,
  };

  const jsonData = JSON.stringify(stateWithVersion);
  const originalKB = jsonData.length / 1024;
  const compressed = await compressWithWorker(jsonData);
  const compressedKB = (compressed.length * 2) / 1024;

  const id = generateDraftId();
  const entry: DraftEntry = {
    metadata: {
      id,
      slug,
      title,
      createdAt: now,
      updatedAt: now,
      currentStep: state.currentStep,
      version: STORAGE_VERSION,
    },
    compressedData: compressed,
  };

  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DRAFTS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DRAFTS_STORE_NAME);
    const request = store.put(entry);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
  });

  // Run cleanup after save
  await cleanupOldDrafts(slug);

  return { id, originalKB, compressedKB };
}

/**
 * Update an existing draft
 */
export async function updateDraft(
  id: string,
  state: StoredState
): Promise<{ originalKB: number; compressedKB: number }> {
  const db = await openDatabase();

  // First, get the existing entry
  const existing = await new Promise<DraftEntry | null>((resolve, reject) => {
    const transaction = db.transaction(DRAFTS_STORE_NAME, "readonly");
    const store = transaction.objectStore(DRAFTS_STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
    transaction.oncomplete = () => db.close();
  });

  if (!existing) {
    throw new Error(`Draft not found: ${id}`);
  }

  const stateWithVersion: StoredState = {
    ...state,
    version: STORAGE_VERSION,
  };

  const jsonData = JSON.stringify(stateWithVersion);
  const originalKB = jsonData.length / 1024;
  const compressed = await compressWithWorker(jsonData);
  const compressedKB = (compressed.length * 2) / 1024;

  const updatedEntry: DraftEntry = {
    metadata: {
      ...existing.metadata,
      slug: state.storySlug || existing.metadata.slug,
      updatedAt: new Date().toISOString(),
      currentStep: state.currentStep,
      version: STORAGE_VERSION,
    },
    compressedData: compressed,
  };

  const db2 = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db2.transaction(DRAFTS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DRAFTS_STORE_NAME);
    const request = store.put(updatedEntry);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db2.close();
  });

  return { originalKB, compressedKB };
}

/**
 * Load a draft by ID
 */
export async function loadDraft(id: string): Promise<StoredState | null> {
  try {
    const db = await openDatabase();
    const entry = await new Promise<DraftEntry | null>((resolve, reject) => {
      const transaction = db.transaction(DRAFTS_STORE_NAME, "readonly");
      const store = transaction.objectStore(DRAFTS_STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
      transaction.oncomplete = () => db.close();
    });

    if (!entry) return null;

    const decompressed = await decompressWithWorker(entry.compressedData);
    if (!decompressed) return null;

    return JSON.parse(decompressed) as StoredState;
  } catch (e) {
    console.error("[AdminStorage] Failed to load draft:", e);
    return null;
  }
}

/**
 * Delete a draft by ID
 */
export async function deleteDraft(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DRAFTS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DRAFTS_STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
  });
}

/**
 * List all drafts, optionally filtered by slug
 */
export async function listDrafts(slug?: string): Promise<DraftMetadata[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DRAFTS_STORE_NAME, "readonly");
    const store = transaction.objectStore(DRAFTS_STORE_NAME);
    const request = slug
      ? store.index("slug").getAll(slug)
      : store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const entries = request.result as DraftEntry[];
      const metadata = entries
        .map(e => e.metadata)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(metadata);
    };
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Cleanup old drafts: remove drafts older than MAX_DRAFT_AGE_DAYS
 * and keep only MAX_DRAFTS_PER_SLUG per slug
 */
export async function cleanupOldDrafts(currentSlug?: string): Promise<{ deleted: number }> {
  const allDrafts = await listDrafts();
  const now = Date.now();
  const maxAge = MAX_DRAFT_AGE_DAYS * 24 * 60 * 60 * 1000;
  const toDelete: string[] = [];

  // Group by slug
  const bySlug = new Map<string, DraftMetadata[]>();
  for (const draft of allDrafts) {
    const list = bySlug.get(draft.slug) || [];
    list.push(draft);
    bySlug.set(draft.slug, list);
  }

  // For each slug, keep only MAX_DRAFTS_PER_SLUG most recent
  for (const [slug, drafts] of bySlug) {
    // Sort by updatedAt descending (most recent first)
    drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      const age = now - new Date(draft.updatedAt).getTime();

      // Delete if too old
      if (age > maxAge) {
        toDelete.push(draft.id);
        continue;
      }

      // Delete if beyond max per slug (but not if it's the current working draft)
      if (i >= MAX_DRAFTS_PER_SLUG && slug !== currentSlug) {
        toDelete.push(draft.id);
      }
    }
  }

  // Delete the drafts
  for (const id of toDelete) {
    await deleteDraft(id);
  }

  if (toDelete.length > 0) {
    console.log(`[AdminStorage] Cleaned up ${toDelete.length} old drafts`);
  }

  return { deleted: toDelete.length };
}

/**
 * Create a checkpoint for the current step
 */
export function createCheckpoint(
  state: StoredState,
  step: number
): StoredState {
  const hash = generateHash(JSON.stringify(state.storyData));
  const checkpoint: StepCheckpoint = {
    step,
    timestamp: new Date().toISOString(),
    hash,
  };

  const checkpoints = state.checkpoints || [];

  // Keep only one checkpoint per step, replace if exists
  const filteredCheckpoints = checkpoints.filter(c => c.step !== step);
  filteredCheckpoints.push(checkpoint);

  // Sort by step
  filteredCheckpoints.sort((a, b) => a.step - b.step);

  return {
    ...state,
    checkpoints: filteredCheckpoints,
  };
}

/**
 * Check if state has changed since last checkpoint for a step
 */
export function hasChangedSinceCheckpoint(
  state: StoredState,
  step: number
): boolean {
  const checkpoint = state.checkpoints?.find(c => c.step === step);
  if (!checkpoint) return true;

  const currentHash = generateHash(JSON.stringify(state.storyData));
  return currentHash !== checkpoint.hash;
}

/**
 * Get all checkpoints for a state
 */
export function getCheckpoints(state: StoredState): StepCheckpoint[] {
  return state.checkpoints || [];
}

// Export constants for consumers
export { MAX_DRAFTS_PER_SLUG, MAX_DRAFT_AGE_DAYS, STORAGE_VERSION };
