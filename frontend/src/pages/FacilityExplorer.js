import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Building2, MapPin, Bed, Users, Stethoscope } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FacilityExplorer() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const perPage = 25;

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (regionFilter) params.append('region', regionFilter);
        if (typeFilter) params.append('type', typeFilter);
        const res = await fetch(`${API_URL}/api/facilities?${params}`, { credentials: 'include' });
        setFacilities(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(fetchFacilities, 300);
    return () => clearTimeout(timer);
  }, [search, regionFilter, typeFilter]);

  const regions = useMemo(() => [...new Set(facilities.map(f => f.region))].sort(), [facilities]);
  const types = useMemo(() => [...new Set(facilities.map(f => f.type))].sort(), [facilities]);

  const sorted = useMemo(() => {
    const s = [...facilities].sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return s;
  }, [facilities, sortBy, sortDir]);

  const paginated = sorted.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(sorted.length / perPage);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div data-testid="facilities-page" className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Facility Explorer</h1>
          <p className="text-sm text-slate-400 mt-1">{sorted.length} facilities found</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            data-testid="facility-search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search facilities, capabilities, equipment..."
            className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
          />
        </div>
        <select
          data-testid="facility-region-filter"
          value={regionFilter}
          onChange={e => { setRegionFilter(e.target.value); setPage(1); }}
          className="bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-sky-500"
        >
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          data-testid="facility-type-filter"
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-sky-500"
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="facility-table">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/30">
                {[
                  { key: 'name', label: 'Facility' },
                  { key: 'region', label: 'Region' },
                  { key: 'type', label: 'Type' },
                  { key: 'beds', label: 'Beds' },
                  { key: 'staff_count', label: 'Staff' },
                  { key: 'operational_status', label: 'Status' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="text-left py-3 px-4 text-slate-400 font-medium text-xs cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(f => (
                <React.Fragment key={f.facility_id}>
                  <tr
                    data-testid={`facility-row-${f.facility_id}`}
                    onClick={() => setExpanded(expanded === f.facility_id ? null : f.facility_id)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                        <div>
                          <p className="text-white font-medium text-xs">{f.name}</p>
                          <p className="text-[10px] text-slate-500">{f.facility_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-xs">{f.region}</td>
                    <td className="py-3 px-4 text-slate-300 text-xs">{f.type}</td>
                    <td className="py-3 px-4 text-slate-300 text-xs">{f.beds}</td>
                    <td className="py-3 px-4 text-slate-300 text-xs">{f.staff_count}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        f.operational_status?.includes('Fully') ? 'bg-emerald-500/10 text-emerald-400' :
                        f.operational_status?.includes('Critical') || f.operational_status?.includes('Severely') || f.operational_status?.includes('Minimal') ? 'bg-rose-500/10 text-rose-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {f.operational_status}
                      </span>
                    </td>
                  </tr>
                  {expanded === f.facility_id && (
                    <tr>
                      <td colSpan="6" className="bg-slate-950/30 px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-slate-500 font-medium mb-1">Capabilities</p>
                            <p className="text-slate-300 leading-relaxed">{f.capabilities_text}</p>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-slate-500 font-medium mb-1">Specialties</p>
                              <div className="flex flex-wrap gap-1">
                                {f.specialties?.length > 0 ? f.specialties.map(s => (
                                  <span key={s} className="px-1.5 py-0.5 bg-sky-500/10 text-sky-400 rounded text-[10px]">{s}</span>
                                )) : <span className="text-slate-600">None listed</span>}
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500 font-medium mb-1">Equipment</p>
                              <div className="flex flex-wrap gap-1">
                                {f.equipment?.map(e => (
                                  <span key={e} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px]">{e}</span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500 font-medium mb-1">Services</p>
                              <div className="flex flex-wrap gap-1">
                                {f.services?.map(s => (
                                  <span key={s} className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px]">{s}</span>
                                ))}
                              </div>
                            </div>
                            {f.notes && (
                              <div>
                                <p className="text-slate-500 font-medium mb-1">Notes</p>
                                <p className={`${f.notes.includes('MEDICAL DESERT') ? 'text-rose-400' : 'text-slate-400'}`}>{f.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} ({sorted.length} facilities)
            </p>
            <div className="flex gap-2">
              <button
                data-testid="page-prev"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              <button
                data-testid="page-next"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
