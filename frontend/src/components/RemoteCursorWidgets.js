/**
 * Google Docs–style remote cursors for Monaco using content widgets + selection decorations.
 */

export function createRemoteCursorWidget(user, monaco) {
  const domNode = document.createElement('div');
  domNode.className = 'remote-cursor-widget';
  domNode.style.setProperty('--cursor-color', user.color);

  const label = document.createElement('div');
  label.className = 'remote-cursor-label';
  label.textContent = user.name;
  label.style.backgroundColor = user.color;

  const caret = document.createElement('div');
  caret.className = 'remote-cursor-caret';
  caret.style.backgroundColor = user.color;

  domNode.appendChild(label);
  domNode.appendChild(caret);

  const position = {
    lineNumber: user.cursor.lineNumber,
    column: user.cursor.column,
  };

  return {
    getId: () => `remote-cursor-${user.id}`,
    getDomNode: () => domNode,
    getPosition: () => ({
      position,
      preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
    }),
    updatePosition(lineNumber, column) {
      position.lineNumber = lineNumber;
      position.column = column;
    },
  };
}

export function buildSelectionDecorations(users, currentUserId, monaco) {
  const decorations = [];

  Object.values(users).forEach((user) => {
    if (user.id === currentUserId || !user.selection) return;

    const s = user.selection;
    decorations.push({
      range: new monaco.Range(
        s.startLineNumber,
        s.startColumn,
        s.endLineNumber,
        s.endColumn,
      ),
      options: {
        className: 'remote-selection-block',
        inlineClassName: 'remote-selection-inline',
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        overviewRuler: {
          color: user.color,
          position: monaco.editor.OverviewRulerLane.Center,
        },
        minimap: {
          color: user.color,
          position: monaco.editor.MinimapPosition.Inline,
        },
      },
      // Store color on decoration for CSS variable injection via class
      _userColor: user.color,
    });
  });

  return decorations.map(({ range, options, _userColor }) => ({
    range,
    options: {
      ...options,
      inlineClassName: `remote-selection-inline remote-sel-${_userColor.replace('#', '')}`,
      className: `remote-selection-block remote-sel-${_userColor.replace('#', '')}`,
    },
  }));
}

export function injectUserSelectionStyles(users, currentUserId) {
  const styleId = 'remote-cursor-selection-styles';
  let el = document.getElementById(styleId);
  if (!el) {
    el = document.createElement('style');
    el.id = styleId;
    document.head.appendChild(el);
  }

  const rules = Object.values(users)
    .filter((u) => u.id !== currentUserId && u.color)
    .map((u) => {
      const cls = u.color.replace('#', '');
      return `
        .monaco-editor .remote-sel-${cls} { background-color: ${u.color}33 !important; }
        .monaco-editor .remote-selection-inline.remote-sel-${cls} { background-color: ${u.color}44 !important; }
      `;
    });

  el.textContent = rules.join('\n');
}
