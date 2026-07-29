import { AnalysisResult } from './llm';

export interface SlackAlertInput {
    title: string;
    requestPath: string | null;
    eventCount: number;
    errorSignature: string;
    analysis: AnalysisResult;
    approveUrl: string;
    dismissUrl: string;
}

// Builds the Block Kit payload. Pure and network-free so it can be asserted
// against a fixture in tests without hitting Slack.
export function buildSlackMessage(input: SlackAlertInput) {
    const { title, requestPath, eventCount, errorSignature, analysis, approveUrl, dismissUrl } = input;

    const causes = analysis.likely_causes
        .map((c) => `• *${c.cause}* (confidence ${c.confidence})\n  _${c.evidence}_`)
        .join('\n');

    return {
        // Plain-text fallback used for notifications and screen readers.
        text: `New incident: ${title}`,
        blocks: [
            { type: 'header', text: { type: 'plain_text', text: `New incident: ${title.slice(0, 140)}` } },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Path:*\n${requestPath || 'N/A'}` },
                    { type: 'mrkdwn', text: `*Count:*\n${eventCount}` },
                ],
            },
            { type: 'section', text: { type: 'mrkdwn', text: `*Summary:*\n${analysis.summary}` } },
            { type: 'section', text: { type: 'mrkdwn', text: `*Recommended action:* ${analysis.recommended_action}` } },
            ...(causes ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Likely causes:*\n${causes}` } }] : []),
            {
                type: 'actions',
                elements: [
                    { type: 'button', text: { type: 'plain_text', text: 'Approve redeploy' }, url: approveUrl, style: 'primary' },
                    { type: 'button', text: { type: 'plain_text', text: 'Dismiss' }, url: dismissUrl },
                ],
            },
            { type: 'context', elements: [{ type: 'mrkdwn', text: `Signature: \`${errorSignature}\`` }] },
        ],
    };
}

export async function sendSlackAlert(input: SlackAlertInput) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const message = buildSlackMessage(input);

    if (!webhookUrl) {
        console.warn('SLACK_WEBHOOK_URL missing. LOGGING SLACK MESSAGE TO CONSOLE INSTEAD:');
        console.log(JSON.stringify(message, null, 2));
        return;
    }

    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Slack webhook returned ${res.status}: ${body}`);
    }
}
