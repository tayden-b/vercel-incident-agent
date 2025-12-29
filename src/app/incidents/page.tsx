'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock, AlertCircle, ExternalLink, Activity, Info } from 'lucide-react';

export default function IncidentList() {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    async function fetchIncidents() {
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

    useEffect(() => {
        fetchIncidents();
    }, []);

    return (
        <div className="min-h-screen bg-[#fafafa] text-[#171717] font-sans">
            <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/" className="hover:text-gray-600 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <span className="font-semibold text-lg">Incidents</span>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Severity</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Title / Signature</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Events</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Last Seen</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 uppercase">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Loading incidents...</td>
                                </tr>
                            ) : incidents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No incidents found</td>
                                </tr>
                            ) : (
                                incidents.map((incident) => (
                                    <tr key={incident.id} className="hover:bg-gray-50 transition-colors group text-xs font-medium">
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full ${incident.status === 'OPEN' || incident.status === 'NOTIFIED' ? 'bg-red-100 text-red-700' :
                                                    incident.status === 'REDEPLOY_TRIGGERED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {incident.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full ${incident.severity === 'P0' ? 'bg-red-600 text-white' :
                                                    incident.severity === 'P1' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                                                }`}>
                                                {incident.severity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-sm">
                                            <div className="font-semibold text-black mb-1 normal-case truncate">{incident.title}</div>
                                            <div className="text-[10px] text-gray-400 font-mono lower-case truncate">{incident.errorSignature}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-sm">
                                            {incident.eventCount}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(incident.lastSeenAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link href={`/incidents/${incident.id}`} className="inline-flex items-center text-black hover:text-gray-600 transition-colors">
                                                Details <ChevronLeft className="w-4 h-4 ml-1 rotate-180" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
