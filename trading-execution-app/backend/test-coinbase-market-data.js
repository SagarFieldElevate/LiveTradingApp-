const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const API_KEY = process.env.COINBASE_API_KEY;
const API_SECRET = process.env.COINBASE_API_SECRET;
const PASSPHRASE = process.env.COINBASE_PASSPHRASE;

function generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');
}

function testEndpoint(path, description) {
    return new Promise((resolve) => {
        console.log(`\n🔍 Testing: ${description}`);
        
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const method = 'GET';
        const signature = generateSignature(timestamp, method, path);

        const options = {
            hostname: 'api.prime.coinbase.com',
            port: 443,
            path: path,
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
                console.log(`📊 ${path}: Status ${res.statusCode}`);
                
                if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(data);
                        console.log(`✅ SUCCESS! Sample data:`);
                        
                        // Show sample of the data
                        if (result.products && result.products.length > 0) {
                            console.log(`   📈 Found ${result.products.length} products`);
                            console.log(`   🔸 Example: ${result.products[0].product_id} - $${result.products[0].price || 'N/A'}`);
                        } else if (result.price) {
                            console.log(`   💰 Price: $${result.price}`);
                        } else {
                            console.log(`   📄 Data keys:`, Object.keys(result).slice(0, 5));
                        }
                    } catch (e) {
                        console.log(`   📄 Raw response: ${data.substring(0, 200)}...`);
                    }
                } else {
                    console.log(`❌ Error: ${data}`);
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.error(`❌ Request Error: ${error.message}`);
            resolve();
        });

        req.end();
    });
}

async function testCoinbaseMarketData() {
    console.log('🚀 TESTING COINBASE PRIME MARKET DATA ENDPOINTS...\n');
    
    const endpoints = [
        ['/v1/products', 'All Available Products'],
        ['/v1/products/BTC-USD', 'Bitcoin Price'],
        ['/v1/products/ETH-USD', 'Ethereum Price'],
        ['/v1/products/DOGE-USD', 'Dogecoin Price'],
        ['/v1/products/BTC-USD/ticker', 'Bitcoin Ticker'],
        ['/v1/products/BTC-USD/stats', 'Bitcoin 24hr Stats'],
        ['/v1/products/BTC-USD/candles', 'Bitcoin Candles'],
        ['/v1/market/best-bid-ask', 'Best Bid/Ask'],
        ['/v1/market/ticker', 'Market Ticker'],
    ];
    
    for (const [path, desc] of endpoints) {
        await testEndpoint(path, desc);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }
    
    console.log('\n🎯 CONCLUSION:');
    console.log('These endpoints that work can replace Polygon for crypto market data!');
}

testCoinbaseMarketData(); 