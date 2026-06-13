const { v4: uuidv4 } = require('uuid');
const documentService = require('../../services/documentService');
const presenceService = require('../../services/presenceService');
const redisManager = require('../../redis/client');
const versionService = require('../../services/versionService');
const documentRepository = require('../../repositories/documentRepository');
const { createUserInfo } = require('../../models/user');
const { setConnection, getConnection } = require('../connectionRegistry');

function registerDocumentHandlers(io, socket) {
  socket.on('join:document', async (data) => {
    try {
      const { documentId, user } = data;
      const storedDocument = await documentRepository.findById(documentId);
      if (!storedDocument) {
        socket.emit('error', { message: 'Document not found. Ask the owner for a valid link.' });
        return;
      }

      const userId = user.id || uuidv4();
      const userInfo = createUserInfo(user, userId);

      setConnection(socket.id, { userId, documentId, userInfo });
      socket.join(`doc:${documentId}`);

      await presenceService.joinRoom(documentId, userId, userInfo);

      const syncPayload = await documentService.buildSyncPayload(documentId);
      const roomUsers = await presenceService.getRoomUsers(documentId);

      socket.emit('document:loaded', {
        document: {
          id: documentId,
          content: syncPayload.content,
          version: syncPayload.version,
          lastModified: syncPayload.lastModified,
        },
        users: roomUsers,
        userId,
      });

      // Initial Yjs state for CRDT binding on the client
      socket.emit('yjs:sync', syncPayload);

      versionService.startAutoSnapshot(documentId);

      console.log(`User ${userInfo.name} joined document ${documentId}`);
    } catch (error) {
      console.error('Error joining document:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  });

  /**
   * Yjs CRDT update — small binary diff, not full document content.
   * Realtime propagation: no debounce on server; client sends every merged Yjs update.
   */
  socket.on('yjs:update', async (data) => {
    try {
      const connection = getConnection(socket.id);
      if (!connection) return;

      const { documentId, userId } = connection;
      const { update, clientVersion } = data;

      const result = await documentService.applyUpdate(documentId, update, clientVersion);
      if (!result) return;

      const changeMessage = {
        ...result,
        userId,
      };

      await redisManager.publish('document:yjs', changeMessage);
    } catch (error) {
      console.error('Error handling yjs:update:', error);
    }
  });

  socket.on('yjs:request-sync', async (data) => {
    try {
      const connection = getConnection(socket.id);
      if (!connection) return;
      const { documentId } = connection;
      if (data?.documentId && data.documentId !== documentId) return;

      const syncPayload = await documentService.buildSyncPayload(documentId);
      socket.emit('yjs:sync', syncPayload);
    } catch (error) {
      console.error('Error handling yjs:request-sync:', error);
    }
  });

  socket.on('document:change', async () => {
    console.warn('document:change is deprecated — use yjs:update');
  });
}

module.exports = { registerDocumentHandlers };
