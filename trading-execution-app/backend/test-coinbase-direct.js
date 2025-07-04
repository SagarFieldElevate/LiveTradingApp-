const crypto = require('crypto');
const https = require('https');

// Load environment variables
require('dotenv').config();

const API_KEY = process.env.COINBASE_API_KEY;
const API_SECRET = process.env.COINBASE_API_SECRET;
const PASSPHRASE = process.env.COINBASE_PASSPHRASE;

function generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    // Use secret as plain string, not base64 decoded (matching working Python code)
    return crypto.createHmac('sha256', API_SECRET)
        .update(message)
        .digest('base64');
}

function testCoinbaseAuth() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const requestPath = '/v1/portfolios';
    const signature = generateSignature(timestamp, method, requestPath);

    const options = {
        hostname: 'api.prime.coinbase.com',
        port: 443,
        path: requestPath,
        method: method,
        headers: {
            'X-CB-ACCESS-KEY': API_KEY,
            'X-CB-ACCESS-SIGNATURE': signature,
            'X-CB-ACCESS-TIMESTAMP': timestamp,
            'X-CB-ACCESS-PASSPHRASE': PASSPHRASE,
            'Accept': 'application/json'
        }
    };

    console.log('🔍 Testing Coinbase Prime API Authentication...');
    console.log('📡 Endpoint:', `https://${options.hostname}${options.path}`);
    console.log('🔑 API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'MISSING');
    console.log('🔐 Secret:', API_SECRET ? 'PROVIDED' : 'MISSING');
    console.log('🔒 Passphrase:', PASSPHRASE ? 'PROVIDED' : 'MISSING');
    console.log('⏰ Timestamp:', timestamp);
    console.log('✍️  Signature:', signature.substring(0, 20) + '...');

    const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('\n📊 Response Status:', res.statusCode);
            console.log('📋 Response Headers:', JSON.stringify(res.headers, null, 2));
            console.log('📄 Response Body:', data);
            
            if (res.statusCode === 200) {
                console.log('\n✅ SUCCESS: Coinbase Prime API authentication works!');
            } else if (res.statusCode === 401) {
                console.log('\n❌ FAILED: Invalid API credentials');
                console.log('💡 Check your Coinbase Prime API keys and permissions');
            } else {
                console.log(`\n⚠️  Unexpected status: ${res.statusCode}`);
            }
        });
    });

    req.on('error', (e) => {
        console.error('❌ Request error:', e.message);
    });

    req.end();
}

// Run the test
testCoinbaseAuth(); 