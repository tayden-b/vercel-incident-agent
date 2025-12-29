import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';

export async function POST() {
    try {
        const result = await runAgent();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Manual poll failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
