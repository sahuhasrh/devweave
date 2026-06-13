import { getToken } from './auth';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return data;
}

export const api = {
  signup: (email, password) => request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  login: (email, password) => request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  me: () => request('/api/auth/me'),

  createDocument: (title) => request('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }),

  listDocuments: () => request('/api/documents'),

  getDocument: (id) => request(`/api/documents/${id}`),

  updateDocument: (id, data) => request(`/api/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  deleteDocument: (id) => request(`/api/documents/${id}`, {
    method: 'DELETE',
  }),

  saveVersion: (documentId) => request(`/api/documents/${documentId}/versions`, {
    method: 'POST',
  }),

  listVersions: (documentId) => request(`/api/documents/${documentId}/history`),

  restoreVersion: (documentId, versionId) => request(
    `/api/documents/${documentId}/versions/${versionId}/restore`,
    { method: 'POST' },
  ),

  execute: (code) => request('/api/execute', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }),
};

export default api;
