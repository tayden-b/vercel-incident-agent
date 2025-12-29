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

    console.log('Seeding complete');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
