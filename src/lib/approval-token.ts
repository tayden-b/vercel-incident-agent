import crypto from 'crypto';

// Token minting and redemption for the approve/dismiss links, kept out of the
// route handlers so it tests without the Prisma client. One token is issued per
// incident and spends on whichever link is clicked first.

export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type ClaimFailure = 'unknown_token' | 'wrong_incident' | 'expired' | 'already_used';

export type ClaimResult = { ok: true } | { ok: false; reason: ClaimFailure };

export interface ApprovalRow {
    id: string;
    incidentId: string;
    tokenExpiresAt: Date;
    usedAt: Date | null;
}

// The slice of the Prisma approval delegate this module needs. Narrowing it
// this way is what lets a test pass a fake in.
export interface ApprovalStore {
    findUnique(args: { where: { tokenHash: string } }): Promise<ApprovalRow | null>;
    updateMany(args: {
        where: { id: string; usedAt: null; tokenExpiresAt: { gt: Date } };
        data: { usedAt: Date; action: string };
    }): Promise<{ count: number }>;
}

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function mintActionToken(now: Date = new Date()) {
    const token = crypto.randomBytes(32).toString('hex');
    return {
        token,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    };
}

export function failureMessage(reason: ClaimFailure): string {
    switch (reason) {
        case 'expired':
            return 'This link has expired.';
        case 'already_used':
            return 'This link has already been used.';
        default:
            return 'Invalid token.';
    }
}

// Spends the token for `action` and reports why if it can't. The read is only
// there to explain the failure — the spend itself is a single conditional
// update, so two clicks racing each other can't both come back ok.
export async function claimActionToken(
    approvals: ApprovalStore,
    { incidentId, token, action, now = new Date() }: {
        incidentId: string;
        token: string;
        action: 'approve' | 'dismiss';
        now?: Date;
    },
): Promise<ClaimResult> {
    const approval = await approvals.findUnique({ where: { tokenHash: hashToken(token) } });

    if (!approval) return { ok: false, reason: 'unknown_token' };
    if (approval.incidentId !== incidentId) return { ok: false, reason: 'wrong_incident' };
    if (approval.usedAt) return { ok: false, reason: 'already_used' };
    if (approval.tokenExpiresAt <= now) return { ok: false, reason: 'expired' };

    const { count } = await approvals.updateMany({
        where: { id: approval.id, usedAt: null, tokenExpiresAt: { gt: now } },
        data: { usedAt: now, action },
    });

    return count === 1 ? { ok: true } : { ok: false, reason: 'already_used' };
}
