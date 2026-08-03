import { db } from '@/lib/db';
import { triggerDeployHook } from '@/lib/vercel';
import { claimActionToken, failureMessage } from '@/lib/approval-token';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incidentId');
    const token = searchParams.get('token');

    if (!incidentId || !token) {
        return new Response('Missing parameters', { status: 400 });
    }

    const claim = await claimActionToken(db.approval, { incidentId, token, action: 'approve' });
    if (!claim.ok) {
        return new Response(failureMessage(claim.reason), { status: 403 });
    }

    await db.incident.update({
        where: { id: incidentId },
        data: { status: 'APPROVED_REDEPLOY' },
    });

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
