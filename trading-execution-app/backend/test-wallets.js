const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const API_KEY = process.env.COINBASE_API_KEY;
const API_SECRET = process.env.COINBASE_API_SECRET;
const PASSPHRASE = process.env.COINBASE_PASSPHRASE;
const PORTFOLIO_ID = process.env.COINBASE_PORTFOLIO_ID;

function generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');
}

function testPortfolioWallets() {
    console.log('🔍 Testing Portfolio Wallets Endpoint (what the app uses)...');
    console.log(`📁 Portfolio ID: ${PORTFOLIO_ID}`);
    
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const requestPath = `/v1/portfolios/${PORTFOLIO_ID}/wallets`;
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
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('📊 Response Status:', res.statusCode);
            
            if (res.statusCode === 200) {
                const result = JSON.parse(data);
                console.log('✅ SUCCESS! Portfolio wallets data:');
                console.log(JSON.stringify(result, null, 2));
                
                const wallets = result.wallets || [];
                if (wallets.length === 0) {
                    console.log('⚠️  PORTFOLIO WALLETS ARE EMPTY!');
                    console.log('💡 This explains why the app shows $0.00');
                } else {
                    console.log(`💰 Found ${wallets.length} wallet(s) in this portfolio`);
                }
            } else {
                console.log('❌ Error Response:', data);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Request Error:', error);
    });

    req.end();
}

testPortfolioWallets(); 