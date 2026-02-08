import React from 'react';
import { Heart, Shield } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LoginPage() {
  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl text-white">Virtue Foundation</h1>
              <p className="text-xs text-slate-400">Intelligent Document Parsing Agent</p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="font-heading text-xl font-semibold text-white mb-2">
              Medical Desert Tracker
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              AI-powered healthcare facility analysis for Ghana. Identify gaps, plan resources, save lives.
            </p>
          </div>

          {/* Stats preview */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Facilities', value: '3,530+' },
              { label: 'Regions', value: '10' },
              { label: 'Deserts Found', value: '543' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="font-heading font-bold text-sky-400 text-lg">{stat.value}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Login Button */}
          <button
            data-testid="login-btn"
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-xl px-6 py-3.5 transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)]"
          >
            <Shield className="w-5 h-5" />
            Sign in with Google
          </button>

          <p className="text-center text-[11px] text-slate-600 mt-4">
            Secure authentication powered by Emergent
          </p>
        </div>
      </div>
    </div>
  );
}
