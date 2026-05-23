const chatService = require('../../services/chatService');
const { getConnection, deleteConnection } = require('../connectionRegistry');
const presenceService = require('../../services/presenceService');

function registerChatHandlers(socket) {
  socket.on('chat:send', async (data) => {
    try {
      const connection = getConnection(socket.id);
      if (!connection) return;

      const { documentId, userId, userInfo } = connection;
      await chatService.sendMessage(documentId, userId, userInfo, data.message);
    } catch (error) {
      console.error('Error handling chat message:', error);
    }
  });

  socket.on('disconnect', async () => {
    try {
      const connection = getConnection(socket.id);
      if (!connection) return;

      const { documentId, userInfo } = connection;
      await presenceService.leaveRoom(documentId, userInfo);
      deleteConnection(socket.id);

      console.log(`User ${userInfo.name} left document ${documentId}`);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
}

module.exports = { registerChatHandlers };
