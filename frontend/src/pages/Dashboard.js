import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Edit2, FileText, LogOut, Plus, Save, Trash2, X,
} from 'lucide-react';
import { api } from '../services/api';
import { clearAuth, getStoredUser } from '../services/auth';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      setDocuments(await api.listDocuments());
    } catch (err) {
      if (err.status === 401) {
        clearAuth();
        navigate('/login');
        return;
      }
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadDocuments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewDocument = async () => {
    setCreating(true);
    setError('');
    try {
      const created = await api.createDocument('Untitled Document');
      navigate(`/?doc=${created.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const startRename = (document) => {
    setEditingId(document.id);
    setEditingTitle(document.title || 'Untitled Document');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const saveRename = async (documentId) => {
    const title = editingTitle.trim() || 'Untitled Document';
    try {
      const updated = await api.updateDocument(documentId, { title });
      setDocuments((prev) => prev.map((document) => (
        document.id === documentId
          ? { ...document, title: updated.title, updatedAt: new Date().toISOString() }
          : document
      )));
      cancelRename();
    } catch (err) {
      setError(err.message || 'Failed to rename document');
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      await api.deleteDocument(documentId);
      setDocuments((prev) => prev.filter((document) => document.id !== documentId));
    } catch (err) {
      setError(err.message || 'Failed to delete document');
    }
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              DW
            </span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">My Documents</h1>
              <p className="text-sm text-gray-500">Logged in as {user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewDocument}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'Creating...' : 'New Document'}
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">No documents yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="grid grid-cols-[1fr_180px_128px] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Title</span>
              <span>Updated</span>
              <span className="text-right">Actions</span>
            </div>
            {documents.map((document) => (
              <div
                key={document.id}
                className="grid grid-cols-[1fr_180px_128px] items-center gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  {editingId === document.id ? (
                    <input
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveRename(document.id);
                        if (event.key === 'Escape') cancelRename();
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                  ) : (
                    <Link
                      to={`/?doc=${document.id}`}
                      className="truncate text-sm font-medium text-gray-900 hover:text-indigo-700"
                    >
                      {document.title || 'Untitled Document'}
                    </Link>
                  )}
                  <p className="mt-1 truncate text-xs text-gray-500">{document.id}</p>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(document.updatedAt || document.lastModified).toLocaleString()}
                </span>
                <div className="flex justify-end gap-1">
                  {editingId === document.id ? (
                    <>
                      <button
                        onClick={() => saveRename(document.id)}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        aria-label="Save title"
                        title="Save title"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        onClick={cancelRename}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        aria-label="Cancel rename"
                        title="Cancel rename"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startRename(document)}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        aria-label="Rename document"
                        title="Rename document"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteDocument(document.id)}
                        className="rounded p-2 text-red-600 hover:bg-red-50"
                        aria-label="Delete document"
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
