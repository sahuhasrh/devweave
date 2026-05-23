const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const { initializeSockets, redisManager } = require('./sockets');
const apiRouter = require('./routes/api');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',')
    : ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use('/api', apiRouter);

const PORT = process.env.PORT || 5000;

async function startServer() {
  await initializeSockets(server);

  server.listen(PORT, () => {
    console.log(`🚀 DevWeave server running on port ${PORT}`);
    console.log('   Yjs CRDT + Redis Pub/Sub + Socket.IO Redis adapter');
  });
}

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await redisManager.disconnect();
  server.close(() => process.exit(0));
});

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
