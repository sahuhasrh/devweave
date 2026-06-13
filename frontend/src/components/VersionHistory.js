import React, { useEffect, useState } from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import { api } from '../services/api';

function VersionHistory({ documentId, isOpen, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [message, setMessage] = useState('');

  const loadVersions = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await api.listVersions(documentId);
      setVersions(data);
    } catch (error) {
      setMessage(error.message || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && documentId) {
      loadVersions();
    }
  }, [isOpen, documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestore = async (versionId) => {
    setRestoringId(versionId);
    setMessage('');
    try {
      await api.restoreVersion(documentId, versionId);
      setMessage('Version restored. All collaborators will sync shortly.');
      await loadVersions();
    } catch (error) {
      setMessage(error.message || 'Failed to restore version');
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Version History</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          aria-label="Close version history"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {message && (
          <div className="mb-3 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-sm text-indigo-800">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading versions...</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-gray-500">No saved versions yet. Use &quot;Save Version&quot; to create a snapshot.</p>
        ) : (
          <ul className="space-y-2">
            {versions.map((version) => (
              <li
                key={version.id}
                className="rounded-lg border border-gray-200 p-3 hover:border-indigo-200 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">
                  {new Date(version.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {version.content.slice(0, 80) || '(empty)'}
                  {version.content.length > 80 ? '...' : ''}
                </p>
                <button
                  onClick={() => handleRestore(version.id)}
                  disabled={restoringId === version.id}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  {restoringId === version.id ? 'Restoring...' : 'Restore'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default VersionHistory;
