import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        const incidents = await db.incident.findMany({
            orderBy: { lastSeenAt: 'desc' },
            include: {
                deployment: true,
            },
        });
        return NextResponse.json(incidents);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
