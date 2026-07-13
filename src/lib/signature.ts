import crypto from 'crypto';

// The de-dup logic lives here, apart from incident.ts, so it can be tested
// without pulling in the Prisma client that incident.ts imports.

export function generateSignature(message: string, path: string | null): string {
    // Normalize the message so two occurrences of the same error group together
    // even when they carry different ids: collapse UUIDs and bare numbers, then
    // cap the length so a runaway stack trace can't split one error into many.
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
