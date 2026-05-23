import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.pendingYjsSync = null;
  }

  connect(serverUrl = process.env.REACT_APP_WS_URL || 'http://localhost:5002') {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    });

    this.setupEventListeners();
    return this.socket;
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      this.isConnected = true;
      this.emit('connection:status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      this.isConnected = false;
      this.emit('connection:status', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      this.emit('connection:error', error);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.emit('socket:error', error);
    });

    this.socket.on('document:loaded', (data) => {
      this.emit('document:loaded', data);
    });

    this.socket.on('yjs:sync', (data) => {
      this.pendingYjsSync = data;
      this.emit('yjs:sync', data);
    });

    this.socket.on('yjs:update', (data) => {
      this.emit('yjs:update', data);
    });

    this.socket.on('user:presence', (data) => {
      this.emit('user:presence', data);
    });

    this.socket.on('cursor:update', (data) => {
      this.emit('cursor:update', data);
    });

    this.socket.on('chat:message', (data) => {
      this.emit('chat:message', data);
    });
  }

  getSocket() {
    return this.socket;
  }

  joinDocument(documentId, user) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.pendingYjsSync = null;
    this.socket.emit('join:document', { documentId, user });
  }

  requestYjsSync(documentId) {
    if (!this.socket) return;
    this.socket.emit('yjs:request-sync', { documentId });
  }

  consumePendingYjsSync() {
    const sync = this.pendingYjsSync;
    this.pendingYjsSync = null;
    return sync;
  }

  /**
   * Lightweight cursor payload — plain JSON, not Monaco Selection objects.
   */
  sendCursorUpdate(position, selection = null) {
    if (!this.socket) return;

    const payload = {
      position: position
        ? { lineNumber: position.lineNumber, column: position.column }
        : null,
      selection: selection
        ? {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        }
        : null,
    };

    this.socket.emit('cursor:update', payload);
  }

  sendChatMessage(message) {
    if (!this.socket) return;
    this.socket.emit('chat:send', { message });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
    };
  }
}

const socketService = new SocketService();

export default socketService;
