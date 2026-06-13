import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, UserPlus, Users } from 'lucide-react';
import { getStoredUser } from '../services/auth';

function Welcome() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [guestMode, setGuestMode] = useState(false);
  const [name, setName] = useState('');
  const [documentLink, setDocumentLink] = useState('');
  const [error, setError] = useState('');

  const joinAsGuest = (event) => {
    event.preventDefault();
    setError('');

    let documentId = documentLink.trim();
    try {
      if (documentId.includes('://')) {
        documentId = new URL(documentId).searchParams.get('doc') || '';
      } else if (documentId.includes('?doc=')) {
        documentId = new URL(documentId, window.location.origin).searchParams.get('doc') || '';
      }
    } catch {
      documentId = '';
    }

    if (!name.trim() || !documentId) {
      setError('Enter your name and a valid shared document link or document ID.');
      return;
    }

    sessionStorage.setItem('devweave_guest', JSON.stringify({ name: name.trim() }));
    navigate(`/?doc=${encodeURIComponent(documentId)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
        <div className="text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            DW
          </span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">DevWeave</h1>
          <p className="mt-1 text-sm text-gray-500">Choose how you want to continue</p>
        </div>

        {user ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700"
          >
            Continue as {user.name}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
            <Link
              to="/signup"
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              <UserPlus className="h-4 w-4" />
              Sign up
            </Link>
          </div>
        )}

        <button
          onClick={() => setGuestMode((current) => !current)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          <Users className="h-4 w-4" />
          Join as Guest
        </button>

        {guestMode && (
          <form onSubmit={joinAsGuest} className="mt-5 space-y-4 border-t border-gray-200 pt-5">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label htmlFor="guest-name" className="mb-1 block text-sm font-medium text-gray-700">Your name</label>
              <input
                id="guest-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={50}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="document-link" className="mb-1 block text-sm font-medium text-gray-700">Shared document link or ID</label>
              <input
                id="document-link"
                value={documentLink}
                onChange={(event) => setDocumentLink(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 font-medium text-white hover:bg-black"
            >
              Join Document
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Welcome;
