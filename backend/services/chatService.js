const { v4: uuidv4 } = require('uuid');
const redisManager = require('../redis/client');

class ChatService {
  async sendMessage(documentId, userId, userInfo, message) {
    const chatMessage = {
      id: uuidv4(),
      documentId,
      userId,
      user: userInfo,
      message,
      timestamp: Date.now(),
    };

    await redisManager.client.lPush(`chat:${documentId}`, JSON.stringify(chatMessage));
    await redisManager.client.lTrim(`chat:${documentId}`, 0, 99);
    await redisManager.publish('chat:messages', chatMessage);

    return chatMessage;
  }

  async getHistory(documentId, limit = 50) {
    const messages = await redisManager.client.lRange(`chat:${documentId}`, 0, limit - 1);
    return messages.reverse().map((msg) => JSON.parse(msg));
  }
}

module.exports = new ChatService();
