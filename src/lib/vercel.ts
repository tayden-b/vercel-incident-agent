export interface VercelDeployment {
    uid: string;
    name: string;
    url: string;
    created: number;
    state: string;
    target?: string;
}

export interface VercelLogEvent {
    id?: string;
    rowId?: string;
    message: string;
    timestamp?: number;
    timestampInMs?: number;
    level: 'error' | 'warn' | 'info' | 'debug';
    source?: string;
    proxy?: {
        method: string;
        path: string;
        statusCode: number;
    };
}

const VERCEL_API_URL = 'https://api.vercel.com';

async function vercelFetch(path: string, options: RequestInit = {}) {
    const token = process.env.VERCEL_TOKEN;
    if (!token) throw new Error('VERCEL_TOKEN is not set');

    const url = new URL(path, VERCEL_API_URL);
    const teamId = process.env.VERCEL_TEAM_ID;
    const teamSlug = process.env.VERCEL_TEAM_SLUG;

    if (teamId) url.searchParams.set('teamId', teamId);
    else if (teamSlug) url.searchParams.set('slug', teamSlug);

    const response = await fetch(url.toString(), {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vercel API error (${response.status}): ${errorBody}`);
    }

    return response;
}

export async function getLatestDeployment(projectId: string): Promise<VercelDeployment | null> {
    const response = await vercelFetch(`/v6/deployments?projectId=${projectId}&target=production&state=READY&limit=1`);
    const data = await response.json();
    return data.deployments?.[0] || null;
}

export async function* getLogsStream(deploymentId: string, options: { maxDurationMs?: number, maxEvents?: number } = {}): AsyncGenerator<VercelLogEvent> {
    const { maxDurationMs = 2000, maxEvents = 300 } = options;
    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!projectId) throw new Error('VERCEL_PROJECT_ID is not set');

    const url = `/v1/projects/${projectId}/deployments/${deploymentId}/runtime-logs`;
    const response = await vercelFetch(url);

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventCount = 0;
    const startTime = Date.now();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    yield event;
                    eventCount++;
                } catch (e) {
                    console.error('Error parsing NDJSON line:', e);
                }

                if (eventCount >= maxEvents) break;
            }

            if (eventCount >= maxEvents || (Date.now() - startTime) > maxDurationMs) {
                break;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export async function triggerDeployHook(url: string): Promise<boolean> {
    const response = await fetch(url, { method: 'POST' });
    return response.ok;
}
