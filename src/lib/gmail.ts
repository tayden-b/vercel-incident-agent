import { google } from 'googleapis';

export interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: Omit<EmailOptions, 'text'>) {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const senderEmail = process.env.GMAIL_SENDER_EMAIL;

    if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
        console.warn('Gmail credentials missing. LOGGING EMAIL TO CONSOLE INSTEAD:');
        console.log('--- EMAIL START ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(html);
        console.log('--- EMAIL END ---');
        return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
        `From: Vercel Incident Agent <${senderEmail}>`,
        `To: ${to}`,
        `Content-Type: text/html; charset=utf-8`,
        `MIME-Version: 1.0`,
        `Subject: ${utf8Subject}`,
        '',
        html,
    ];
    const message = messageParts.join('\n');

    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    try {
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });
    } catch (error) {
        console.error('Failed to send email via Gmail API:', error);
        throw error;
    }
}
