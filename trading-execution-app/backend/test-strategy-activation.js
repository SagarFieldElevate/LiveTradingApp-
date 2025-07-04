require('dotenv').config();
const axios = require('axios');

async function testStrategyActivation() {
    console.log('🧪 TESTING STRATEGY ACTIVATION AFTER PINECONE FIX...\n');
    
    try {
        // First, get the list of strategies
        console.log('📋 Fetching strategies...');
        const strategiesResponse = await axios.get('http://localhost:3000/api/strategies');
        const strategies = strategiesResponse.data;
        
        console.log(`✅ Found ${strategies.length} strategies:`);
        strategies.forEach((strategy, index) => {
            console.log(`  ${index + 1}. ${strategy.strategy_name} (ID: ${strategy.strategy_id})`);
        });
        
        if (strategies.length === 0) {
            console.log('❌ No strategies found to test');
            return;
        }
        
        // Try to activate the first strategy
        const testStrategy = strategies[0];
        console.log(`\n🎯 Testing activation of: ${testStrategy.strategy_name}`);
        console.log(`📝 Strategy ID: ${testStrategy.strategy_id}`);
        
        const activationResponse = await axios.put(
            `http://localhost:3000/api/strategies/${testStrategy.strategy_id}/approve`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('\n🎉 SUCCESS! Strategy activation worked!');
        console.log('✅ No vector dimension errors');
        console.log('📊 Response status:', activationResponse.status);
        console.log('📋 Response data:', JSON.stringify(activationResponse.data, null, 2));
        
    } catch (error) {
        console.log('\n❌ ACTIVATION FAILED:');
        
        if (error.response) {
            console.log('📊 Status:', error.response.status);
            console.log('📝 Response:', JSON.stringify(error.response.data, null, 2));
            
            // Check if it's still the dimension error
            const errorMessage = JSON.stringify(error.response.data);
            if (errorMessage.includes('Vector dimension 1536 does not match the dimension of the index 1024')) {
                console.log('\n🚨 STILL GETTING DIMENSION ERROR!');
                console.log('🔧 The Pinecone fix may not have taken effect yet');
                console.log('💡 Try waiting a few more minutes or check index status');
            } else {
                console.log('\n✅ Different error - dimension issue is fixed');
            }
        } else {
            console.log('📝 Error:', error.message);
        }
    }
}

testStrategyActivation().catch(console.error); 