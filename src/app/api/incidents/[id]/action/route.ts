import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { triggerDeployHook } from '@/lib/vercel';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { action } = await request.json();
        const incidentId = params.id;

        if (action === 'redeploy') {
            const deployHookUrl = process.env.DEPLOY_HOOK_URL;
            if (!deployHookUrl) throw new Error('DEPLOY_HOOK_URL not configured');

            const triggered = await triggerDeployHook(deployHookUrl);
            if (triggered) {
                await db.incident.update({
                    where: { id: incidentId },
                    data: { status: 'REDEPLOY_TRIGGERED' },
                });
                return NextResponse.json({ success: true, status: 'REDEPLOY_TRIGGERED' });
            }
        } else if (action === 'dismiss') {
            await db.incident.update({
                where: { id: incidentId },
                data: { status: 'DISMISSED' },
            });
            return NextResponse.json({ success: true, status: 'DISMISSED' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
