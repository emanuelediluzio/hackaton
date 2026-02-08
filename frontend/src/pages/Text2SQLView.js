import React, { useState } from 'react';
import { Search, Database, Loader2, Table2, Code, HelpCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EXAMPLE_QUERIES = [
  "Show all teaching hospitals in Ghana",
  "Find facilities in Upper West with less than 50 beds",
  "List hospitals with MRI or CT Scanner equipment",
  "Which facilities have ICU and Surgery services?",
  "Find medical deserts in Northern region",
  "Show the top 10 largest hospitals by bed count",
  "Find private clinics in Greater Accra",
  "List facilities with ophthalmology specialty",
];

export default function Text2SQLView() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const executeQuery = async (q) => {
    const queryText = q || query;
    if (!queryText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/text2sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: queryText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Query failed');
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="text2sql-page" className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white">Structured Query</h1>
        <p className="text-sm text-slate-400 mt-1">Ask questions in natural language - AI converts them to database queries</p>
      </div>

      {/* Query input */}
      <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-5 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              data-testid="text2sql-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && executeQuery()}
              placeholder="Ask a structured question about facilities..."
              className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg pl-10 pr-4 py-3 text-sm placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>
          <button
            data-testid="text2sql-execute-btn"
            onClick={() => executeQuery()}
            disabled={loading || !query.trim()}
            className="bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-white rounded-lg px-6 py-3 transition-all shadow-[0_0_10px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] disabled:shadow-none flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Query
          </button>
        </div>

        {/* Examples */}
        <div>
          <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> Try these examples:
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((eq, i) => (
              <button
                key={i}
                data-testid={`text2sql-example-${i}`}
                onClick={() => { setQuery(eq); executeQuery(eq); }}
                className="text-[11px] px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-400 hover:text-white hover:border-sky-500/30 transition-all"
              >
                {eq}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 text-rose-400 text-sm" data-testid="text2sql-error">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Query info */}
          <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Code className="w-4 h-4 text-indigo-400" />
              <h3 className="font-heading font-semibold text-white text-sm">Generated Query</h3>
              <span className="text-xs text-slate-500 ml-auto">{result.result_count} results</span>
            </div>
            <pre className="bg-slate-950/50 rounded-lg p-3 text-xs text-sky-300 font-mono overflow-x-auto" data-testid="text2sql-mongo-query">
              {JSON.stringify(result.mongo_query, null, 2)}
            </pre>
            {result.explanation && (
              <p className="text-xs text-slate-400 mt-2">{result.explanation}</p>
            )}
          </div>

          {/* Results table */}
          {result.results?.length > 0 && (
            <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
                <Table2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-heading font-semibold text-white text-sm">Results</h3>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs" data-testid="text2sql-results-table">
                  <thead className="bg-slate-800/30 sticky top-0">
                    <tr>
                      {Object.keys(result.results[0]).map(key => (
                        <th key={key} className="text-left py-2.5 px-3 text-slate-400 font-medium whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="py-2 px-3 text-slate-300 max-w-[300px] truncate">
                            {Array.isArray(val) ? val.join(', ') : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
