/** Tracks active socket ↔ user ↔ document mappings for this process. */
const activeConnections = new Map();

function setConnection(socketId, data) {
  activeConnections.set(socketId, data);
}

function getConnection(socketId) {
  return activeConnections.get(socketId);
}

function deleteConnection(socketId) {
  activeConnections.delete(socketId);
}

module.exports = {
  activeConnections,
  setConnection,
  getConnection,
  deleteConnection,
};
