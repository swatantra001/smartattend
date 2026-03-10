#!/usr/bin/env bash
# Daily PostgreSQL backup to S3.
# Install as cron: 0 2 * * * /opt/smartattend/infra/scripts/backup.sh
set -euo pipefail

source /opt/smartattend/.env

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/smartattend_backup_${TIMESTAMP}.sql.gz"
S3_KEY="backups/db/smartattend_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

echo "[$(date)] Starting backup..."

# Dump and compress
docker exec smartattend-postgres pg_dump \
  -U "$POSTGRES_USER" "$POSTGRES_DB" | \
  gzip > "$BACKUP_FILE"

# Upload to S3
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION="$AWS_REGION" \
  -v /tmp:/tmp \
  amazon/aws-cli:latest \
  s3 cp "/tmp/$S3_KEY" "s3://$S3_BUCKET/$S3_KEY" --storage-class STANDARD_IA

# Remove local file
rm -f "$BACKUP_FILE"

# Delete old backups from S3 (older than RETENTION_DAYS)
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION="$AWS_REGION" \
  amazon/aws-cli:latest \
  s3 ls "s3://$S3_BUCKET/backups/db/" | \
  awk '{print $4}' | \
  while read key; do
    file_date=$(echo "$key" | grep -oP '\d{8}')
    cutoff=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d)
    if [[ "$file_date" < "$cutoff" ]]; then
      aws s3 rm "s3://$S3_BUCKET/backups/db/$key"
      echo "Deleted old backup: $key"
    fi
  done

echo "[$(date)] ✅ Backup complete: $S3_KEY"