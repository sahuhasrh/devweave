const express = require('express');
const redisManager = require('../redis/client');
const chatService = require('../services/chatService');
const { executeJavaScript } = require('../services/codeExecutionService');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

router.get('/documents/:id', async (req, res) => {
  try {
    const document = await redisManager.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(document);
  } catch {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.get('/documents/:id/history', async (req, res) => {
  try {
    const operations = await redisManager.getOperations(req.params.id);
    res.json(operations);
  } catch {
    res.status(500).json({ error: 'Failed to fetch document history' });
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
