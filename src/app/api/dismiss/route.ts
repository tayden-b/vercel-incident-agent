import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incidentId');
    const token = searchParams.get('token');

    if (!incidentId || !token) {
        return new Response('Missing parameters', { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const approval = await db.approval.findUnique({
        where: { tokenHash },
    });

    if (!approval || approval.incidentId !== incidentId) {
        return new Response('Invalid token', { status: 403 });
    }

    if (approval.usedAt || approval.tokenExpiresAt < new Date()) {
        return new Response('Token already used or expired', { status: 403 });
    }

    // Mark token as used
    await db.approval.update({
        where: { id: approval.id },
        data: { usedAt: new Date(), action: 'dismiss' },
    });

    // Update incident status
    await db.incident.update({
        where: { id: incidentId },
        data: { status: 'DISMISSED' },
    });

    return new Response('Incident successfully dismissed.');
}
