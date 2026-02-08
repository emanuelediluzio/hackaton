import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Filter, Layers, AlertTriangle, Building2, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function MapLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-[1000] backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 shadow-2xl">
      <p className="text-xs font-heading font-semibold text-white mb-2">Facility Status</p>
      <div className="space-y-1.5">
        {[
          { color: '#10B981', label: 'Fully Operational' },
          { color: '#F59E0B', label: 'Limited/Developing' },
          { color: '#F43F5E', label: 'Critical/Desert' },
          { color: '#6366F1', label: 'Teaching Hospital' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-slate-300">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getMarkerColor(facility) {
  if (facility.type === 'Teaching Hospital') return '#6366F1';
  const status = facility.operational_status || '';
  if (status.includes('Critical') || status.includes('Severely') || status.includes('Minimal')) return '#F43F5E';
  if (status.includes('Limited') || status.includes('Developing') || status.includes('Constrained')) return '#F59E0B';
  return '#10B981';
}

function getMarkerRadius(facility) {
  if (facility.type === 'Teaching Hospital') return 10;
  if (facility.type === 'Regional Hospital') return 8;
  if (facility.type === 'District Hospital' || facility.type === 'Municipal Hospital') return 6;
  if (facility.type === 'Hospital' || facility.type === 'Polyclinic') return 5;
  return 3;
}

export default function MapView() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ region: '', type: '', showDeserts: false });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await fetch(`${API_URL}/api/facilities`, { credentials: 'include' });
        const data = await res.json();
        setFacilities(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFacilities();
  }, []);

  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => {
      if (filters.region && f.region !== filters.region) return false;
      if (filters.type && f.type !== filters.type) return false;
      if (filters.showDeserts && !f.notes?.includes('MEDICAL DESERT')) return false;
      return true;
    });
  }, [facilities, filters]);

  const regions = useMemo(() => [...new Set(facilities.map(f => f.region))].sort(), [facilities]);
  const types = useMemo(() => [...new Set(facilities.map(f => f.type))].sort(), [facilities]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-slate-400">Loading map...</div></div>;
  }

  return (
    <div data-testid="map-page" className="relative w-full h-[calc(100vh)] bg-[#0B1120]">
      {/* Map */}
      <MapContainer center={[7.9, -1.0]} zoom={7} className="w-full h-full" zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        {filteredFacilities.map(f => (
          <CircleMarker
            key={f.facility_id}
            center={[f.latitude, f.longitude]}
            radius={getMarkerRadius(f)}
            fillColor={getMarkerColor(f)}
            color={getMarkerColor(f)}
            weight={1}
            opacity={0.8}
            fillOpacity={0.6}
            eventHandlers={{ click: () => setSelectedFacility(f) }}
          >
            <Popup>
              <div className="text-xs min-w-[200px]">
                <p className="font-bold text-sm">{f.name}</p>
                <p className="text-gray-600">{f.region} - {f.district}</p>
                <p className="mt-1">Type: {f.type}</p>
                <p>Beds: {f.beds} | Staff: {f.staff_count}</p>
                <p className="mt-1 text-gray-500">{f.operational_status}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Filter Button */}
      <button
        data-testid="map-filter-btn"
        onClick={() => setShowFilters(!showFilters)}
        className="absolute top-4 right-4 z-[1000] backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-white hover:bg-slate-800/80 transition-all shadow-xl"
      >
        <Filter className="w-4 h-4" />
        Filters
        {(filters.region || filters.type || filters.showDeserts) && (
          <span className="w-2 h-2 bg-sky-400 rounded-full" />
        )}
      </button>

      {/* Stats overlay */}
      <div className="absolute top-4 left-4 z-[1000] backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 rounded-lg px-4 py-2.5 shadow-xl">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-slate-400">Showing:</span>
            <span className="text-white font-semibold ml-1">{filteredFacilities.length}</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span className="text-rose-400 font-semibold">
              {filteredFacilities.filter(f => f.notes?.includes('MEDICAL DESERT')).length}
            </span>
            <span className="text-slate-400">deserts</span>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute top-16 right-4 z-[1000] backdrop-blur-xl bg-slate-900/90 border border-slate-700/50 rounded-xl p-4 shadow-2xl w-64" data-testid="map-filter-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-sm text-white">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Region</label>
              <select
                data-testid="filter-region"
                value={filters.region}
                onChange={e => setFilters(p => ({ ...p, region: e.target.value }))}
                className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="">All Regions</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Type</label>
              <select
                data-testid="filter-type"
                value={filters.type}
                onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}
                className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="">All Types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer" data-testid="filter-deserts-toggle">
              <input
                type="checkbox"
                checked={filters.showDeserts}
                onChange={e => setFilters(p => ({ ...p, showDeserts: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-600 text-sky-500 focus:ring-sky-500 bg-slate-800"
              />
              <span className="text-xs text-slate-300">Show only Medical Deserts</span>
            </label>
            <button
              data-testid="filter-clear-btn"
              onClick={() => setFilters({ region: '', type: '', showDeserts: false })}
              className="w-full text-xs text-slate-400 hover:text-white py-1.5 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Selected Facility Detail */}
      {selectedFacility && (
        <div className="absolute bottom-6 right-6 z-[1000] backdrop-blur-xl bg-slate-900/90 border border-slate-700/50 rounded-xl p-4 shadow-2xl w-80" data-testid="facility-detail-popup">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-heading font-semibold text-white text-sm pr-6">{selectedFacility.name}</h3>
            <button onClick={() => setSelectedFacility(null)} className="text-slate-400 hover:text-white flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <p className="text-slate-400">{selectedFacility.region} / {selectedFacility.district}</p>
            <p className="text-slate-300"><span className="text-slate-500">Type:</span> {selectedFacility.type}</p>
            <p className="text-slate-300"><span className="text-slate-500">Beds:</span> {selectedFacility.beds} | <span className="text-slate-500">Staff:</span> {selectedFacility.staff_count}</p>
            <p className="text-slate-300"><span className="text-slate-500">Status:</span> {selectedFacility.operational_status}</p>
            {selectedFacility.specialties?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedFacility.specialties.map(s => (
                  <span key={s} className="px-1.5 py-0.5 bg-sky-500/10 text-sky-400 rounded text-[10px]">{s}</span>
                ))}
              </div>
            )}
            {selectedFacility.notes && (
              <p className={`mt-1.5 text-[11px] ${selectedFacility.notes.includes('MEDICAL DESERT') ? 'text-rose-400' : 'text-slate-500'}`}>
                {selectedFacility.notes}
              </p>
            )}
          </div>
        </div>
      )}

      <MapLegend />
    </div>
  );
}
