const cursorService = require('../../services/cursorService');
const { getConnection } = require('../connectionRegistry');

function registerCursorHandlers(socket) {
  socket.on('cursor:update', async (data) => {
    try {
      const connection = getConnection(socket.id);
      if (!connection) return;

      const { documentId, userId, userInfo } = connection;
      const { position, selection } = data;

      const { updatedUser } = await cursorService.updateCursor(
        documentId,
        userId,
        userInfo,
        position,
        selection,
      );

      connection.userInfo = updatedUser;
    } catch (error) {
      console.error('Error handling cursor update:', error);
    }
  });
}

module.exports = { registerCursorHandlers };
