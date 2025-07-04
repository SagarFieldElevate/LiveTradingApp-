require('dotenv').config();
const { coinbaseService } = require('./dist/services/coinbaseService');

async function testPortfolio() {
    console.log('🚀 Testing FIXED Coinbase Portfolio Service...\n');
    
    try {
        console.log('📊 Fetching your portfolio...');
        const portfolio = await coinbaseService.getPortfolio();
        
        console.log('\n💰 PORTFOLIO SUMMARY:');
        console.log('=====================');
        console.log(`💵 Total Value: $${portfolio.total_value.toLocaleString()}`);
        console.log(`💴 Cash Balance: $${portfolio.cash_balance.toLocaleString()}`);
        console.log(`📈 Positions Value: $${portfolio.positions_value.toLocaleString()}`);
        console.log(`📋 Number of Positions: ${portfolio.open_positions}`);
        
        console.log('\n🔝 TOP POSITIONS:');
        console.log('=================');
        
        // Sort positions by value (highest first)
        const sortedPositions = portfolio.positions.sort((a, b) => b.value - a.value);
        
        // Show top 10 positions
        sortedPositions.slice(0, 10).forEach((pos, i) => {
            console.log(`${i + 1}. ${pos.currency}: ${parseFloat(pos.quantity).toLocaleString()} tokens = $${pos.value.toLocaleString()}`);
        });
        
        if (portfolio.total_value > 1000000) {
            console.log('\n🎉 CONGRATULATIONS! YOU ARE A CRYPTO MILLIONAIRE! 🎉');
            console.log('💎 Your portfolio is worth over $1 million USD! 💎');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testPortfolio(); 