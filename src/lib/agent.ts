import { db } from './db';
import { getLatestDeployment, getLogsStream } from './vercel';
import { processLogs } from './incident';
import { analyzeIncident } from './llm';
import { sendEmail } from './gmail';
import crypto from 'crypto';

export async function runAgent() {
    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!projectId) throw new Error('VERCEL_PROJECT_ID is not set');

    // 1. Get latest deployment
    const latestVercelDeployment = await getLatestDeployment(projectId);
    if (!latestVercelDeployment) {
        console.log('No production deployment found');
        return { status: 'no_deployment' };
    }

    // 2. Sync deployment in DB
    const deployment = await db.deployment.upsert({
        where: { vercelDeploymentId: latestVercelDeployment.uid },
        update: {},
        create: {
            vercelDeploymentId: latestVercelDeployment.uid,
            target: latestVercelDeployment.target || 'production',
        },
    });

    // 3. Fetch logs
    const logs = [];
    for await (const log of getLogsStream(latestVercelDeployment.uid)) {
        logs.push({
            rowId: log.id || log.rowId || crypto.randomUUID(),
            timestampInMs: log.timestamp || log.timestampInMs || Date.now(),
            level: log.level || 'info',
            message: log.message || '',
            source: log.source,
            requestMethod: log.proxy?.method,
            requestPath: log.proxy?.path,
            responseStatusCode: log.proxy?.statusCode,
        });
    }

    if (logs.length === 0) {
        console.log('No new logs fetched');
        return { status: 'no_logs' };
    }

    // 4. Process logs & group into incidents
    await processLogs(latestVercelDeployment.uid, logs);

    // 5. Handle NEW incidents (OPEN and not yet NOTIFIED)
    const newIncidents = await db.incident.findMany({
        where: {
            status: 'OPEN',
            deploymentId: deployment.id,
        },
        include: {
            events: {
                orderBy: { timestampInMs: 'desc' },
                take: 10,
            },
        },
    });

    for (const incident of newIncidents) {
        // 6. Run Analysis
        const evidence = incident.events.map((e: { timestampInMs: number, message: string }) => `[${new Date(e.timestampInMs).toISOString()}] ${e.message}`);
        const analysis = await analyzeIncident(incident.errorSignature, evidence);

        // 7. Update incident with analysis
        const dbAnalysis = await db.analysis.findUnique({ where: { errorSignature: incident.errorSignature } });
        await db.incident.update({
            where: { id: incident.id },
            data: { analysisId: dbAnalysis?.id },
        });

        // 8. Generate Approval Token
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        await db.approval.create({
            data: {
                incidentId: incident.id,
                tokenHash,
                tokenExpiresAt: expiresAt,
                action: 'approve',
            },
        });

        // 9. Send Email
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const approveUrl = `${baseUrl}/api/approve?incidentId=${incident.id}&token=${token}`;
        const dismissUrl = `${baseUrl}/api/dismiss?incidentId=${incident.id}&token=${token}`;

        const emailHtml = `
      <h2>New Incident Detected</h2>
      <p><strong>Title:</strong> ${incident.title}</p>
      <p><strong>Path:</strong> ${incident.requestPath || 'N/A'}</p>
      <p><strong>Count:</strong> ${incident.eventCount}</p>
      <hr/>
      <h3>LLM Analysis</h3>
      <p><strong>Summary:</strong> ${analysis.summary}</p>
      <p><strong>Recommended Action:</strong> ${analysis.recommended_action}</p>
      <h4>Likely Causes:</h4>
      <ul>
        ${analysis.likely_causes.map(c => `<li><strong>${c.cause}</strong> (Confidence: ${c.confidence})<br/><em>Evidence: ${c.evidence}</em></li>`).join('')}
      </ul>
      <hr/>
      <div style="margin-top: 20px;">
        <a href="${approveUrl}" style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Approve Redeploy</a>
        <a href="${dismissUrl}" style="background-color: #666; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Dismiss</a>
      </div>
      <p style="margin-top: 20px;"><small>Signature: ${incident.errorSignature}</small></p>
    `;

        await sendEmail({
            to: process.env.NOTIFY_TO_EMAIL || '',
            subject: `[Incident] ${incident.title.slice(0, 50)}`,
            html: emailHtml,
        });

        // 10. Mark as NOTIFIED
        await db.incident.update({
            where: { id: incident.id },
            data: { status: 'NOTIFIED' },
        });
    }

    return { status: 'success', incidentsFound: newIncidents.length };
}
