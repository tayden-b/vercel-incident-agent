const { createClient } = require('@libsql/client');
const path = require('path');

const url = `file:${path.join(process.cwd(), 'dev.db')}`;
console.log('Testing with URL:', url);

try {
    const client = createClient({ url });
    console.log('Client created successfully');
    client.execute('SELECT 1').then(res => {
        console.log('Query result:', res);
        process.exit(0);
    }).catch(err => {
        console.error('Query failed:', err);
        process.exit(1);
    });
} catch (e) {
    console.error('Creation failed:', e);
    process.exit(1);
}
