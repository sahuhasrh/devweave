import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Editor from '../components/Editor';
import Sidebar from '../components/Sidebar';
import Chat from '../components/Chat';
import Toolbar from '../components/Toolbar';
import Terminal from '../components/Terminal';
import ConnectionStatus from '../components/ConnectionStatus';
import UserModal from '../components/UserModal';
import VersionHistory from '../components/VersionHistory';
import socketService from '../services/socket';
import { api } from '../services/api';
import { getStoredUser, clearAuth, isAuthenticated } from '../services/auth';
import '../index.css';

function EditorPage() {
  const [documentId, setDocumentId] = useState('');
  const [user, setUser] = useState(null);
  const [authUser, setAuthUser] = useState(getStoredUser());
  const [document, setDocument] = useState(null);
  const [users, setUsers] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [showUserModal, setShowUserModal] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [theme, setTheme] = useState('vs-dark');
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [copyUrlFeedback, setCopyUrlFeedback] = useState('');
  const [versionFeedback, setVersionFeedback] = useState('');
  const currentUserIdRef = useRef(null);

  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const canManageVersions = Boolean(authUser && document?.ownerId === authUser.id);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('doc') || uuidv4();
    setDocumentId(docId);

    if (!urlParams.get('doc')) {
      const newUrl = `${window.location.pathname}?doc=${docId}`;
      window.history.replaceState({}, '', newUrl);
    }

    socketService.connect();

    socketService.on('connection:status', handleConnectionStatus);
    socketService.on('document:loaded', handleDocumentLoaded);
    socketService.on('user:presence', handleUserPresence);
    socketService.on('cursor:update', handleCursorUpdate);
    socketService.on('chat:message', handleChatMessage);
    socketService.on('connection:error', handleConnectionError);

    return () => {
      socketService.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!documentId || !authUser || !showUserModal) return;

    const userInfo = {
      id: authUser.id,
      name: authUser.email,
    };
    setUser(userInfo);
    setShowUserModal(false);
    socketService.joinDocument(documentId, userInfo);
  }, [documentId, authUser, showUserModal]);

  useEffect(() => {
    if (!documentId) return;

    let cancelled = false;
    api.getDocument(documentId)
      .then((doc) => {
        if (!cancelled) {
          setDocument((prev) => ({ ...prev, ...doc }));
        }
      })
      .catch((error) => {
        if (error.status !== 404) {
          console.error('Failed to fetch document metadata:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const handleConnectionStatus = ({ connected }) => {
    setIsConnected(connected);
  };

  const handleDocumentLoaded = ({ document: doc, users: roomUsers, userId }) => {
    setDocument((prev) => ({ ...prev, ...doc }));
    setUsers(roomUsers);
    setUser((prev) => ({ ...prev, id: userId }));
  };

  const handleUserPresence = ({ type, user: presenceUser }) => {
    if (type === 'user:joined') {
      setUsers((prev) => ({
        ...prev,
        [presenceUser.id]: presenceUser,
      }));
    } else if (type === 'user:left') {
      setUsers((prev) => {
        const next = { ...prev };
        delete next[presenceUser.id];
        return next;
      });
    }
  };

  const handleCursorUpdate = ({ userId, cursor, selection }) => {
    if (!userId || userId === currentUserIdRef.current) return;

    setUsers((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        name: prev[userId]?.name || 'Collaborator',
        color: prev[userId]?.color || '#4ECDC4',
        cursor,
        selection,
      },
    }));
  };

  const handleChatMessage = (message) => {
    setChatMessages((prev) => [...prev, message]);
  };

  const handleConnectionError = (error) => {
    console.error('Connection error:', error);
  };

  const handleUserSubmit = (userData) => {
    const userInfo = {
      ...userData,
      id: uuidv4(),
    };
    setUser(userInfo);
    setShowUserModal(false);
    socketService.joinDocument(documentId, userInfo);
  };

  const handleContentSnapshot = useCallback((content) => {
    setDocument((prev) => {
      if (!prev) return { content };
      if (prev.content === content) return prev;
      return { ...prev, content };
    });
  }, []);

  const handleCursorChange = (position, selection) => {
    socketService.sendCursorUpdate(position, selection);
  };

  const handleSendMessage = (message) => {
    socketService.sendChatMessage(message);
  };

  const handleNewDocument = async () => {
    if (isAuthenticated()) {
      try {
        const created = await api.createDocument('Untitled Document');
        window.location.href = `${window.location.pathname}?doc=${created.id}`;
        return;
      } catch (error) {
        console.error('Failed to create document:', error);
      }
    }

    const newDocId = uuidv4();
    window.location.href = `${window.location.pathname}?doc=${newDocId}`;
  };

  const handleSaveVersion = async () => {
    if (!canManageVersions) return;

    try {
      const result = await api.saveVersion(documentId);
      if (result.skipped) {
        setVersionFeedback('No changes since last snapshot');
      } else {
        setVersionFeedback('Version saved');
      }
      setTimeout(() => setVersionFeedback(''), 2500);
    } catch (error) {
      setVersionFeedback(error.message || 'Save failed');
      setTimeout(() => setVersionFeedback(''), 2500);
    }
  };

  const handleLogout = () => {
    clearAuth();
    setAuthUser(null);
    setShowVersionHistory(false);
  };

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyUrlFeedback('URL copied!');
      setTimeout(() => setCopyUrlFeedback(''), 2000);
    }).catch(() => {
      setCopyUrlFeedback('Copy failed');
      setTimeout(() => setCopyUrlFeedback(''), 2000);
    });
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'vs-dark' ? 'light' : 'vs-dark'));
  };

  const handleExecuteCode = useCallback(async () => {
    if (!document?.content || isExecuting) return;

    setIsExecuting(true);
    setShowTerminal(true);

    setTerminalOutput((prev) => [
      ...prev,
      { type: 'command', content: 'Executing JavaScript code...' },
    ]);

    try {
      const result = await api.execute(document.content);

      if (result.success) {
        setTerminalOutput((prev) => [
          ...prev,
          ...result.output,
          { type: 'success', content: `✓ Executed successfully in ${result.executionTime}ms` },
        ]);
      } else {
        setTerminalOutput((prev) => [
          ...prev,
          ...result.output,
          { type: 'error', content: `✗ Execution failed in ${result.executionTime}ms` },
        ]);
      }
    } catch (error) {
      setTerminalOutput((prev) => [
        ...prev,
        { type: 'error', content: `✗ Network error: ${error.message}` },
      ]);
    } finally {
      setIsExecuting(false);
    }
  }, [document?.content, isExecuting]);

  const handleClearTerminal = () => {
    setTerminalOutput([]);
  };

  if (showUserModal) {
    return <UserModal onSubmit={handleUserSubmit} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
                DW
              </span>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">DevWeave</h1>
                <p className="text-xs text-gray-500">
                  {document?.title || 'Real-time collaborative editor'}
                </p>
              </div>
            </div>
            <ConnectionStatus isConnected={isConnected} />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              {authUser ? (
                <>
                  <span className="text-gray-600">{authUser.email}</span>
                  <Link to="/dashboard" className="text-gray-600 hover:text-gray-800">
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
                    Login
                  </Link>
                  <Link to="/signup" className="text-gray-600 hover:text-gray-800">
                    Sign up
                  </Link>
                </>
              )}
            </div>

            <Toolbar
              onNewDocument={handleNewDocument}
              onCopyUrl={handleCopyUrl}
              copyUrlFeedback={copyUrlFeedback}
              onSaveVersion={handleSaveVersion}
              versionFeedback={versionFeedback}
              onToggleVersionHistory={() => setShowVersionHistory(!showVersionHistory)}
              showVersionHistory={showVersionHistory}
              onToggleChat={() => setShowChat(!showChat)}
              onToggleTheme={toggleTheme}
              onExecuteCode={handleExecuteCode}
              theme={theme}
              showChat={showChat}
              isExecuting={isExecuting}
              showVersionControls={canManageVersions}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <div className="flex-shrink-0 h-full">
          <Sidebar users={users} currentUser={user} />
        </div>

        <div className="flex-1 min-w-0 h-full flex flex-col">
          <div className={`${showTerminal ? 'flex-1' : 'h-full'} min-h-0`}>
            {document && (
              <Editor
                documentId={documentId}
                document={document}
                users={users}
                currentUser={user}
                theme={theme}
                onContentSnapshot={handleContentSnapshot}
                onCursorChange={handleCursorChange}
              />
            )}
          </div>

          {showTerminal && (
            <div className="h-64 border-t border-gray-200">
              <Terminal
                output={terminalOutput}
                isExecuting={isExecuting}
                onClear={handleClearTerminal}
                isVisible={showTerminal}
              />
            </div>
          )}
        </div>

        {showChat && (
          <div className="flex-shrink-0 h-full">
            <Chat
              messages={chatMessages}
              currentUser={user}
              onSendMessage={handleSendMessage}
              onClose={() => setShowChat(false)}
            />
          </div>
        )}

        {canManageVersions && (
          <VersionHistory
            documentId={documentId}
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
          />
        )}
      </div>

      <footer className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span>
              Document:
              {documentId.slice(0, 8)}
              ...
            </span>
            <span>
              Users:
              {Object.keys(users).length}
            </span>
            {document?.version != null && (
              <span>
                v
                {document.version}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span>Yjs + PostgreSQL</span>
            <div className="w-2 h-2 bg-green-500 rounded-full" />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default EditorPage;
