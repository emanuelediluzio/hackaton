import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = window.location.hash;
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      if (!sessionId) {
        navigate('/login');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!res.ok) throw new Error('Auth failed');
        const user = await res.json();
        navigate('/', { state: { user }, replace: true });
      } catch (err) {
        console.error('Auth error:', err);
        navigate('/login');
      }
    };
    processAuth();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-[#0B1120]">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-400">Authenticating...</p>
      </div>
    </div>
  );
}
