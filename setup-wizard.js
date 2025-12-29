const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const envPath = path.join(__dirname, '.env');

console.log('\n🔮 Vercel Incident Agent - Configuration Wizard 🔮\n');
console.log('I will help you set up your environment variables.');
console.log('Press enter to skip any value you don\'t have right now.\n');

const questions = [
    { key: 'VERCEL_TOKEN', query: '1. Paste your Vercel Token (Account Settings > Tokens): ' },
    { key: 'VERCEL_PROJECT_ID', query: '2. Paste your Vercel Project ID (Project Settings > General): ' },
    { key: 'LLM_API_KEY', query: '3. Paste your OpenAI API Key (sk-...): ' },
    { key: 'GMAIL_SENDER_EMAIL', query: '4. (Optional) Your Gmail Address for notifications: ' }
];

const newValues = {};

const ask = (index) => {
    if (index >= questions.length) {
        saveEnv();
        return;
    }

    rl.question(questions[index].query, (answer) => {
        if (answer.trim()) {
            newValues[questions[index].key] = answer.trim();
            // Special handling for Project ID to set the public one too
            if (questions[index].key === 'VERCEL_PROJECT_ID') {
                newValues['NEXT_PUBLIC_VERCEL_PROJECT_ID'] = answer.trim();
            }
        }
        ask(index + 1);
    });
};

const saveEnv = () => {
    let envContent = '';
    try {
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
    } catch (e) {
        // If file doesn't exist or error reading, we start fresh-ish
    }

    // Loop through new values and explicitly replace or append
    for (const [key, value] of Object.entries(newValues)) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (envContent.match(regex)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    }

    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ .env file updated successfully!');
    console.log('You are ready to test! Restart the server with: npm run dev -- -p 3001');
    rl.close();
};

ask(0);
