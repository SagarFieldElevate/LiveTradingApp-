const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function testPineconeData() {
    try {
        console.log('🔍 TESTING PINECONE DATA...\n');
        
        if (!process.env.PINECONE_API_KEY) {
            console.log('❌ PINECONE_API_KEY not found');
            return;
        }
        
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const favoritesIndexName = process.env.PINECONE_INDEX_FAVORITES || 'trading-favorites';
        const executionIndexName = process.env.PINECONE_INDEX_EXECUTION || 'trading-execution';
        
        console.log(`📋 Checking indexes: ${favoritesIndexName}, ${executionIndexName}\n`);
        
        // Check favorites index
        try {
            const favoritesIndex = pinecone.index(favoritesIndexName);
            
            console.log(`🔍 QUERYING ${favoritesIndexName}:`);
            const favoritesResponse = await favoritesIndex.query({
                vector: new Array(1536).fill(0),
                topK: 10,
                includeMetadata: true
            });
            
            console.log(`   📊 Found ${favoritesResponse.matches?.length || 0} records`);
            
            if (favoritesResponse.matches && favoritesResponse.matches.length > 0) {
                favoritesResponse.matches.forEach((match, i) => {
                    console.log(`   ${i + 1}. ID: ${match.id}`);
                    console.log(`      Score: ${match.score}`);
                    if (match.metadata) {
                        console.log(`      Strategy Name: ${match.metadata.strategy_name || 'N/A'}`);
                        console.log(`      User ID: ${match.metadata.user_id || 'N/A'}`);
                        console.log(`      Status: ${match.metadata.status || 'N/A'}`);
                        console.log(`      Type: ${match.metadata.type || 'N/A'}`);
                        console.log(`      Keys: ${Object.keys(match.metadata).join(', ')}`);
                    } else {
                        console.log(`      ❌ No metadata`);
                    }
                    console.log('');
                });
            } else {
                console.log('   📭 No strategies found in favorites index');
            }
            
        } catch (error) {
            console.log(`❌ Error querying ${favoritesIndexName}:`, error.message);
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Check execution index
        try {
            const executionIndex = pinecone.index(executionIndexName);
            
            console.log(`🔍 QUERYING ${executionIndexName}:`);
            const executionResponse = await executionIndex.query({
                vector: new Array(1536).fill(0),
                topK: 10,
                includeMetadata: true
            });
            
            console.log(`   📊 Found ${executionResponse.matches?.length || 0} records`);
            
            if (executionResponse.matches && executionResponse.matches.length > 0) {
                executionResponse.matches.forEach((match, i) => {
                    console.log(`   ${i + 1}. ID: ${match.id}`);
                    console.log(`      Score: ${match.score}`);
                    if (match.metadata) {
                        console.log(`      Strategy Name: ${match.metadata.strategy_name || 'N/A'}`);
                        console.log(`      Type: ${match.metadata.type || 'N/A'}`);
                        console.log(`      User ID: ${match.metadata.user_id || 'N/A'}`);
                        console.log(`      Keys: ${Object.keys(match.metadata).join(', ')}`);
                    } else {
                        console.log(`      ❌ No metadata`);
                    }
                    console.log('');
                });
            } else {
                console.log('   📭 No data found in execution index');
            }
            
        } catch (error) {
            console.log(`❌ Error querying ${executionIndexName}:`, error.message);
        }
        
        console.log('\n🎯 SUMMARY:');
        console.log('If you see "Demo Parsed Strategy" in your app, it means:');
        console.log('1. Pinecone indexes exist but are empty, OR');
        console.log('2. Strategies are stored with wrong format/metadata');
        console.log('3. Need to import your real strategies into Pinecone');
        
    } catch (error) {
        console.log('❌ Failed to connect to Pinecone:', error.message);
    }
}

testPineconeData(); 