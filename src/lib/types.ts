// Shapes the client reads off the incidents API. The API serializes Prisma
// rows to JSON (BigInt timestamps become numbers via the toJSON override in
// db.ts), so these mirror the wire format, not the Prisma models.

export interface LikelyCause {
    cause: string;
    confidence: number;
    evidence: string;
}

export interface Analysis {
    id: string;
    summary: string;
    recommendedAction: string;
    likelyCausesJson: string;
    nextStepsJson: string;
}

export interface IncidentEvent {
    id: string;
    timestampInMs: number;
    level: string;
    message: string;
    source: string | null;
    requestMethod: string | null;
    requestPath: string | null;
    responseStatusCode: number | null;
}

export interface Deployment {
    id: string;
    vercelDeploymentId: string;
    target: string;
}

export interface Incident {
    id: string;
    title: string;
    status: string;
    severity: string;
    errorSignature: string;
    eventCount: number;
    requestPath: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    deployment?: Deployment;
    events?: IncidentEvent[];
    analysis?: Analysis | null;
}
