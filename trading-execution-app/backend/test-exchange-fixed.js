const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const API_KEY = process.env.COINBASE_API_KEY;
const API_SECRET = process.env.COINBASE_API_SECRET;
const PASSPHRASE = process.env.COINBASE_PASSPHRASE;

function generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto.createHmac('sha256', Buffer.from(API_SECRET, 'base64'))
        .update(message)
        .digest('base64');
}

function testExchangeAPI() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const requestPath = '/accounts';
    const signature = generateSignature(timestamp, method, requestPath);

    const options = {
        hostname: 'api.exchange.coinbase.com',
        port: 443,
        path: requestPath,
        method: method,
        headers: {
            'CB-ACCESS-KEY': API_KEY,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp,
            'CB-ACCESS-PASSPHRASE': PASSPHRASE,
            'Accept': 'application/json',
            'User-Agent': 'TradingApp/1.0'
        }
    };

    console.log('🔍 Testing Coinbase Exchange API with User-Agent...');
    console.log(`📡 URL: https://${options.hostname}${options.path}`);
    console.log('🔑 Headers:', Object.keys(options.headers).join(', '));

    const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('\n📊 Response Status:', res.statusCode);
            console.log('📄 Response Body:', data);
            
            if (res.statusCode === 200) {
                console.log('\n✅ SUCCESS: Exchange API works!');
                try {
                    const parsed = JSON.parse(data);
                    console.log('📋 Accounts found:', parsed.length);
                } catch (e) {
                    console.log('📋 Raw response received');
                }
            } else if (res.statusCode === 401) {
                console.log('\n❌ STILL FAILED: Invalid API credentials for Exchange');
            } else {
                console.log(`\n⚠️  Status ${res.statusCode}: ${data}`);
            }
        });
    });

    req.on('error', (e) => {
        console.error('❌ Request error:', e.message);
    });

    req.end();
}

testExchangeAPI(); 