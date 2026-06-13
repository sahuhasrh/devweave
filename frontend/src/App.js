import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Welcome from './pages/Welcome';

function HomeRoute() {
  const hasDocument = new URLSearchParams(window.location.search).has('doc');
  return hasDocument ? <EditorPage /> : <Welcome />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<HomeRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
