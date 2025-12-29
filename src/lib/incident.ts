import { db } from './db';
import crypto from 'crypto';

export function generateSignature(message: string, path: string | null): string {
    // Normalize message by removing variable parts like IDs or timestamps if possible
    // For now, simple hash of message + path
    const normalizedMessage = message.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, '{uuid}')
        .replace(/\b\d+\b/g, '{n}')
        .slice(0, 500);

    const content = `${normalizedMessage}|${path || ''}`;
    return crypto.createHash('sha256').update(content).digest('hex');
}

export function redactMessage(message: string): string {
    let redacted = message;
    // Redact potential emails
    redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    // Redact potential Bearer tokens or Auth headers
    redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9-._~+/]+=*/g, 'Bearer [REDACTED]');
    // Redact potential API keys (simple heuristic)
    redacted = redacted.replace(/(?:key|token|secret|password|auth|pwd)[=\s:]+([a-zA-Z0-9\-_]{8,})/gi, (match, p1) => match.replace(p1, '[REDACTED]'));

    return redacted;
}

export interface ProcessedLog {
    rowId: string;
    timestampInMs: number;
    level: string;
    message: string;
    source?: string;
    requestMethod?: string;
    requestPath?: string;
    responseStatusCode?: number;
}


export async function processLogs(deploymentId: string, logs: ProcessedLog[]) {
    const deployment = await db.deployment.findUnique({
        where: { vercelDeploymentId: deploymentId },
    });

    if (!deployment) throw new Error(`Deployment ${deploymentId} not found in DB`);

    const lastProcessedTimestamp = deployment.lastProcessedTimestampInMs || 0;

    // Filter new logs only
    const newLogs = logs.filter(log => log.timestampInMs > lastProcessedTimestamp);

    if (newLogs.length === 0) return;

    // Track latest timestamp
    const latestTimestamp = Math.max(...newLogs.map(l => l.timestampInMs));

    // Identify error candidates
    const errorLogs = newLogs.filter(log =>
        log.level === 'error' ||
        (log.responseStatusCode && log.responseStatusCode >= 500) ||
        /error|failed|exception/i.test(log.message)
    );

    for (const log of errorLogs) {
        const signature = generateSignature(log.message, log.requestPath || null);
        const redactedMsg = redactMessage(log.message);

        // Find if an OPEN incident exists with same signature and seen in the last 30 mins
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

        const incident = await db.incident.findFirst({
            where: {
                errorSignature: signature,
                status: 'OPEN',
                lastSeenAt: { gte: thirtyMinsAgo },
            },
        });

        if (incident) {
            // Append to existing incident
            await db.$transaction([
                db.incident.update({
                    where: { id: incident.id },
                    data: {
                        eventCount: { increment: 1 },
                        lastSeenAt: new Date(log.timestampInMs),
                    },
                }),
                db.incidentEvent.create({
                    data: {
                        incidentId: incident.id,
                        rowId: log.rowId,
                        timestampInMs: log.timestampInMs,
                        level: log.level,
                        source: log.source,
                        message: redactedMsg,
                        requestMethod: log.requestMethod,
                        requestPath: log.requestPath,
                        responseStatusCode: log.responseStatusCode,
                    },
                }),
            ]);
        } else {
            // Create new incident
            await db.incident.create({
                data: {
                    errorSignature: signature,
                    title: log.message.slice(0, 100),
                    deploymentId: deployment.id,
                    requestPath: log.requestPath,
                    firstSeenAt: new Date(log.timestampInMs),
                    lastSeenAt: new Date(log.timestampInMs),
                    eventCount: 1,
                    events: {
                        create: {
                            rowId: log.rowId,
                            timestampInMs: log.timestampInMs,
                            level: log.level,
                            source: log.source,
                            message: redactedMsg,
                            requestMethod: log.requestMethod,
                            requestPath: log.requestPath,
                            responseStatusCode: log.responseStatusCode,
                        },
                    },
                },
            });
        }
    }

    // Update deployment last processed timestamp
    await db.deployment.update({
        where: { id: deployment.id },
        data: {
            lastProcessedTimestampInMs: latestTimestamp,
            lastPolledAt: new Date(),
        },
    });
}
