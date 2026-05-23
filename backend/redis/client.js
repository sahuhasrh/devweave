const redis = require('redis');
require('dotenv').config();

/**
 * Redis client factory with optional TLS for cloud hosts and plain TCP for local dev.
 */
function buildRedisConfig() {
  const useTls = process.env.REDIS_TLS === 'true';
  const config = {
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  };

  if (process.env.REDIS_USERNAME) {
    config.username = process.env.REDIS_USERNAME;
  }
  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }
  if (useTls) {
    config.socket.tls = {
      rejectUnauthorized: false,
      requestCert: true,
      agent: false,
    };
  }

  return config;
}

class RedisManager {
  constructor() {
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    this.adapterPubClient = null;
    this.adapterSubClient = null;
  }

  async connect() {
    const redisConfig = buildRedisConfig();

    this.client = redis.createClient(redisConfig);
    await this.client.connect();

    this.publisher = redis.createClient(redisConfig);
    await this.publisher.connect();

    this.subscriber = redis.createClient(redisConfig);
    await this.subscriber.connect();

    // Dedicated clients for @socket.io/redis-adapter (must not share with app pub/sub)
    this.adapterPubClient = redis.createClient(redisConfig);
    await this.adapterPubClient.connect();
    this.adapterSubClient = redis.createClient(redisConfig);
    await this.adapterSubClient.connect();

    console.log('✅ Connected to Redis successfully');
    await this.testModules();
    return true;
  }

  async testModules() {
    try {
      await this.client.json.set('test:json', '$', { test: 'value' });
      await this.client.json.del('test:json');
      console.log('✅ Redis JSON module available');
    } catch (error) {
      console.warn('⚠️ Redis JSON module unavailable — using string fallback:', error.message);
    }
  }

  getAdapterClients() {
    return { pubClient: this.adapterPubClient, subClient: this.adapterSubClient };
  }

  async setJson(key, value) {
    try {
      await this.client.json.set(key, '$', value);
    } catch {
      await this.client.set(key, JSON.stringify(value));
    }
  }

  async getJson(key) {
    try {
      return await this.client.json.get(key);
    } catch {
      const raw = await this.client.get(key);
      return raw ? JSON.parse(raw) : null;
    }
  }

  async saveDocument(documentId, payload) {
    const document = {
      id: documentId,
      ...payload,
      lastModified: Date.now(),
    };
    await this.setJson(`doc:${documentId}`, document);
    return document;
  }

  async getDocument(documentId) {
    return this.getJson(`doc:${documentId}`);
  }

  async getDocumentVersion(documentId) {
    const doc = await this.getDocument(documentId);
    return doc?.version ?? 0;
  }

  async addOperation(documentId, operation) {
    const operationData = {
      type: operation.type,
      position: JSON.stringify(operation.position || {}),
      content: operation.content || '',
      userId: operation.userId,
      timestamp: Date.now().toString(),
    };
    return this.client.xAdd(`ops:${documentId}`, '*', operationData);
  }

  async getOperations(documentId, fromId = '-', count = 100) {
    try {
      const operations = await this.client.xRange(`ops:${documentId}`, fromId, '+', { COUNT: count });
      return operations.map((op) => ({
        id: op.id,
        ...op.message,
        position: JSON.parse(op.message.position || '{}'),
        timestamp: parseInt(op.message.timestamp, 10),
      }));
    } catch {
      return [];
    }
  }

  async addUserToRoom(roomId, userId, userInfo) {
    await this.client.hSet(`room:${roomId}:users`, userId, JSON.stringify({
      ...userInfo,
      joinedAt: Date.now(),
    }));
  }

  async removeUserFromRoom(roomId, userId) {
    await this.client.hDel(`room:${roomId}:users`, userId);
  }

  async getRoomUsers(roomId) {
    try {
      const users = await this.client.hGetAll(`room:${roomId}:users`);
      const result = {};
      for (const [userId, userInfo] of Object.entries(users)) {
        result[userId] = JSON.parse(userInfo);
      }
      return result;
    } catch {
      return {};
    }
  }

  async publish(channel, message) {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel, callback) {
    await this.subscriber.subscribe(channel, (message) => {
      try {
        callback(JSON.parse(message));
      } catch (error) {
        console.error('Error parsing Redis message:', error);
      }
    });
  }

  async disconnect() {
    const clients = [
      this.client,
      this.publisher,
      this.subscriber,
      this.adapterPubClient,
      this.adapterSubClient,
    ];
    for (const c of clients) {
      if (c) await c.disconnect();
    }
  }
}

module.exports = new RedisManager();
