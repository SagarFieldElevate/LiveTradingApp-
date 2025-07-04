require('dotenv').config();
const { aiParser } = require('./src/services/aiParser');

async function testRealParsing() {
    console.log('🧠 TESTING REAL AI STRATEGY PARSING...\n');
    
    // Your real strategy description
    const realStrategy = {
        id: 'test-strategy',
        strategy_id: 'test-strategy', 
        description: 'QQQ Daily Close Price shows strong positive correlation (r=0.92) with Bitcoin. Entry: When QQQ Daily Close Price moves >2% in same direction. Position sizing: Fixed 100% of capital per trade. Risk management: Stop loss at 2.0x ATR, Take profit at 3.0x ATR. Hold period: 3 days maximum.',
        user_id: 'test-user',
        quality_score: 95,
        sharpe_ratio: 10.81,
        total_trades: 25
    };
    
    try {
        console.log('📄 Original Description:');
        console.log(realStrategy.description);
        console.log('\n🔄 Parsing with AI...\n');
        
        const parsed = await aiParser.parseStrategy(realStrategy);
        
        console.log('✅ PARSED RESULT:');
        console.log('📛 Strategy Name:', parsed.strategy_name);
        console.log('🎯 Entry Conditions:', JSON.stringify(parsed.entry_conditions, null, 2));
        console.log('🛑 Exit Conditions:', JSON.stringify(parsed.exit_conditions, null, 2)); 
        console.log('📈 Required Assets:', parsed.required_assets);
        console.log('💰 Position Size:', parsed.position_size);
        
        if (parsed.strategy_name === 'Demo Parsed Strategy') {
            console.log('\n❌ STILL SHOWING DEMO - AI Parser may be in demo mode');
        } else {
            console.log('\n🎉 SUCCESS - Real parsing working!');
        }
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testRealParsing(); 