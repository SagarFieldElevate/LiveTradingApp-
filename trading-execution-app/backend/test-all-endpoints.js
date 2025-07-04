const crypto = require('crypto');
const https = require('https');
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

async function testEndpoint(hostname, path, description) {
    return new Promise((resolve) => {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const method = 'GET';
        const signature = generateSignature(timestamp, method, path);

        const options = {
            hostname,
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
        console.log(`📡 URL: https://${hostname}${path}`);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const status = res.statusCode;
                console.log(`📊 Status: ${status}`);
                
                if (status === 200) {
                    console.log(`✅ SUCCESS: ${description}`);
                    console.log(`📄 Response: ${data.substring(0, 200)}...`);
                } else if (status === 401) {
                    console.log(`❌ FAIL: Invalid credentials for ${description}`);
                } else if (status === 404) {
                    console.log(`❌ FAIL: Endpoint not found for ${description}`);
                } else {
                    console.log(`⚠️  Status ${status}: ${data}`);
                }
                resolve({ status, data, description });
            });
        });

        req.on('error', (e) => {
            console.log(`❌ ERROR: ${e.message}`);
            resolve({ status: 'ERROR', error: e.message, description });
        });

        req.setTimeout(5000, () => {
            console.log(`⏰ TIMEOUT: ${description}`);
            resolve({ status: 'TIMEOUT', description });
        });

        req.end();
    });
}

async function runAllTests() {
    console.log('🚀 TESTING ALL POSSIBLE COINBASE ENDPOINTS...\n');
    
    const tests = [
        // Prime API endpoints
        ['api.prime.coinbase.com', '/v1/portfolios', 'Prime: List Portfolios'],
        ['api.prime.coinbase.com', '/v1/entities', 'Prime: List Entities'],
        ['api.prime.coinbase.com', '/v1/users/self', 'Prime: Get Self User'],
        
        // Exchange API endpoints
        ['api.exchange.coinbase.com', '/accounts', 'Exchange: Get Accounts'],
        ['api.exchange.coinbase.com', '/profiles', 'Exchange: Get Profiles'],
        
        // Advanced Trade API endpoints
        ['api.coinbase.com', '/api/v3/brokerage/accounts', 'Advanced Trade: Get Accounts'],
        ['api.coinbase.com', '/api/v3/brokerage/portfolios', 'Advanced Trade: Get Portfolios'],
        
        // Regular Coinbase API endpoints
        ['api.coinbase.com', '/v2/accounts', 'Coinbase: Get Accounts V2'],
        ['api.coinbase.com', '/v2/user', 'Coinbase: Get User V2'],
    ];

    const results = [];
    for (const [hostname, path, description] of tests) {
        const result = await testEndpoint(hostname, path, description);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
    }

    console.log('\n📋 SUMMARY OF RESULTS:');
    console.log('=====================');
    
    const successful = results.filter(r => r.status === 200);
    const failed = results.filter(r => r.status !== 200);
    
    if (successful.length > 0) {
        console.log('\n✅ WORKING ENDPOINTS:');
        successful.forEach(r => console.log(`   • ${r.description}`));
    }
    
    if (failed.length > 0) {
        console.log('\n❌ FAILED ENDPOINTS:');
        failed.forEach(r => console.log(`   • ${r.description} (${r.status})`));
    }

    console.log('\n🎯 CONCLUSION:');
    if (successful.length > 0) {
        console.log(`✅ ${successful.length} endpoint(s) work with your credentials`);
        console.log('🔧 Use the working endpoints in your app');
    } else {
        console.log('❌ No endpoints work - check your API credentials');
    }
}

runAllTests().catch(console.error); 