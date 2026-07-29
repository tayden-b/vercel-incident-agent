import { describe, it, expect } from 'vitest';
import { buildSlackMessage, SlackAlertInput } from './slack';

const baseInput: SlackAlertInput = {
    title: 'TypeError: cannot read properties of undefined',
    requestPath: '/api/checkout',
    eventCount: 12,
    errorSignature: 'abc123',
    analysis: {
        summary: 'Checkout handler throws on missing cart.',
        likely_causes: [{ cause: 'Null cart', confidence: 0.8, evidence: 'cart is undefined' }],
        recommended_action: 'investigate',
        next_steps: ['check cart init'],
        risk_notes: [],
    },
    approveUrl: 'https://app.example.com/api/approve?incidentId=1&token=t',
    dismissUrl: 'https://app.example.com/api/dismiss?incidentId=1&token=t',
};

describe('buildSlackMessage', () => {
    it('sets a plain-text fallback with the incident title', () => {
        const msg = buildSlackMessage(baseInput);
        expect(msg.text).toContain(baseInput.title);
    });

    it('puts the approve and dismiss URLs on the action buttons', () => {
        const msg = buildSlackMessage(baseInput);
        const actions = msg.blocks.find((b) => b.type === 'actions') as { elements: Array<{ url?: string }> };
        const urls = actions.elements.map((e) => e.url);
        expect(urls).toContain(baseInput.approveUrl);
        expect(urls).toContain(baseInput.dismissUrl);
    });

    it('renders each likely cause', () => {
        const msg = buildSlackMessage(baseInput);
        const rendered = JSON.stringify(msg);
        expect(rendered).toContain('Null cart');
        expect(rendered).toContain('cart is undefined');
    });

    it('omits the causes section when there are none', () => {
        const msg = buildSlackMessage({ ...baseInput, analysis: { ...baseInput.analysis, likely_causes: [] } });
        expect(JSON.stringify(msg)).not.toContain('Likely causes');
    });

    it('truncates a very long title in the header but keeps it in the fallback', () => {
        const longTitle = 'E'.repeat(300);
        const msg = buildSlackMessage({ ...baseInput, title: longTitle });
        const header = msg.blocks.find((b) => b.type === 'header') as { text: { text: string } };
        expect(header.text.text.length).toBeLessThan(longTitle.length);
        expect(msg.text).toContain(longTitle);
    });
});
