/**
 * One-time migration: copy documents from Redis (doc:* keys) into PostgreSQL.
 *
 * Usage (from backend/):
 *   npm run db:migrate-redis
 *
 * Prerequisites:
 *   - DATABASE_URL configured and schema migrated
 *   - Redis running with existing doc:* keys
 */
require('dotenv').config();

const redis = require('redis');
const prisma = require('../lib/prisma');

function buildRedisConfig() {
  const useTls = process.env.REDIS_TLS === 'true';
  const config = {
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  };
  if (process.env.REDIS_USERNAME) config.username = process.env.REDIS_USERNAME;
  if (process.env.REDIS_PASSWORD) config.password = process.env.REDIS_PASSWORD;
  if (useTls) {
    config.socket.tls = { rejectUnauthorized: false, requestCert: true, agent: false };
  }
  return config;
}

async function getJson(client, key) {
  try {
    return await client.json.get(key);
  } catch {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  }
}

async function migrate() {
  const client = redis.createClient(buildRedisConfig());
  await client.connect();

  const keys = await client.keys('doc:*');
  console.log(`Found ${keys.length} document(s) in Redis`);

  let migrated = 0;
  let skipped = 0;

  for (const key of keys) {
    const documentId = key.replace(/^doc:/, '');
    const stored = await getJson(client, key);
    if (!stored) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (existing) {
      console.log(`  skip ${documentId} (already in PostgreSQL)`);
      skipped += 1;
      continue;
    }

    await prisma.document.create({
      data: {
        id: documentId,
        content: stored.content || '',
        yjsState: stored.yjsState || null,
        version: stored.version ?? 1,
      },
    });
    console.log(`  migrated ${documentId}`);
    migrated += 1;
  }

  await client.disconnect();
  await prisma.$disconnect();

  console.log(`Done. Migrated: ${migrated}, skipped: ${skipped}`);
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
