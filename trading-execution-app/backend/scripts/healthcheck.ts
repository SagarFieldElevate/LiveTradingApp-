import 'dotenv/config';
import { logger } from '../src/utils/logger';
import { pineconeService } from '../src/services/pineconeService';
import { aiParser } from '../src/services/aiParser';
import { coinbaseService } from '../src/services/coinbaseService';
import WebSocket from 'ws';

interface Results {
  pinecone: boolean;
  openai: boolean;
  coinbase: boolean;
  polygon: boolean;
}

async function checkPolygon(apiKey?: string): Promise<boolean> {
  if (!apiKey) return false;
  return new Promise<boolean>((resolve) => {
    try {
      const ws = new WebSocket('wss://socket.polygon.io/stocks');
      const timeout = setTimeout(() => {
        ws.terminate();
        resolve(false);
      }, 5000);

      ws.on('open', () => {
        ws.send(`{"action":"auth","params":"${apiKey}"}`);
      });

      ws.on('message', (data) => {
        const msg = data.toString();
        if (msg.includes('"status":"auth_success"')) {
          clearTimeout(timeout);
          ws.terminate();
          resolve(true);
        }
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function main() {
  const results: Results = {
    pinecone: false,
    openai: false,
    coinbase: false,
    polygon: false,
  };

  // Pinecone
  try {
    await pineconeService.initialize();
    results.pinecone = true;
  } catch (error) {
    logger.error('Pinecone check failed:', error);
  }

  // OpenAI (embedding)
  try {
    await aiParser.generateEmbedding('ping');
    results.openai = true;
  } catch (error) {
    logger.error('OpenAI check failed:', error);
  }

  // Coinbase (read-only accounts)
  try {
    await coinbaseService.getAccounts();
    results.coinbase = true;
  } catch (error) {
    logger.error('Coinbase check failed:', error);
  }

  // Polygon WebSocket auth
  try {
    results.polygon = await checkPolygon(process.env.POLYGON_API_KEY);
  } catch (error) {
    logger.error('Polygon check failed:', error);
  }

  // Print summary
  // eslint-disable-next-line no-console
  console.table(results);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Healthcheck script error:', err);
  process.exit(1);
}); 