const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Y = require('yjs');
const documentRepository = require('../repositories/documentRepository');
const documentService = require('../services/documentService');
const versionService = require('../services/versionService');
const chatService = require('../services/chatService');
const { executeJavaScript } = require('../services/codeExecutionService');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { DEFAULT_DOCUMENT_CONTENT, YJS_TEXT_KEY } = require('../models/document');
const { encodeUpdate } = require('../utils/encoding');
const redisManager = require('../redis/client');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

async function getOwnedDocument(req, res) {
  const document = await documentRepository.findById(req.params.id);
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return null;
  }
  if (document.ownerId !== req.user.id) {
    res.status(403).json({ error: 'Not authorized for this document' });
    return null;
  }
  return document;
}

router.get('/documents', requireAuth, async (req, res) => {
  try {
    const documents = await documentRepository.findByOwner(req.user.id);
    res.json(documents.map((document) => ({
      id: document.id,
      title: document.title || 'Untitled Document',
      ownerId: document.ownerId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      lastModified: document.updatedAt.getTime(),
    })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/documents', requireAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const documentId = uuidv4();

    const ydoc = new Y.Doc();
    ydoc.getText(YJS_TEXT_KEY).insert(0, DEFAULT_DOCUMENT_CONTENT);
    const yjsState = encodeUpdate(Y.encodeStateAsUpdate(ydoc));

    const document = await documentRepository.save(documentId, {
      title: title || 'Untitled Document',
      ownerId: req.user.id,
      content: DEFAULT_DOCUMENT_CONTENT,
      yjsState,
      version: 1,
    });

    res.status(201).json({
      id: document.id,
      title: document.title,
      ownerId: document.ownerId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      lastModified: document.updatedAt.getTime(),
    });
  } catch {
    res.status(500).json({ error: 'Failed to create document' });
  }
});

router.get('/documents/:id', optionalAuth, async (req, res) => {
  try {
    const document = await documentRepository.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      version: document.version,
      lastModified: document.updatedAt.getTime(),
      ownerId: document.ownerId,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.patch('/documents/:id', requireAuth, async (req, res) => {
  try {
    const document = await getOwnedDocument(req, res);
    if (!document) return;

    const { title } = req.body;
    if (title === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updated = await documentRepository.save(req.params.id, {
      content: document.content,
      yjsState: document.yjsState,
      version: document.version,
      title,
      ownerId: document.ownerId,
    });

    res.json({
      id: updated.id,
      title: updated.title,
      ownerId: updated.ownerId,
      lastModified: updated.updatedAt.getTime(),
    });
  } catch {
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/documents/:id', requireAuth, async (req, res) => {
  try {
    const document = await getOwnedDocument(req, res);
    if (!document) return;

    documentService.removeFromCache(req.params.id);
    versionService.stopAutoSnapshot(req.params.id);
    await documentRepository.delete(req.params.id);

    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

router.get('/documents/:id/history', requireAuth, async (req, res) => {
  try {
    const document = await getOwnedDocument(req, res);
    if (!document) return;

    const versions = await versionService.listVersions(req.params.id);
    res.json(versions);
  } catch {
    res.status(500).json({ error: 'Failed to fetch document history' });
  }
});

router.post('/documents/:id/versions', requireAuth, async (req, res) => {
  try {
    const document = await getOwnedDocument(req, res);
    if (!document) return;

    const content = documentService.getContentSnapshot(req.params.id)
      || document.content
      || '';

    const version = await versionService.createSnapshot(req.params.id, content);
    if (!version) {
      return res.status(200).json({ skipped: true, message: 'Content unchanged since last snapshot' });
    }

    res.status(201).json(version);
  } catch {
    res.status(500).json({ error: 'Failed to save version' });
  }
});

router.post('/documents/:id/versions/:versionId/restore', requireAuth, async (req, res) => {
  try {
    const document = await getOwnedDocument(req, res);
    if (!document) return;

    const syncPayload = await versionService.restoreVersion(
      req.params.id,
      req.params.versionId,
    );

    await redisManager.publish('document:restore', syncPayload);

    res.json({ restored: true, ...syncPayload });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to restore version' });
  }
});

router.get('/documents/:id/chat', async (req, res) => {
  try {
    const messages = await chatService.getHistory(req.params.id);
    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

router.post('/execute', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required and must be a string' });
    }

    const result = await executeJavaScript(code);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Code execution failed',
      output: [],
      stderr: error.message,
      executionTime: 0,
    });
  }
});

module.exports = router;
