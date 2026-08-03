import { describe, it, expect } from 'vitest';
import { claimActionToken, hashToken, mintActionToken, ApprovalRow, TOKEN_TTL_MS } from './approval-token';

const NOW = new Date('2026-07-01T12:00:00Z');

// Stands in for the Prisma approval delegate. updateMany applies the same
// where-clause the real one would, so the single-use guarantee is what's under
// test rather than the fake being polite about it.
class FakeApprovals {
    rows: ApprovalRow[] = [];

    seed(row: Partial<ApprovalRow> & { tokenHash: string }) {
        const full = {
            id: 'ap_1',
            incidentId: 'inc_1',
            tokenExpiresAt: new Date(NOW.getTime() + TOKEN_TTL_MS),
            usedAt: null,
            ...row,
        };
        this.rows.push(full);
        this.hashes.set(full.id, row.tokenHash);
        return full;
    }

    private hashes = new Map<string, string>();

    async findUnique({ where }: { where: { tokenHash: string } }) {
        const id = [...this.hashes.entries()].find(([, h]) => h === where.tokenHash)?.[0];
        return this.rows.find((r) => r.id === id) ?? null;
    }

    async updateMany({ where, data }: {
        where: { id: string; usedAt: null; tokenExpiresAt: { gt: Date } };
        data: { usedAt: Date; action: string };
    }) {
        const row = this.rows.find(
            (r) => r.id === where.id && r.usedAt === null && r.tokenExpiresAt > where.tokenExpiresAt.gt,
        );
        if (!row) return { count: 0 };
        row.usedAt = data.usedAt;
        return { count: 1 };
    }
}

describe('claimActionToken', () => {
    it('spends a valid token', async () => {
        const approvals = new FakeApprovals();
        const { token, tokenHash } = mintActionToken(NOW);
        approvals.seed({ tokenHash });

        const result = await claimActionToken(approvals, {
            incidentId: 'inc_1', token, action: 'approve', now: NOW,
        });
        expect(result.ok).toBe(true);
    });

    it('rejects a replayed token', async () => {
        const approvals = new FakeApprovals();
        const { token, tokenHash } = mintActionToken(NOW);
        approvals.seed({ tokenHash });

        const first = await claimActionToken(approvals, {
            incidentId: 'inc_1', token, action: 'approve', now: NOW,
        });
        const replay = await claimActionToken(approvals, {
            incidentId: 'inc_1', token, action: 'approve', now: NOW,
        });

        expect(first.ok).toBe(true);
        expect(replay).toEqual({ ok: false, reason: 'already_used' });
    });

    it('only lets one of two simultaneous clicks win', async () => {
        // Both reads land before either write, so the conditional update is the
        // only thing standing between one click and two redeploys.
        const approvals = new FakeApprovals();
        const { token, tokenHash } = mintActionToken(NOW);
        approvals.seed({ tokenHash });

        const results = await Promise.all([
            claimActionToken(approvals, { incidentId: 'inc_1', token, action: 'approve', now: NOW }),
            claimActionToken(approvals, { incidentId: 'inc_1', token, action: 'dismiss', now: NOW }),
        ]);

        expect(results.filter((r) => r.ok)).toHaveLength(1);
    });

    it('rejects a token past its expiry', async () => {
        const approvals = new FakeApprovals();
        const { token, tokenHash } = mintActionToken(NOW);
        approvals.seed({ tokenHash });

        const result = await claimActionToken(approvals, {
            incidentId: 'inc_1',
            token,
            action: 'approve',
            now: new Date(NOW.getTime() + TOKEN_TTL_MS + 1000),
        });
        expect(result).toEqual({ ok: false, reason: 'expired' });
    });

    it("rejects a valid token pointed at someone else's incident", async () => {
        const approvals = new FakeApprovals();
        const { token, tokenHash } = mintActionToken(NOW);
        approvals.seed({ tokenHash, incidentId: 'inc_1' });

        const result = await claimActionToken(approvals, {
            incidentId: 'inc_2', token, action: 'approve', now: NOW,
        });
        expect(result).toEqual({ ok: false, reason: 'wrong_incident' });
    });

    it('rejects a token it never issued', async () => {
        const approvals = new FakeApprovals();
        approvals.seed({ tokenHash: mintActionToken(NOW).tokenHash });

        const result = await claimActionToken(approvals, {
            incidentId: 'inc_1', token: 'made-up', action: 'approve', now: NOW,
        });
        expect(result).toEqual({ ok: false, reason: 'unknown_token' });
    });
});

describe('mintActionToken', () => {
    it('stores a hash, not the token', () => {
        const { token, tokenHash } = mintActionToken(NOW);
        expect(tokenHash).not.toBe(token);
        expect(tokenHash).toBe(hashToken(token));
    });

    it('expires the token one TTL out', () => {
        const { expiresAt } = mintActionToken(NOW);
        expect(expiresAt.getTime() - NOW.getTime()).toBe(TOKEN_TTL_MS);
    });
});
