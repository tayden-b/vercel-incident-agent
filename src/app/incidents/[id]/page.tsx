'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock, AlertCircle, Activity, Shield, ExternalLink, ArrowRight } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

// In Next.js 15+, params is async but often populated. 
// SAFEST FIX: Use React.use() if available or just check if it's ready. 
// However, for this crash, the issue is data fetching.

// We can unwrap params if needed, but the main error is "Cannot read properties of undefined (reading 'map')"
// on incident.events.

// Let's rely on defensive checks primarily.

export default function IncidentDetail() {
    const { id } = useParams();
    const router = useRouter();

    const [incident, setIncident] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionPending, setActionPending] = useState(false);

    async function fetchIncident(incidentId: string) {
        setLoading(true);
        try {
            const res = await fetch(`/api/incidents/${incidentId}`);
            const data = await res.json();
            setIncident(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function performAction(action: 'redeploy' | 'dismiss') {
        setActionPending(true);
        try {
            const res = await fetch(`/api/incidents/${id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (data.success) {
                setIncident({ ...incident, status: data.status });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionPending(false);
        }
    }

    function getEmailHtml() {
        if (!incident || !incident.analysis) return '';

        const summary = incident.analysis.summary;
        const recommendedAction = incident.analysis.recommendedAction;
        const likelyCauses = JSON.parse(incident.analysis.likelyCausesJson);
        const approveUrl = '#'; // Demo link
        const dismissUrl = '#'; // Demo link

        return `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #000; color: #fff; padding: 20px;">
                    <h2 style="margin: 0;">New Incident Detected</h2>
                </div>
                <div style="padding: 20px;">
                    <p><strong>Title:</strong> ${incident.title}</p>
                    <p><strong>Path:</strong> ${incident.requestPath || 'N/A'}</p>
                    <p><strong>Count:</strong> ${incident.eventCount} events</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <h3>LLM Analysis</h3>
                    <p><strong>Summary:</strong> ${summary}</p>
                    <p><strong>Recommended Action:</strong> ${recommendedAction}</p>
                    <h4>Likely Causes:</h4>
                    <ul>
                        ${likelyCauses.map((c: any) => `<li><strong>${c.cause}</strong> (Confidence: ${(c.confidence * 100).toFixed(0)}%)<br/><em>Evidence: ${c.evidence}</em></li>`).join('')}
                    </ul>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <div style="margin-top: 20px;">
                        <a href="${approveUrl}" style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Approve Redeploy</a>
                        <a href="${dismissUrl}" style="background-color: #666; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Dismiss</a>
                    </div>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">Signature: ${incident.errorSignature}</p>
                </div>
            </div>
        `;
    }

    useEffect(() => {
        if (id) fetchIncident(id as string);
    }, [id]);

    if (loading) return <div className="p-12 text-center text-gray-500">Loading incident details...</div>;
    if (!incident) return <div className="p-12 text-center text-gray-500">Incident not found</div>;

    return (
        <div className="min-h-screen bg-[#fafafa] text-[#171717] font-sans">
            <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/incidents" className="hover:text-gray-600 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <span className="font-semibold text-lg truncate max-w-xs">{incident.title}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => performAction('dismiss')}
                            disabled={actionPending || incident.status === 'DISMISSED'}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-100 rounded-md transition-all disabled:opacity-50"
                        >
                            Dismiss
                        </button>
                        <button
                            onClick={() => performAction('redeploy')}
                            disabled={actionPending || incident.status === 'REDEPLOY_TRIGGERED'}
                            className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                            Trigger Redeploy
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-8">
                        {/* Summary Section */}
                        <section className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex items-center space-x-2 mb-6 text-blue-600">
                                <Shield className="w-5 h-5" />
                                <h2 className="text-xl font-bold">LLM Analysis</h2>
                            </div>

                            {incident.analysis ? (
                                <div className="space-y-6">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3 mb-6">
                                        <div className="bg-green-100 rounded-full p-1 mt-0.5">
                                            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-green-900">Approval Link Sent to Gmail</h4>
                                            <p className="text-xs text-green-700 mt-1">
                                                An email with secure approval and redeployment links has been sent to the registered Google Workspace account. Check your inbox to authorize the fix.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-2">Summary</h3>
                                        <p className="text-lg text-gray-800 leading-relaxed font-medium">{incident.analysis.summary}</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Likely Causes</h3>
                                        {JSON.parse(incident.analysis.likelyCausesJson).map((cause: any, idx: number) => (
                                            <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-gray-900">{cause.cause}</span>
                                                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                        {(cause.confidence * 100).toFixed(0)}% Confidence
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 italic mt-2 font-mono">"{cause.evidence}"</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                        <div className="flex items-center space-x-2 text-blue-800 mb-2 font-bold">
                                            <Activity className="w-4 h-4" />
                                            <span>Recommended Action</span>
                                        </div>
                                        <p className="text-blue-900 font-medium capitalize">{incident.analysis.recommendedAction}</p>
                                        <ul className="mt-3 space-y-1">
                                            {JSON.parse(incident.analysis.nextStepsJson).map((step: string, idx: number) => (
                                                <li key={idx} className="text-sm text-blue-800 flex items-start">
                                                    <ArrowRight className="w-3 h-3 mr-2 mt-1 shrink-0" />
                                                    {step}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-gray-100 rounded-2xl text-center text-gray-400">
                                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p>No LLM analysis available for this incident.</p>
                                </div>
                            )}
                        </section>

                        {/* Evidence Section */}
                        <section className="bg-white overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
                            <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-gray-900 font-bold">
                                    <Activity className="w-5 h-5" />
                                    <h2>Logs & Evidence</h2>
                                </div>
                                <span className="text-xs font-bold uppercase text-gray-400">{incident.eventCount} Events</span>
                            </div>
                            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto font-mono text-xs">
                                {incident.events && (incident.events || []).map((event: any) => (
                                    <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <span className="text-gray-400 tabular-nums">{new Date(event.timestampInMs).toISOString()}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-black ${event.level === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {event.level}
                                            </span>
                                            {event.responseStatusCode && (
                                                <span className="text-gray-900 font-bold">{event.responseStatusCode}</span>
                                            )}
                                            {event.requestMethod && (
                                                <span className="text-gray-400 uppercase font-black">{event.requestMethod}</span>
                                            )}
                                            {event.requestPath && (
                                                <span className="text-gray-600 truncate max-w-[200px]">{event.requestPath}</span>
                                            )}
                                        </div>
                                        <pre className="whitespace-pre-wrap break-all text-gray-800 leading-relaxed">{event.message}</pre>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
                            <div className={`absolute top-0 right-0 left-0 h-1 ${incident.status === 'OPEN' || incident.status === 'NOTIFIED' ? 'bg-red-500' :
                                incident.status === 'REDEPLOY_TRIGGERED' ? 'bg-green-500' : 'bg-gray-400'
                                }`} />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Metadata</h3>
                            <dl className="space-y-4">
                                <div>
                                    <dt className="text-[10px] text-gray-400 uppercase font-bold mb-1">Status</dt>
                                    <dd className="text-sm font-bold uppercase">{incident.status}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] text-gray-400 uppercase font-bold mb-1">Severity</dt>
                                    <dd className="text-sm font-bold uppercase flex items-center space-x-2">
                                        <div className={`w-2 h-2 rounded-full ${incident.severity === 'P0' ? 'bg-red-600' :
                                            incident.severity === 'P1' ? 'bg-orange-500' : 'bg-blue-500'
                                            }`} />
                                        <span>{incident.severity}</span>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] text-gray-400 uppercase font-bold mb-1">First Seen</dt>
                                    <dd className="text-xs text-gray-800">{new Date(incident.firstSeenAt).toLocaleString()}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] text-gray-400 uppercase font-bold mb-1">Last Seen</dt>
                                    <dd className="text-xs text-gray-800">{new Date(incident.lastSeenAt).toLocaleString()}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] text-gray-400 uppercase font-bold mb-1">Deployment ID</dt>
                                    <dd className="text-xs text-gray-800 font-mono truncate">{incident.deployment?.vercelDeploymentId || 'N/A'}</dd>
                                </div>
                            </dl>
                        </section>

                        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Notification Preview</h3>
                            {incident.analysis ? (
                                <div>
                                    <p className="text-xs text-gray-500 mb-4">
                                        This is a preview of the HTML email sent to stakeholders.
                                    </p>
                                    <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 overflow-hidden">
                                        <div dangerouslySetInnerHTML={{ __html: getEmailHtml() }} className="scale-[0.8] origin-top-left w-[125%]" />
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 italic">Analysis required for email preview.</p>
                            )}
                        </section>

                        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Quick Links</h3>
                            <div className="space-y-2">
                                <a
                                    href={`https://vercel.com/deployments/${incident.deployment?.vercelDeploymentId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-xs font-medium text-gray-600 hover:text-black transition-all"
                                >
                                    View Deployment in Vercel <ExternalLink className="w-3 h-3" />
                                </a>
                                <a
                                    href={`https://vercel.com/logs/${incident.deployment?.vercelDeploymentId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-xs font-medium text-gray-600 hover:text-black transition-all"
                                >
                                    Full Runtime Logs <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
