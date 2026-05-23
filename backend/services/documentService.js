const Y = require('yjs');
const redisManager = require('../redis/client');
const { encodeUpdate, decodeUpdate } = require('../utils/encoding');
const { DEFAULT_DOCUMENT_CONTENT, YJS_TEXT_KEY } = require('../models/document');

/**
 * Server-authoritative Yjs document store.
 *
 * CRDT flow:
 * 1. Each room has one in-memory Y.Doc (source of truth while server is up).
 * 2. Incoming yjs:update payloads are applied with Y.applyUpdate.
 * 3. Merged state is persisted to Redis (yjsState + content snapshot + version).
 * 4. Updates are published on Redis Pub/Sub so every Node instance stays consistent.
 */
class DocumentService {
  constructor() {
    /** @type {Map<string, { ydoc: Y.Doc, version: number, persistTimer: NodeJS.Timeout | null }>} */
    this.liveDocs = new Map();
    this.PERSIST_DEBOUNCE_MS = 400;
  }

  async getOrCreateDocument(documentId) {
    if (this.liveDocs.has(documentId)) {
      return this.liveDocs.get(documentId);
    }

    const ydoc = new Y.Doc();
    const stored = await redisManager.getDocument(documentId);
    let version = stored?.version ?? 0;

    if (stored?.yjsState) {
      Y.applyUpdate(ydoc, decodeUpdate(stored.yjsState));
    } else if (stored?.content) {
      // Migrate legacy full-text documents into Yjs
      const ytext = ydoc.getText(YJS_TEXT_KEY);
      ytext.insert(0, stored.content);
      version = Math.max(version, 1);
    } else {
      ydoc.getText(YJS_TEXT_KEY).insert(0, DEFAULT_DOCUMENT_CONTENT);
      version = 1;
    }

    const entry = { ydoc, version, persistTimer: null };
    this.liveDocs.set(documentId, entry);
    return entry;
  }

  getText(documentId) {
    const entry = this.liveDocs.get(documentId);
    if (!entry) return null;
    return entry.ydoc.getText(YJS_TEXT_KEY);
  }

  getContentSnapshot(documentId) {
    const ytext = this.getText(documentId);
    return ytext ? ytext.toString() : '';
  }

  /**
   * Build initial sync payload for a joining client.
   */
  async buildSyncPayload(documentId) {
    const { ydoc, version } = await this.getOrCreateDocument(documentId);
    const update = Y.encodeStateAsUpdate(ydoc);
    const content = ydoc.getText(YJS_TEXT_KEY).toString();

    return {
      documentId,
      update: encodeUpdate(update),
      version,
      content,
      lastModified: Date.now(),
    };
  }

  /**
   * Apply a remote Yjs update. Returns null if the update is stale/invalid.
   */
  async applyUpdate(documentId, encodedUpdate, clientVersion = 0) {
    const entry = await this.getOrCreateDocument(documentId);

    // Lightweight stale guard: reject obviously old clients (CRDT still merges valid ops)
    if (clientVersion > 0 && clientVersion < entry.version - 50) {
      console.warn(`⚠️ Stale Yjs update ignored for ${documentId} (client v${clientVersion}, server v${entry.version})`);
      return null;
    }

    const update = decodeUpdate(encodedUpdate);
    Y.applyUpdate(entry.ydoc, update);

    entry.version += 1;
    const mergedUpdate = encodeUpdate(Y.encodeStateAsUpdate(entry.ydoc));
    const content = entry.ydoc.getText(YJS_TEXT_KEY).toString();

    this.schedulePersist(documentId, entry, mergedUpdate, content);

    return {
      documentId,
      update: encodeUpdate(update),
      version: entry.version,
      content,
      timestamp: Date.now(),
    };
  }

  schedulePersist(documentId, entry, fullStateEncoded, content) {
    if (entry.persistTimer) {
      clearTimeout(entry.persistTimer);
    }

    entry.persistTimer = setTimeout(async () => {
      try {
        await redisManager.saveDocument(documentId, {
          yjsState: fullStateEncoded,
          content,
          version: entry.version,
        });
      } catch (error) {
        console.error(`Failed to persist document ${documentId}:`, error);
      }
    }, this.PERSIST_DEBOUNCE_MS);
  }

  async recordOperation(documentId, userId, operationType = 'yjs-update') {
    await redisManager.addOperation(documentId, {
      type: operationType,
      userId,
      position: {},
      content: '',
    });
  }
}

module.exports = new DocumentService();
