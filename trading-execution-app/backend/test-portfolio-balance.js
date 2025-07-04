const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const API_KEY = process.env.COINBASE_API_KEY;
const API_SECRET = process.env.COINBASE_API_SECRET;
const PASSPHRASE = process.env.COINBASE_PASSPHRASE;
const PORTFOLIO_ID = 'dc96ec0d-6853-4559-a30a-c9c76affa5b6';

function generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');
}

async function testEndpoint(path, description) {
    return new Promise((resolve) => {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const method = 'GET';
        const signature = generateSignature(timestamp, method, path);

        const options = {
            hostname: 'api.prime.coinbase.com',
            port: 443,
            path,
            method,
            headers: {
                'X-CB-ACCESS-KEY': API_KEY,
                'X-CB-ACCESS-SIGNATURE': signature,
                'X-CB-ACCESS-TIMESTAMP': timestamp,
                'X-CB-ACCESS-PASSPHRASE': PASSPHRASE,
                'Accept': 'application/json'
            }
        };

        console.log(`\n🔍 Testing: ${description}`);
        console.log(`📡 URL: https://${options.hostname}${path}`);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`📊 Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    console.log(`✅ SUCCESS: ${description}`);
                    try {
                        const parsed = JSON.parse(data);
                        console.log(`📄 Response:`, JSON.stringify(parsed, null, 2));
                    } catch (e) {
                        console.log(`📄 Raw Response: ${data}`);
                    }
                } else {
                    console.log(`❌ FAILED: ${data}`);
                }
                resolve({ status: res.statusCode, data });
            });
        });

        req.on('error', (e) => {
            console.log(`❌ ERROR: ${e.message}`);
            resolve({ status: 'ERROR', error: e.message });
        });

        req.end();
    });
}

async function testBalanceEndpoints() {
    console.log('🚀 TESTING COINBASE BALANCE ENDPOINTS...\n');
    
    const tests = [
        [`/v1/portfolios/${PORTFOLIO_ID}/wallets`, 'Portfolio Wallets'],
        [`/v1/portfolios/${PORTFOLIO_ID}/balances`, 'Portfolio Balances'],
        [`/v1/portfolios/${PORTFOLIO_ID}`, 'Portfolio Details'],
        [`/v1/entities/7823ac3e-fc41-4f7e-be83-619b37fb696a/balances`, 'Entity Balances'],
        [`/v1/wallets`, 'All Wallets'],
    ];

    for (const [path, description] of tests) {
        await testEndpoint(path, description);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

testBalanceEndpoints().catch(console.error); 