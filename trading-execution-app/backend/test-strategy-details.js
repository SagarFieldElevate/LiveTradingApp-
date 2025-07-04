const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function getStrategyDetails() {
    try {
        console.log('📋 GETTING DETAILED STRATEGY INFO...\n');
        
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const favoritesIndex = pinecone.index('trading-favorites');
        
        // Get all strategies
        const response = await favoritesIndex.query({
            vector: new Array(1536).fill(0),
            topK: 10,
            includeMetadata: true
        });
        
        console.log(`Found ${response.matches?.length || 0} strategies:\n`);
        
        if (response.matches && response.matches.length > 0) {
            response.matches.forEach((match, i) => {
                console.log(`${i + 1}. STRATEGY DETAILS:`);
                console.log(`   🆔 ID: ${match.id}`);
                console.log(`   📛 Strategy ID: ${match.metadata?.strategy_id || 'N/A'}`);
                console.log(`   📝 Strategy Name: ${match.metadata?.strategy_name || 'N/A'}`);
                console.log(`   📄 Description: ${match.metadata?.description || 'N/A'}`);
                console.log(`   👤 User ID: ${match.metadata?.user_id || 'N/A'}`);
                console.log(`   📊 Quality Score: ${match.metadata?.quality_score || 'N/A'}`);
                console.log(`   📈 Sharpe Ratio: ${match.metadata?.sharpe_ratio || 'N/A'}`);
                console.log(`   🎯 Asset 1: ${match.metadata?.asset_1 || 'N/A'}`);
                console.log(`   🎯 Asset 2: ${match.metadata?.asset_2 || 'N/A'}`);
                console.log(`   📅 Favorited: ${match.metadata?.favorited_at || 'N/A'}`);
                console.log(`   🔧 Type: ${match.metadata?.type || 'N/A'}`);
                
                console.log(`   🗂️ All Keys: ${match.metadata ? Object.keys(match.metadata).join(', ') : 'None'}`);
                console.log('   ' + '─'.repeat(50));
                console.log('');
            });
        }
        
        console.log('💡 SOLUTION:');
        console.log('Your strategies need better display names. Options:');
        console.log('1. Use the description field as the display name');
        console.log('2. Parse descriptions to extract strategy types');
        console.log('3. Update strategy_name field with readable names');
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

getStrategyDetails(); 