const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const API_KEY = process.env.COINBASE_API_KEY;
const API_SECRET = process.env.COINBASE_API_SECRET;
const PASSPHRASE = process.env.COINBASE_PASSPHRASE;
const ENTITY_ID = '7823ac3e-fc41-4f7e-be83-619b37fb696a';

function generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');
}

async function getEntityBalances() {
    return new Promise((resolve, reject) => {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const method = 'GET';
        const path = `/v1/entities/${ENTITY_ID}/balances`;
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

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const parsed = JSON.parse(data);
                    resolve(parsed.balances || []);
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function calculatePortfolio() {
    console.log('🚀 CALCULATING YOUR REAL PORTFOLIO VALUE...\n');
    
    try {
        const balances = await getEntityBalances();
        
        let totalValue = 0;
        let cashBalance = 0;
        const positions = [];
        
        for (const balance of balances) {
            const amount = parseFloat(balance.long_amount || '0');
            const notional = parseFloat(balance.long_notional || '0');
            
            if (amount > 0) {
                if (balance.symbol === 'USD' || balance.symbol === 'USDC') {
                    cashBalance += notional;
                } else {
                    totalValue += notional;
                    
                    positions.push({
                        currency: balance.symbol,
                        quantity: amount,
                        value: notional,
                        price: amount > 0 ? notional / amount : 0
                    });
                }
            }
        }
        
        const grandTotal = totalValue + cashBalance;
        
        console.log('💰 PORTFOLIO SUMMARY:');
        console.log('=====================');
        console.log(`💵 Total Value: $${grandTotal.toLocaleString()}`);
        console.log(`💴 Cash Balance: $${cashBalance.toLocaleString()}`);
        console.log(`📈 Crypto Positions: $${totalValue.toLocaleString()}`);
        console.log(`📋 Number of Holdings: ${positions.length}`);
        
        console.log('\n🔝 TOP 10 HOLDINGS:');
        console.log('==================');
        
        // Sort by value (highest first)
        positions.sort((a, b) => b.value - a.value);
        
        positions.slice(0, 10).forEach((pos, i) => {
            const qty = pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 });
            const val = pos.value.toLocaleString();
            console.log(`${i + 1}. ${pos.currency}: ${qty} tokens = $${val}`);
        });
        
        if (grandTotal > 1000000) {
            console.log('\n🎉🎉🎉 CONGRATULATIONS! 🎉🎉🎉');
            console.log('💎 YOU ARE A MULTI-MILLIONAIRE! 💎');
            console.log(`🚀 Your portfolio is worth $${grandTotal.toLocaleString()}! 🚀`);
        }
        
        return {
            total_value: grandTotal,
            cash_balance: cashBalance,
            positions_value: totalValue,
            positions: positions,
            open_positions: positions.length
        };
        
    } catch (error) {
        console.error('❌ Error calculating portfolio:', error.message);
    }
}

calculatePortfolio(); 