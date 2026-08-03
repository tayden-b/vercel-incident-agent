import { db } from '@/lib/db';
import { claimActionToken, failureMessage } from '@/lib/approval-token';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incidentId');
    const token = searchParams.get('token');

    if (!incidentId || !token) {
        return new Response('Missing parameters', { status: 400 });
    }

    const claim = await claimActionToken(db.approval, { incidentId, token, action: 'dismiss' });
    if (!claim.ok) {
        return new Response(failureMessage(claim.reason), { status: 403 });
    }

    await db.incident.update({
        where: { id: incidentId },
        data: { status: 'DISMISSED' },
    });

    return new Response('Incident successfully dismissed.');
}
