const prisma = require('../lib/prisma');
const documentRepository = require('../repositories/documentRepository');
const documentService = require('../services/documentService');

const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

class VersionService {
  constructor() {
    /** @type {Map<string, { timer: NodeJS.Timeout, lastContent: string }>} */
    this.autoSnapshotState = new Map();
  }

  async createSnapshot(documentId, content) {
    const trimmed = content ?? '';
    const latest = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    if (latest && latest.content === trimmed) {
      return null;
    }

    return prisma.documentVersion.create({
      data: { documentId, content: trimmed },
    });
  }

  async listVersions(documentId) {
    return documentRepository.listVersions(documentId);
  }

  startAutoSnapshot(documentId) {
    if (this.autoSnapshotState.has(documentId)) return;

    const state = {
      lastContent: documentService.getContentSnapshot(documentId),
      timer: setInterval(async () => {
        try {
          const content = documentService.getContentSnapshot(documentId);
          if (content === state.lastContent) return;

          const created = await this.createSnapshot(documentId, content);
          if (created) {
            state.lastContent = content;
          }
        } catch (error) {
          console.error(`Auto snapshot failed for ${documentId}:`, error);
        }
      }, AUTO_SNAPSHOT_INTERVAL_MS),
    };

    this.autoSnapshotState.set(documentId, state);
  }

  stopAutoSnapshot(documentId) {
    const state = this.autoSnapshotState.get(documentId);
    if (!state) return;
    clearInterval(state.timer);
    this.autoSnapshotState.delete(documentId);
  }

  /**
   * Restore a version: update the server-authoritative Y.Doc, persist it, return sync payload.
   */
  async restoreVersion(documentId, versionId) {
    const version = await prisma.documentVersion.findFirst({
      where: { id: versionId, documentId },
    });
    if (!version) {
      const error = new Error('Version not found');
      error.statusCode = 404;
      throw error;
    }

    const syncPayload = await documentService.restoreContent(documentId, version.content);

    const autoState = this.autoSnapshotState.get(documentId);
    if (autoState) {
      autoState.lastContent = version.content;
    }

    return syncPayload;
  }
}

module.exports = new VersionService();
