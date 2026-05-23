const redisManager = require('../redis/client');

/**
 * Live cursor sync — lightweight JSON payloads, separate from Yjs document updates.
 */
class CursorService {
  normalizeCursorPayload(position, selection) {
    const cursor = position
      ? { lineNumber: position.lineNumber, column: position.column }
      : { lineNumber: 1, column: 1 };

    let normalizedSelection = null;
    if (
      selection
      && (selection.startLineNumber !== selection.endLineNumber
        || selection.startColumn !== selection.endColumn)
    ) {
      normalizedSelection = {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn,
      };
    }

    return { cursor, selection: normalizedSelection };
  }

  async updateCursor(documentId, userId, userInfo, position, selection) {
    const { cursor, selection: normalizedSelection } = this.normalizeCursorPayload(
      position,
      selection,
    );

    const updatedUser = {
      ...userInfo,
      cursor,
      selection: normalizedSelection,
    };

    await redisManager.addUserToRoom(documentId, userId, updatedUser);

    const message = {
      documentId,
      userId,
      cursor,
      selection: normalizedSelection,
      timestamp: Date.now(),
    };

    await redisManager.publish('cursor:updates', message);
    return { updatedUser, message };
  }
}

module.exports = new CursorService();
