import React, { useState, useEffect } from 'react';
import { Activity, Bed, Users, Building2, AlertTriangle, Stethoscope, TrendingUp, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function StatCard({ icon: Icon, label, value, color, subtext }) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`} className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-5 relative overflow-hidden group hover:border-slate-600/50 transition-all">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 font-body mb-1">{label}</p>
          <p className="font-heading font-bold text-2xl text-white">{value}</p>
          {subtext && <p className="text-[11px] text-slate-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color} bg-opacity-10`}>
          <Icon className="w-5 h-5" style={{ color: color === 'bg-sky-500' ? '#38BDF8' : color === 'bg-emerald-500' ? '#10B981' : color === 'bg-amber-500' ? '#F59E0B' : color === 'bg-rose-500' ? '#F43F5E' : color === 'bg-indigo-500' ? '#6366F1' : '#38BDF8' }} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [deserts, setDeserts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, desertsRes] = await Promise.all([
          fetch(`${API_URL}/api/analysis/stats`, { credentials: 'include' }),
          fetch(`${API_URL}/api/analysis/medical-deserts`, { credentials: 'include' }),
        ]);
        setStats(await statsRes.json());
        setDeserts(await desertsRes.json());
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  const typeData = stats?.facility_types ? Object.entries(stats.facility_types).map(([name, value]) => ({ name, value })) : [];
  const desertData = deserts.map(d => ({
    name: d.region,
    score: d.desert_score,
    beds: d.total_beds,
    fill: d.desert_score >= 60 ? '#F43F5E' : d.desert_score >= 40 ? '#F59E0B' : '#10B981',
  }));

  const PIE_COLORS = ['#38BDF8', '#6366F1', '#F472B6', '#10B981', '#F59E0B'];

  return (
    <div data-testid="dashboard-page" className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Ghana Healthcare Facility Intelligence</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Live Data - {stats?.total_facilities || 0} facilities</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Facilities" value={stats?.total_facilities?.toLocaleString()} color="bg-sky-500" subtext="Across all regions" />
        <StatCard icon={Bed} label="Total Beds" value={stats?.total_beds?.toLocaleString()} color="bg-indigo-500" subtext="Available capacity" />
        <StatCard icon={Users} label="Healthcare Staff" value={stats?.total_staff?.toLocaleString()} color="bg-emerald-500" subtext="Doctors, nurses, support" />
        <StatCard icon={AlertTriangle} label="Medical Deserts" value={stats?.medical_deserts} color="bg-rose-500" subtext="Critical coverage gaps" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Desert Scores by Region */}
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-5">
          <h3 className="font-heading font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-400" />
            Medical Desert Score by Region
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={desertData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={90} tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#F8FAFC' }}
                formatter={(v) => [`${v}/100`, 'Desert Score']}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {desertData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Facility Types */}
        <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-5">
          <h3 className="font-heading font-semibold text-white mb-4 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-sky-400" />
            Facility Types Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: '#475569' }}>
                {typeData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#F8FAFC' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Medical Deserts Table */}
      <div className="bg-[#1E293B] border border-slate-700/50 rounded-xl p-5">
        <h3 className="font-heading font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          Regional Analysis
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="desert-table">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left py-2.5 px-3 text-slate-400 font-medium text-xs">Region</th>
                <th className="text-left py-2.5 px-3 text-slate-400 font-medium text-xs">Facilities</th>
                <th className="text-left py-2.5 px-3 text-slate-400 font-medium text-xs">Beds</th>
                <th className="text-left py-2.5 px-3 text-slate-400 font-medium text-xs">Staff</th>
                <th className="text-left py-2.5 px-3 text-slate-400 font-medium text-xs">Specialties</th>
                <th className="text-left py-2.5 px-3 text-slate-400 font-medium text-xs">Desert Score</th>
                <th className="text-left py-2.5 px-3 text-slate-400 font-medium text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {deserts.map((d, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-3 text-white font-medium">{d.region}</td>
                  <td className="py-2.5 px-3 text-slate-300">{d.facilities?.length}</td>
                  <td className="py-2.5 px-3 text-slate-300">{d.total_beds?.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-300">{d.total_staff?.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-300">{d.specialties?.length}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${d.desert_score}%`,
                            backgroundColor: d.desert_score >= 60 ? '#F43F5E' : d.desert_score >= 40 ? '#F59E0B' : '#10B981'
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{d.desert_score}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${d.severity === 'Critical' ? 'bg-rose-500/10 text-rose-400' : d.severity === 'Moderate' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {d.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
