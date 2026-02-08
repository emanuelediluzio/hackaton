import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import ChatView from './pages/ChatView';
import FacilityExplorer from './pages/FacilityExplorer';
import PlanningView from './pages/PlanningView';
import Text2SQLView from './pages/Text2SQLView';
import MLFlowView from './pages/MLFlowView';
import LoginPage from './pages/LoginPage';
import AuthCallback from './components/AuthCallback';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (location.state?.user) {
      setUser(location.state.user);
      setIsAuthenticated(true);
      checkedRef.current = true;
      return;
    }
    if (checkedRef.current && isAuthenticated) return;
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) throw new Error('Not auth');
        const userData = await res.json();
        setUser(userData);
        setIsAuthenticated(true);
        checkedRef.current = true;
      } catch {
        setIsAuthenticated(false);
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate, location.state, isAuthenticated]);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B1120]">
        <div className="animate-pulse text-slate-400 font-heading text-xl">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children({ user }) : null;
}

function AppLayout({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <div className="flex h-screen bg-[#0B1120] overflow-hidden">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} user={user} />
      <main className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/chat" element={<ChatView />} />
          <Route path="/facilities" element={<FacilityExplorer />} />
          <Route path="/planning" element={<PlanningView />} />
          <Route path="/text2sql" element={<Text2SQLView />} />
          <Route path="/tracking" element={<MLFlowView />} />
        </Routes>
      </main>
    </div>
  );
}

function AppRouter() {
  const location = useLocation();
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
          {({ user }) => <AppLayout user={user} />}
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
