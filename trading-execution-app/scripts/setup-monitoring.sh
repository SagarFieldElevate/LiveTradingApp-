#!/bin/bash

# Setup monitoring with Prometheus and Grafana
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

docker run -d \
  --name grafana \
  -p 3002:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana

echo "Monitoring stack deployed:"
echo "- Prometheus: http://localhost:9090"
echo "- Grafana: http://localhost:3002 (admin/admin)" 