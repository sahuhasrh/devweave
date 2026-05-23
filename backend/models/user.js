const { generateUserColor } = require('../utils/colors');

function createUserInfo(user = {}, userId) {
  return {
    id: userId,
    name: user.name || `User ${userId.slice(0, 8)}`,
    color: user.color || generateUserColor(),
    cursor: { lineNumber: 1, column: 1 },
    selection: null,
  };
}

module.exports = { createUserInfo };
