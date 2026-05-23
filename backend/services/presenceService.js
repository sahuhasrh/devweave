const redisManager = require('../redis/client');

class PresenceService {
  async joinRoom(documentId, userId, userInfo) {
    await redisManager.addUserToRoom(documentId, userId, userInfo);
    await redisManager.publish('user:presence', {
      type: 'user:joined',
      documentId,
      user: userInfo,
    });
  }

  async leaveRoom(documentId, userInfo) {
    await redisManager.removeUserFromRoom(documentId, userInfo.id);
    await redisManager.publish('user:presence', {
      type: 'user:left',
      documentId,
      user: userInfo,
    });
  }

  async getRoomUsers(documentId) {
    return redisManager.getRoomUsers(documentId);
  }
}

module.exports = new PresenceService();
