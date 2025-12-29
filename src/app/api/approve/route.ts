import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { triggerDeployHook } from '@/lib/vercel';
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
        include: { incident: true },
    });

    if (!approval || approval.incidentId !== incidentId || approval.action !== 'approve') {
        return new Response('Invalid or expired token', { status: 403 });
    }

    if (approval.usedAt || approval.tokenExpiresAt < new Date()) {
        return new Response('Token already used or expired', { status: 403 });
    }

    // Mark token as used
    await db.approval.update({
        where: { id: approval.id },
        data: { usedAt: new Date() },
    });

    // Update incident status
    await db.incident.update({
        where: { id: incidentId },
        data: { status: 'APPROVED_REDEPLOY' },
    });

    // Trigger Redeploy
    const deployHookUrl = process.env.DEPLOY_HOOK_URL;
    if (!deployHookUrl) {
        return new Response('DEPLOY_HOOK_URL not configured', { status: 500 });
    }

    const triggered = await triggerDeployHook(deployHookUrl);

    if (triggered) {
        await db.incident.update({
            where: { id: incidentId },
            data: { status: 'REDEPLOY_TRIGGERED' },
        });
        return new Response('Redeploy successfully triggered!');
    } else {
        return new Response('Failed to trigger redeploy via hook', { status: 500 });
    }
}
