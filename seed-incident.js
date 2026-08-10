const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const deploymentId = 'dpl_mock_123';

    const deployment = await prisma.deployment.upsert({
        where: { vercelDeploymentId: deploymentId },
        update: {},
        create: {
            vercelDeploymentId: deploymentId,
            target: 'production'
        }
    });

    console.log('Cleaning up old data...');
    // Delete in order to avoid FK constraints
    await prisma.incidentEvent.deleteMany({});
    await prisma.approval.deleteMany({});
    await prisma.incident.deleteMany({});
    await prisma.analysis.deleteMany({});

    const analysis = await prisma.analysis.create({
        data: {
            errorSignature: 'API_TIMEOUT_504',
            summary: 'The application is experiencing 504 Gateway Timeouts on the /api/users endpoint. This suggests the upstream database or service is failing to respond within the allowed time limit.',
            likelyCausesJson: JSON.stringify([
                { cause: 'Database Connection Pool Exhausted', confidence: 0.9, evidence: 'Consistent 504s with "upstream request timeout" messages' },
                { cause: 'Slow Query Performance', confidence: 0.7, evidence: 'Timing matches default 30s timeout' },
                { cause: 'Vercel Function Cold Start', confidence: 0.3, evidence: 'Only happening on initial requests' }
            ]),
            recommendedAction: 'redeploy',
            nextStepsJson: JSON.stringify([
                'Check Supabase connection pooling settings',
                'Review recent query performance changes',
                'Approve the redeploy to revert to the previous stable build'
            ]),
            modelUsed: 'gpt-4o-mini'
        }
    });

    await prisma.incident.create({
        data: {
            errorSignature: 'API_TIMEOUT_504',
            title: 'API Timeout (504) on /api/users',
            status: 'NOTIFIED',
            severity: 'P1',
            deploymentId: deployment.id,
            requestPath: '/api/users',
            eventCount: 15,
            analysisId: analysis.id,
            events: {
                create: [
                    {
                        rowId: 'row_1',
                        timestampInMs: BigInt(Date.now()),
                        level: 'error',
                        message: 'upstream request timeout',
                        responseStatusCode: 504
                    },
                    {
                        rowId: 'row_2',
                        timestampInMs: BigInt(Date.now() - 1000),
                        level: 'error',
                        message: 'Connection timed out after 30000ms',
                        responseStatusCode: 504
                    }
                ]
            }
        }
    });

    // Two more incidents so the dashboard has a realistic spread of severity and
    // status — this is the fixture behind the README screenshots.
    const extras = [
        {
            errorSignature: 'CHECKOUT_TYPEERROR',
            title: "TypeError: Cannot read properties of undefined (reading 'total')",
            status: 'OPEN',
            severity: 'P0',
            requestPath: '/api/checkout',
            eventCount: 41,
            summary: 'Checkout requests are throwing an unhandled TypeError when the cart payload arrives without a totals object. Every request on this path 500s, so checkout is fully down.',
            likelyCauses: [
                { cause: 'Cart payload shape changed', confidence: 0.85, evidence: 'Errors start at the deploy timestamp, all on /api/checkout' },
                { cause: 'Missing null guard on cart.totals', confidence: 0.6, evidence: 'Stack trace points at the totals destructure' }
            ],
            recommendedAction: 'redeploy',
            nextSteps: [
                'Roll back to the previous build to stop the bleeding',
                'Add a guard for carts without a totals object',
                'Backfill a test for the empty-cart case'
            ],
            events: [
                { message: "TypeError: Cannot read properties of undefined (reading 'total')", statusCode: 500 },
                { message: 'at calculateOrderTotal (/var/task/.next/server/app/api/checkout/route.js:88:31)', statusCode: 500 }
            ]
        },
        {
            errorSignature: 'IMAGE_OPT_429',
            title: 'Image optimization returning 429',
            status: 'DISMISSED',
            severity: 'P2',
            requestPath: '/_next/image',
            eventCount: 6,
            summary: 'The image optimizer is rate limiting on a burst of first-time thumbnail requests. It recovers on its own once the cache fills.',
            likelyCauses: [
                { cause: 'Cold image cache after deploy', confidence: 0.8, evidence: 'Burst of 429s in the first two minutes, then nothing' }
            ],
            recommendedAction: 'monitor',
            nextSteps: ['No action — expected after a deploy with new assets'],
            events: [
                { message: 'Image optimization rate limit exceeded', statusCode: 429 }
            ]
        }
    ];

    for (const extra of extras) {
        const extraAnalysis = await prisma.analysis.create({
            data: {
                errorSignature: extra.errorSignature,
                summary: extra.summary,
                likelyCausesJson: JSON.stringify(extra.likelyCauses),
                recommendedAction: extra.recommendedAction,
                nextStepsJson: JSON.stringify(extra.nextSteps),
                modelUsed: 'gpt-4o-mini'
            }
        });

        await prisma.incident.create({
            data: {
                errorSignature: extra.errorSignature,
                title: extra.title,
                status: extra.status,
                severity: extra.severity,
                deploymentId: deployment.id,
                requestPath: extra.requestPath,
                eventCount: extra.eventCount,
                analysisId: extraAnalysis.id,
                events: {
                    create: extra.events.map((event, i) => ({
                        rowId: `${extra.errorSignature.toLowerCase()}_${i}`,
                        timestampInMs: BigInt(Date.now() - i * 1000),
                        level: 'error',
                        message: event.message,
                        requestPath: extra.requestPath,
                        responseStatusCode: event.statusCode
                    }))
                }
            }
        });
    }

    console.log('Seeding complete');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
