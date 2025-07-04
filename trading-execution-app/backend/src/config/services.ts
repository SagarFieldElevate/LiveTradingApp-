// Services configuration
export const servicesConfig = {
  coinbase: {
    apiKey: process.env.COINBASE_API_KEY!,
    apiSecret: process.env.COINBASE_API_SECRET!,
    passphrase: process.env.COINBASE_PASSPHRASE!,
    serviceAccountId: process.env.COINBASE_SERVICE_ACCOUNT_ID!,
    sandbox: process.env.NODE_ENV !== 'production', // Use sandbox for development
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY!,
    host: process.env.PINECONE_HOST!,
    favoritesIndex: process.env.PINECONE_FAVORITES_INDEX!,
    executionIndex: process.env.PINECONE_EXECUTION_INDEX!,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
    embeddingModel: 'text-embedding-ada-002',
  },
  polygon: {
    apiKey: process.env.POLYGON_API_KEY!,
    websocketUrl: 'wss://socket.polygon.io/crypto',
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    errorWebhookUrl: process.env.SLACK_ERROR_WEBHOOK_URL,
    channels: {
      trades: process.env.SLACK_CHANNEL_TRADES || '#trading-alerts',
      errors: process.env.SLACK_CHANNEL_ERRORS || '#trading-errors',
    },
  },
}; 