import { describe, it, expect } from 'vitest';
import { generateSignature, redactMessage } from './signature';

describe('generateSignature — incident de-dup key', () => {
    it('groups the same error seen twice', () => {
        const a = generateSignature('TypeError: cannot read x', '/api/checkout');
        const b = generateSignature('TypeError: cannot read x', '/api/checkout');
        expect(a).toBe(b);
    });

    it('separates a different error (different stack)', () => {
        const a = generateSignature('TypeError: cannot read x', '/api/checkout');
        const b = generateSignature('RangeError: index out of bounds', '/api/checkout');
        expect(a).not.toBe(b);
    });

    it('groups errors that differ only in a standalone numeric id', () => {
        // "failed for user 41" and "failed for user 8827" are the same incident.
        // Note: only digits with a word boundary on both sides collapse — a
        // number glued to letters (e.g. "1200ms") is left alone by design.
        const a = generateSignature('db write failed for user 41', '/api/save');
        const b = generateSignature('db write failed for user 8827', '/api/save');
        expect(a).toBe(b);
    });

    it('groups errors that differ only in a UUID', () => {
        const a = generateSignature('order 3f2504e0-4f89-41d3-9a0c-0305e82c3301 not found', '/api/order');
        const b = generateSignature('order 550e8400-e29b-41d4-a716-446655440000 not found', '/api/order');
        expect(a).toBe(b);
    });

    it('separates the same message on different paths', () => {
        const a = generateSignature('unauthorized', '/api/admin');
        const b = generateSignature('unauthorized', '/api/public');
        expect(a).not.toBe(b);
    });

    it('treats a null path and an empty-string path the same', () => {
        expect(generateSignature('boom', null)).toBe(generateSignature('boom', ''));
    });

    it('separates a real path from a null path', () => {
        expect(generateSignature('boom', '/api/x')).not.toBe(generateSignature('boom', null));
    });

    it('groups messages that share their first 500 chars', () => {
        // Only the tail past the 500-char cap differs, so they collapse together.
        const head = 'stack overflow: '.repeat(40); // > 500 chars
        const a = generateSignature(head + 'branch-A', '/api/x');
        const b = generateSignature(head + 'branch-B', '/api/x');
        expect(a).toBe(b);
    });

    it('returns a sha256 hex digest', () => {
        expect(generateSignature('boom', '/api/x')).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('redactMessage', () => {
    it('redacts email addresses', () => {
        const out = redactMessage('login failed for jane.doe@example.com');
        expect(out).toContain('[EMAIL]');
        expect(out).not.toContain('jane.doe@example.com');
    });

    it('redacts Bearer tokens', () => {
        const out = redactMessage('Authorization: Bearer abc123.def456-XYZ');
        expect(out).toContain('Bearer [REDACTED]');
        expect(out).not.toContain('abc123.def456-XYZ');
    });

    it('redacts key/value secrets', () => {
        const out = redactMessage('connect with password=hunter2supersecret');
        expect(out).toContain('[REDACTED]');
        expect(out).not.toContain('hunter2supersecret');
    });

    it('leaves an ordinary message untouched', () => {
        const msg = 'request timed out after 30s';
        expect(redactMessage(msg)).toBe(msg);
    });
});
