import autocannon from 'autocannon';

describe('Load Testing', () => {
  const baseUrl = 'http://localhost:3000';

  test('API can handle 1000 requests per second', async () => {
    const result = await autocannon({
      url: `${baseUrl}/api/monitoring/prices?symbols=BTC-USD,ETH-USD`,
      connections: 100,
      duration: 10,
      pipelining: 10
    });

    expect(result.requests.average).toBeGreaterThan(1000);
    expect(result.latency.p99).toBeLessThan(100); // 99th percentile < 100ms
    expect(result.errors).toBe(0);
  });

  test('WebSocket can handle 500 concurrent connections', async () => {
    const WebSocket = require('ws');
    const connections: any[] = [];
    
    for (let i = 0; i < 500; i++) {
      const ws = new WebSocket(`ws://localhost:3000`);
      connections.push(ws);
    }

    // Wait for all connections
    await Promise.all(
      connections.map(ws => 
        new Promise(resolve => ws.on('open', resolve))
      )
    );

    // All should be connected
    const connected = connections.filter(ws => ws.readyState === WebSocket.OPEN);
    expect(connected.length).toBe(500);

    // Cleanup
    connections.forEach(ws => ws.close());
  });
}); 