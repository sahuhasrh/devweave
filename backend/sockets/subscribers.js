const { getConnection } = require('./connectionRegistry');

/**
 * Redis Pub/Sub subscribers — fan-out to Socket.IO rooms across this Node process.
 * Combined with @socket.io/redis-adapter, events reach clients on every instance.
 */
function registerRedisSubscribers(io, redisManager) {
  // Yjs CRDT updates (binary, incremental — not full document text)
  redisManager.subscribe('document:yjs', (message) => {
    const room = `doc:${message.documentId}`;
    const sockets = io.sockets.adapter.rooms.get(room);
    if (!sockets) return;

    sockets.forEach((socketId) => {
      const connection = getConnection(socketId);
      if (connection && connection.userId !== message.userId) {
        io.to(socketId).emit('yjs:update', message);
      }
    });
  });

  redisManager.subscribe('cursor:updates', (message) => {
    io.to(`doc:${message.documentId}`).emit('cursor:update', message);
  });

  redisManager.subscribe('user:presence', (message) => {
    io.to(`doc:${message.documentId}`).emit('user:presence', message);
  });

  redisManager.subscribe('chat:messages', (message) => {
    io.to(`doc:${message.documentId}`).emit('chat:message', message);
  });

  redisManager.subscribe('document:restore', (message) => {
    io.to(`doc:${message.documentId}`).emit('yjs:sync', message);
  });
}

module.exports = { registerRedisSubscribers };
