// Test setup
process.env.NODE_ENV = 'test';
process.env.COINBASE_API_KEY = 'test-key';
process.env.COINBASE_API_SECRET = 'test-secret';
process.env.POLYGON_API_KEY = 'test-polygon-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.PINECONE_API_KEY = 'test-pinecone-key';
process.env.PINECONE_FAVORITES_INDEX = 'test-favorites';
process.env.PINECONE_EXECUTION_INDEX = 'test-execution';
process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
process.env.SLACK_ERROR_WEBHOOK_URL = 'https://hooks.slack.com/test-error';
process.env.EMERGENCY_AUTH_CODE = 'TEST-AUTH-CODE';

// Mock console methods to reduce noise during tests
console.log = jest.fn();
console.error = jest.fn();

// Set timeout for async operations
jest.setTimeout(10000); 