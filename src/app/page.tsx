'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, RefreshCw, Layers, Shield } from 'lucide-react';

export default function Dashboard() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  async function fetchIncidents() {
    setLoading(true);
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      setIncidents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function runPoll() {
    setPolling(true);
    try {
      await fetch('/api/poll-now', { method: 'POST' });
      await fetchIncidents();
    } catch (e) {
      console.error(e);
    } finally {
      setPolling(false);
    }
  }

  useEffect(() => {
    fetchIncidents();
  }, []);

  const openIncidents = Array.isArray(incidents) ? incidents.filter(i => i.status === 'OPEN' || i.status === 'NOTIFIED') : [];
  const lastIncident = Array.isArray(incidents) ? incidents[0] : null;

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] font-sans">
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-black" />
            <span className="font-semibold text-lg">Incident Agent</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={runPoll}
              disabled={polling}
              className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center"
            >
              {polling ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {polling ? 'Polling...' : 'Run Poll Now'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500">Overview of your Vercel project health</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Open Incidents</span>
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-3xl font-bold">{openIncidents.length}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Detected</span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-3xl font-bold">{incidents.length}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Last Poll</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-sm font-medium truncated">
              {lastIncident ? new Date(lastIncident.lastSeenAt).toLocaleString() : 'N/A'}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Project ID</span>
              <Shield className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-sm font-mono truncate">{process.env.NEXT_PUBLIC_VERCEL_PROJECT_ID || 'Configured in ENV'}</div>
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Incidents</h2>
            <Link href="/incidents" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">Loading incidents...</div>
            ) : Array.isArray(incidents) && incidents.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No incidents detected yet. Good job!</div>
            ) : !Array.isArray(incidents) ? (
              <div className="p-12 text-center text-red-500">Failed to load incidents.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {incidents.slice(0, 5).map((incident: any) => (
                  <Link key={incident.id} href={`/incidents/${incident.id}`} className="block p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${incident.status === 'OPEN' || incident.status === 'NOTIFIED' ? 'bg-red-100 text-red-700' :
                              incident.status === 'REDEPLOY_TRIGGERED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                            {incident.status}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${incident.severity === 'P0' ? 'bg-red-600 text-white' :
                              incident.severity === 'P1' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                            }`}>
                            {incident.severity}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base truncate max-w-xl">{incident.title}</h3>
                        <p className="text-sm font-sans text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Last seen {new Date(incident.lastSeenAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{incident.eventCount}</div>
                        <div className="text-[10px] text-gray-400 uppercase font-medium">Events</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
