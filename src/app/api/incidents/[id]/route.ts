import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const incident = await db.incident.findUnique({
            where: { id },
            include: {
                deployment: true,
                events: {
                    orderBy: { timestampInMs: 'desc' },
                    take: 50,
                },
                analysis: true,
            },
        });

        if (!incident) {
            return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
        }

        return NextResponse.json(incident);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
