import React, { useState, useEffect } from 'react';
import { Activity, Clock, Gauge, RefreshCw, Zap, BarChart3 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function MLFlowView() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mlflow/runs?limit=30`, { credentials: 'include' });
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRuns(); }, []);

  const avgLatency = runs.length > 0
    ? Math.round(runs.reduce((sum, r) => sum + (r.metrics?.total_latency_ms || 0), 0) / runs.filter(r => r.metrics?.total_latency_ms).length || 1)
    : 0;

  const totalQueries = runs.length;
  const avgDocs = runs.length > 0
    ? Math.round(runs.reduce((sum, r) => sum + (r.metrics?.docs_retrieved || 0), 0) / runs.filter(r => r.metrics?.docs_retrieved).length || 1)
    : 0;

  return (
    <div data-testid="mlflow-page" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Agent Tracking</h1>
          <p className="text-sm text-slate-400 mt-1">MLFlow experiment tracking for agent reasoning transparency</p>
        </div>
        <button
          data-testid="mlflow-refresh-btn"
          onClick={fetchRuns}
          className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Zap className="w-3.5 h-3.5 text-sky-400" /> Total Runs
          </div>
          <p className="font-heading font-bold text-2xl text-white">{totalQueries}</p>
        </div>
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Avg Latency
          </div>
          <p className="font-heading font-bold text-2xl text-white">{avgLatency}ms</p>
        </div>
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> Avg Docs Retrieved
          </div>
          <p className="font-heading font-bold text-2xl text-white">{avgDocs}</p>
        </div>
      </div>

      {/* Runs table */}
      <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
          <Activity className="w-4 h-4 text-sky-400" />
          <h3 className="font-heading font-semibold text-white text-sm">Experiment Runs</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading runs...</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No runs yet. Use the Chat or Text2SQL features to generate tracked runs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="mlflow-runs-table">
              <thead className="bg-slate-800/30">
                <tr>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Run</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Query</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Total Latency</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Search</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">LLM</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Docs</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Citations</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <tr
                    key={run.run_id || i}
                    data-testid={`mlflow-run-${i}`}
                    onClick={() => setSelectedRun(selectedRun === i ? null : i)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 text-sky-400 font-mono">{run.run_name || run.run_id?.slice(0, 8)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        run.type === 'rag_chat' ? 'bg-sky-500/10 text-sky-400' :
                        run.type === 'text2sql' ? 'bg-indigo-500/10 text-indigo-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {run.type || 'unknown'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-[200px] truncate">
                      {run.params?.user_query || run.params?.natural_query || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {run.metrics?.total_latency_ms ? `${Math.round(run.metrics.total_latency_ms)}ms` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {run.metrics?.faiss_search_ms ? `${Math.round(run.metrics.faiss_search_ms)}ms` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {run.metrics?.llm_latency_ms ? `${Math.round(run.metrics.llm_latency_ms)}ms` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {run.metrics?.docs_retrieved ?? '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {run.metrics?.citation_count ?? '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {run.start_time ? new Date(run.start_time).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run details */}
      {selectedRun !== null && runs[selectedRun] && (
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-5" data-testid="mlflow-run-detail">
          <h3 className="font-heading font-semibold text-white mb-3">Run Details: {runs[selectedRun].run_name}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-slate-500 font-medium mb-1">Parameters</p>
              <div className="bg-slate-950/50 rounded-lg p-3 space-y-1">
                {Object.entries(runs[selectedRun].params || {}).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="text-slate-500">{k}:</span>
                    <span className="text-slate-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium mb-1">Metrics</p>
              <div className="bg-slate-950/50 rounded-lg p-3 space-y-1">
                {Object.entries(runs[selectedRun].metrics || {}).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="text-slate-500">{k}:</span>
                    <span className="text-slate-300">{typeof v === 'number' ? v.toFixed(1) : v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
