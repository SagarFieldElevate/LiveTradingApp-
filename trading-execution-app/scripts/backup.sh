#!/bin/bash

# Backup script for Pinecone data
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$TIMESTAMP"

echo "📦 Starting backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Export strategies from Pinecone
node scripts/export-pinecone.js > "$BACKUP_DIR/strategies.json"

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" $BACKUP_DIR

# Upload to S3 (optional)
# aws s3 cp "$BACKUP_DIR.tar.gz" s3://your-backup-bucket/

echo "✅ Backup complete: $BACKUP_DIR.tar.gz" 