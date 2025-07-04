require('dotenv').config();

console.log('🔍 TESTING OPENAI API KEY...\n');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not found in environment');
    console.log('📋 Available env vars:', Object.keys(process.env).filter(key => key.includes('OPENAI')));
} else {
    console.log('✅ OPENAI_API_KEY found');
    console.log('🔑 Key preview:', apiKey.substring(0, 20) + '...');
    console.log('📏 Key length:', apiKey.length);
    
    if (apiKey.startsWith('sk-')) {
        console.log('✅ Key format looks correct (starts with sk-)');
    } else {
        console.log('❌ Key format may be wrong (should start with sk-)');
    }
}

console.log('\n🎯 AI Parser should be:', apiKey ? 'LIVE MODE' : 'DEMO MODE'); 