const socketIo = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redisManager = require('../redis/client');
const { registerRedisSubscribers } = require('./subscribers');
const { registerDocumentHandlers } = require('./handlers/documentHandler');
const { registerCursorHandlers } = require('./handlers/cursorHandler');
const { registerChatHandlers } = require('./handlers/chatHandler');

/**
 * Socket.IO bootstrap with Redis adapter for horizontal scaling.
 *
 * Redis adapter: synchronizes Socket.IO room membership and emits across Node processes.
 * Application Redis Pub/Sub: document:yjs, cursor, presence, chat fan-out with server logic.
 */
function createSocketServer(httpServer) {
  const io = socketIo(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL
        ? process.env.CLIENT_URL.split(',')
        : ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  return io;
}

async function initializeSockets(httpServer) {
  await redisManager.connect();

  const { pubClient, subClient } = redisManager.getAdapterClients();
  const io = createSocketServer(httpServer);
  io.adapter(createAdapter(pubClient, subClient));

  registerRedisSubscribers(io, redisManager);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    registerDocumentHandlers(io, socket);
    registerCursorHandlers(socket);
    registerChatHandlers(socket);
  });

  return io;
}

module.exports = { initializeSockets, redisManager };
