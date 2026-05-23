/**
 * Encode/decode Yjs binary updates for Socket.IO JSON transport.
 */
function encodeUpdate(update) {
  return Buffer.from(update).toString('base64');
}

function decodeUpdate(encoded) {
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}

module.exports = { encodeUpdate, decodeUpdate };
