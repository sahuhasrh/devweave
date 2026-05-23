import React, { useRef, useEffect, useState, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { createYjsProvider } from '../services/yjsProvider';
import socketService from '../services/socket';
import {
  createRemoteCursorWidget,
  buildSelectionDecorations,
  injectUserSelectionStyles,
} from './RemoteCursorWidgets';

const YJS_TEXT_KEY = 'monaco';
const CURSOR_THROTTLE_MS = 50;

const Editor = ({
  documentId,
  document,
  users,
  currentUser,
  theme,
  onContentSnapshot,
  onCursorChange,
}) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const providerRef = useRef(null);
  const cursorTimerRef = useRef(null);
  const pendingCursorRef = useRef(null);
  const widgetsRef = useRef(new Map());
  const selectionDecorationIdsRef = useRef([]);

  const [isEditorReady, setIsEditorReady] = useState(false);

  useEffect(() => {
    if (!documentId || !currentUser?.id) return undefined;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText(YJS_TEXT_KEY);
    const socket = socketService.getSocket();

    ydocRef.current = { ydoc, ytext };

    if (socket) {
      providerRef.current = createYjsProvider(ydoc, socket, documentId, currentUser.id);
    }

    const snapshotObserver = () => {
      if (onContentSnapshot) {
        onContentSnapshot(ytext.toString());
      }
    };
    ytext.observe(snapshotObserver);

    return () => {
      ytext.unobserve(snapshotObserver);
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      ydoc.destroy();
      ydocRef.current = null;
    };
  }, [documentId, currentUser?.id, onContentSnapshot]);

  const syncRemoteCursors = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !currentUser) return;

    widgetsRef.current.forEach((widget) => {
      editor.removeContentWidget(widget);
    });
    widgetsRef.current.clear();

    if (selectionDecorationIdsRef.current.length) {
      editor.deltaDecorations(selectionDecorationIdsRef.current, []);
      selectionDecorationIdsRef.current = [];
    }

    injectUserSelectionStyles(users, currentUser.id);

    Object.values(users).forEach((user) => {
      if (user.id === currentUser.id || !user.cursor?.lineNumber) return;

      const widget = createRemoteCursorWidget(user, monaco);
      editor.addContentWidget(widget);
      widgetsRef.current.set(user.id, widget);
    });

    const selectionDecorations = buildSelectionDecorations(users, currentUser.id, monaco);
    if (selectionDecorations.length) {
      selectionDecorationIdsRef.current = editor.deltaDecorations([], selectionDecorations);
    }
  }, [users, currentUser]);

  useEffect(() => {
    if (isEditorReady) {
      syncRemoteCursors();
    }
  }, [users, isEditorReady, syncRemoteCursors]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !isEditorReady) return undefined;

    const relayout = () => {
      widgetsRef.current.forEach((widget) => {
        editor.layoutContentWidget(widget);
      });
    };

    const scrollDisposable = editor.onDidScrollChange(relayout);
    const layoutDisposable = editor.onDidLayoutChange(relayout);
    const contentDisposable = editor.onDidChangeModelContent(relayout);

    return () => {
      scrollDisposable.dispose();
      layoutDisposable.dispose();
      contentDisposable.dispose();
    };
  }, [isEditorReady]);

  const flushCursorUpdate = useCallback(() => {
    const pending = pendingCursorRef.current;
    if (!pending || !onCursorChange) return;
    onCursorChange(pending.position, pending.selection);
    pendingCursorRef.current = null;
  }, [onCursorChange]);

  const scheduleCursorUpdate = useCallback((position, selection) => {
    pendingCursorRef.current = { position, selection };

    if (cursorTimerRef.current) {
      clearTimeout(cursorTimerRef.current);
    }

    cursorTimerRef.current = setTimeout(() => {
      cursorTimerRef.current = null;
      flushCursorUpdate();
    }, CURSOR_THROTTLE_MS);
  }, [flushCursorUpdate]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsEditorReady(true);

    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      theme,
      minimap: { enabled: true },
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      folding: true,
      contextmenu: true,
      mouseWheelZoom: true,
      multiCursorModifier: 'ctrlCmd',
    });

    const { ytext } = ydocRef.current || {};
    if (ytext && !bindingRef.current) {
      bindingRef.current = new MonacoBinding(
        ytext,
        editor.getModel(),
        new Set([editor]),
      );
    }

    const emitCursor = (position, selection) => {
      if (currentUser && position) {
        scheduleCursorUpdate(position, selection);
      }
    };

    editor.onDidChangeCursorPosition((e) => {
      emitCursor(e.position, editor.getSelection());
    });

    editor.onDidChangeCursorSelection((e) => {
      emitCursor(editor.getPosition(), e.selection);
    });

    const pos = editor.getPosition();
    if (pos) {
      emitCursor(pos, editor.getSelection());
    }

    editor.focus();
  };

  useEffect(() => {
    if (isEditorReady && editorRef.current && ydocRef.current && !bindingRef.current) {
      const { ytext } = ydocRef.current;
      bindingRef.current = new MonacoBinding(
        ytext,
        editorRef.current.getModel(),
        new Set([editorRef.current]),
      );
    }
  }, [isEditorReady]);

  useEffect(() => () => {
    if (cursorTimerRef.current) {
      clearTimeout(cursorTimerRef.current);
    }
    const editor = editorRef.current;
    if (editor) {
      widgetsRef.current.forEach((widget) => editor.removeContentWidget(widget));
      widgetsRef.current.clear();
    }
  }, []);

  const getLanguageFromContent = (content) => {
    if (!content) return 'javascript';
    if (content.includes('def ') || content.includes('import ')) return 'python';
    if (content.includes('#include')) return 'cpp';
    if (content.includes('public class')) return 'java';
    if (content.includes('<html')) return 'html';
    if (content.includes('body {')) return 'css';
    return 'javascript';
  };

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="spinner mb-4" />
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full bg-white relative">
      <MonacoEditor
        height="100%"
        language={getLanguageFromContent(document.content)}
        defaultValue={document.content || ''}
        theme={theme}
        onMount={handleEditorDidMount}
        options={{
          selectOnLineNumbers: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
          lineNumbers: 'on',
          minimap: { enabled: true },
          wordWrap: 'on',
          tabSize: 2,
          insertSpaces: true,
        }}
      />

      {!isEditorReady && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <div className="spinner mb-2" />
            <p className="text-sm text-gray-600">Initializing editor...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
