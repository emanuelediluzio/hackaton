import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2, MapPin, Stethoscope, FileText, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central',
  'Volta', 'Northern', 'Upper East', 'Upper West', 'Brong Ahafo',
  'Bono', 'Bono East', 'Oti', 'Savannah', 'Ahafo',
  'Western North', 'North East'
];

const SPECIALTIES = [
  'Surgery', 'Internal Medicine', 'Pediatrics', 'Obstetrics',
  'Cardiology', 'Neurology', 'Oncology', 'Ophthalmology',
  'Orthopedics', 'ENT', 'Psychiatry', 'Emergency Medicine',
  'General Medicine'
];

export default function PlanningView() {
  const [region, setRegion] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/planning/history`, { credentials: 'include' });
        setHistory(await res.json());
      } catch (err) { console.error(err); }
    };
    fetchHistory();
  }, [plan]);

  const generatePlan = async () => {
    setLoading(true);
    setPlan(null);
    try {
      const res = await fetch(`${API_URL}/api/planning/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ region: region || null, specialty: specialty || null, description: description || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlan({ plan_text: `**Error:** ${data.detail || 'Failed to generate plan. Please try again.'}`, plan_id: 'error' });
        return;
      }
      setPlan(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="planning-page" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Resource Planning</h1>
          <p className="text-sm text-slate-400 mt-1">AI-powered healthcare resource allocation recommendations</p>
        </div>
        <button
          data-testid="planning-history-btn"
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <History className="w-4 h-4" />
          History ({history.length})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-5 space-y-4">
            <h3 className="font-heading font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-sky-400" />
              Plan Parameters
            </h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Target Region</label>
              <select
                data-testid="planning-region"
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="">All Regions</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Specialty Focus</label>
              <select
                data-testid="planning-specialty"
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="">General</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Additional Context</label>
              <textarea
                data-testid="planning-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe specific needs, constraints, or priorities..."
                rows={4}
                className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 text-sm placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none resize-none"
              />
            </div>

            <button
              data-testid="generate-plan-btn"
              onClick={generatePlan}
              disabled={loading}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-white font-medium rounded-lg py-3 transition-all shadow-[0_0_10px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <ClipboardList className="w-4 h-4" />
                  Generate Plan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Plan Output */}
        <div className="lg:col-span-2">
          {plan ? (
            <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-6" data-testid="plan-output">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-sky-400" />
                <h3 className="font-heading font-semibold text-white">Resource Allocation Plan</h3>
                <span className="text-[10px] text-slate-500 ml-auto">{plan.plan_id}</span>
              </div>
              <div className="flex gap-2 mb-4">
                {plan.region && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 text-sky-400 rounded text-xs">
                    <MapPin className="w-3 h-3" /> {plan.region}
                  </span>
                )}
                {plan.specialty && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                    <Stethoscope className="w-3 h-3" /> {plan.specialty}
                  </span>
                )}
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed">
                <ReactMarkdown>{plan.plan_text}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-12 text-center">
              <ClipboardList className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-slate-400 mb-2">No Plan Generated Yet</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Configure parameters on the left and click "Generate Plan" to get AI-powered resource allocation recommendations.
              </p>
            </div>
          )}

          {/* History */}
          {showHistory && history.length > 0 && (
            <div className="mt-4 bg-[#1E293B] border border-slate-700/50 rounded-xl p-5" data-testid="plan-history">
              <h3 className="font-heading font-semibold text-white mb-3">Previous Plans</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setPlan(h)}
                    className="w-full text-left px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white font-medium">{h.plan_id}</span>
                      {h.region && <span className="text-sky-400">{h.region}</span>}
                      {h.specialty && <span className="text-indigo-400">{h.specialty}</span>}
                      <span className="text-slate-500 ml-auto">{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
