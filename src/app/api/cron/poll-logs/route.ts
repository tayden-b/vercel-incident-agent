import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';

export async function GET(request: Request) {
    // Optional: Verify Vercel Cron header
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new Response('Unauthorized', { status: 401 });
    // }

    try {
        const result = await runAgent();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
