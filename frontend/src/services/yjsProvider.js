import * as Y from 'yjs';
import { encodeUpdate, decodeUpdate } from '../utils/encoding';
import socketService from './socket';

const REMOTE_ORIGIN = 'remote';

/**
 * Bridges Yjs document updates over Socket.IO.
 *
 * Realtime propagation: every local Yjs update is emitted immediately (no debounce).
 * Remote updates are applied with origin 'remote' to avoid echo loops.
 */
export function createYjsProvider(ydoc, socket, documentId, userId) {
  let serverVersion = 0;
  let destroyed = false;

  const onLocalUpdate = (update, origin) => {
    if (destroyed || origin === REMOTE_ORIGIN || !socket?.connected) return;

    socket.emit('yjs:update', {
      update: encodeUpdate(update),
      clientVersion: serverVersion,
    });
  };

  ydoc.on('update', onLocalUpdate);

  const onSync = (payload) => {
    if (payload.documentId && payload.documentId !== documentId) return;
    serverVersion = payload.version || 0;

    if (payload.restored) {
      const ytext = ydoc.getText('monaco');
      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, payload.content || '');
      }, REMOTE_ORIGIN);
      return;
    }

    Y.applyUpdate(ydoc, decodeUpdate(payload.update), REMOTE_ORIGIN);
  };

  const onRemoteUpdate = (payload) => {
    if (payload.documentId && payload.documentId !== documentId) return;
    if (payload.userId === userId) return;

    serverVersion = payload.version || serverVersion;
    Y.applyUpdate(ydoc, decodeUpdate(payload.update), REMOTE_ORIGIN);
  };

  socket.on('yjs:sync', onSync);
  socket.on('yjs:update', onRemoteUpdate);

  const pending = socketService.consumePendingYjsSync();
  if (pending) {
    onSync(pending);
  } else {
    socketService.requestYjsSync(documentId);
  }

  return {
    destroy() {
      destroyed = true;
      ydoc.off('update', onLocalUpdate);
      socket.off('yjs:sync', onSync);
      socket.off('yjs:update', onRemoteUpdate);
    },
    getServerVersion: () => serverVersion,
    setServerVersion: (v) => { serverVersion = v; },
  };
}
