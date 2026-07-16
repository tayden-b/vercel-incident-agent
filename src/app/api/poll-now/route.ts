import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';

export async function POST() {
    try {
        const result = await runAgent();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Manual poll failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
