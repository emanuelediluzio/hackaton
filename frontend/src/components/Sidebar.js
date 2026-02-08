import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, MessageSquare, Building2, ClipboardList, LogOut, ChevronLeft, ChevronRight, Heart, Database, Activity } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/map', label: 'Map', icon: Map },
  { path: '/chat', label: 'AI Chat', icon: MessageSquare },
  { path: '/facilities', label: 'Facilities', icon: Building2 },
  { path: '/planning', label: 'Planning', icon: ClipboardList },
  { path: '/text2sql', label: 'Query', icon: Database },
  { path: '/tracking', label: 'Tracking', icon: Activity },
];

export default function Sidebar({ open, setOpen, user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    navigate('/login');
  };

  return (
    <aside
      data-testid="sidebar"
      className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 
        ${open ? 'w-64' : 'w-16'} 
        bg-[#111827] border-r border-slate-800/50`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-800/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
            <Heart className="w-4 h-4 text-white" />
          </div>
          {open && (
            <div className="overflow-hidden">
              <h1 className="font-heading font-bold text-sm text-white truncate">Virtue Foundation</h1>
              <p className="text-[10px] text-slate-500 truncate">IDP Medical Tracker</p>
            </div>
          )}
          <button
            data-testid="sidebar-toggle"
            onClick={() => setOpen(!open)}
            className="ml-auto p-1 hover:bg-slate-800 rounded transition-colors"
          >
            {open ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm
                  ${isActive
                    ? 'bg-sky-500/10 text-sky-400 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.2)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {open && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-800/50">
          {open && user && (
            <div className="flex items-center gap-2 mb-2 px-2">
              {user.picture ? (
                <img src={user.picture} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                  {user.name?.[0]}
                </div>
              )}
              <span className="text-xs text-slate-300 truncate">{user.name}</span>
            </div>
          )}
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {open && <span>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
