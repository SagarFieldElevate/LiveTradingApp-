#!/bin/bash

echo "📊 Enabling monitoring..."

# Wait for Grafana to be ready
echo "⏳ Waiting for Grafana to start..."
until curl -s http://localhost:3002 > /dev/null; do
    sleep 2
done

# Create Prometheus data source
echo "📈 Configuring Prometheus data source..."
curl -X POST http://admin:admin@localhost:3002/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prometheus",
    "type": "prometheus",
    "url": "http://prometheus:9090",
    "access": "proxy",
    "isDefault": true
  }'

# Import dashboards
echo "📊 Importing dashboards..."
curl -X POST http://admin:admin@localhost:3002/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard": {
      "title": "Trading System Overview",
      "panels": [
        {
          "title": "Active Strategies",
          "targets": [{"expr": "active_strategies_total"}],
          "gridPos": {"x": 0, "y": 0, "w": 6, "h": 8}
        },
        {
          "title": "Open Positions",
          "targets": [{"expr": "open_positions_total"}],
          "gridPos": {"x": 6, "y": 0, "w": 6, "h": 8}
        },
        {
          "title": "Portfolio Value",
          "targets": [{"expr": "portfolio_value_usd"}],
          "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8}
        },
        {
          "title": "Trade Execution Latency",
          "targets": [{"expr": "rate(trade_execution_duration_seconds_sum[5m]) / rate(trade_execution_duration_seconds_count[5m])"}],
          "gridPos": {"x": 0, "y": 8, "w": 12, "h": 8}
        },
        {
          "title": "Market Data Lag",
          "targets": [{"expr": "market_data_lag_seconds"}],
          "gridPos": {"x": 12, "y": 8, "w": 12, "h": 8}
        }
      ]
    },
    "overwrite": true
  }'

echo "✅ Monitoring enabled!"
echo "📊 Grafana dashboard: http://localhost:3002 (admin/admin)"
echo "📈 Prometheus: http://localhost:9090" 