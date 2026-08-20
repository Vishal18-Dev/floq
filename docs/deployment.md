# FLOQ Production & Controlled Beta Backend Deployment Guide

## Overview

This guide details the deployment requirements for hosting the FLOQ backend server for a controlled beta trial with 5–20 merchants.

## Recommended Hosting Options

1. **Option A: Linux VPS (Ubuntu 24.04 LTS on AWS EC2, Hetzner, or DigitalOcean)** — *Recommended for SQLite persistence*.
2. **Option B: Google Cloud Run / AWS ECS** — Requires mounting a persistent network volume (GCP Cloud Storage FUSE or AWS EFS) for the SQLite WAL database.

---

## Environment Setup & Secret Configuration

1. Copy `.env.example` to `/var/lib/floq/.env` on the server:
   ```bash
   cp .env.example /var/lib/floq/.env
   ```
2. Configure mandatory production environment variables:
   ```ini
   NODE_ENV=production
   PORT=4000
   JWT_SECRET=c8f9a2e1d7b34e5a91823f456789abcd0123456789abcdef0123456789abcdef
   CORS_ORIGIN=https://vendor.floq.in
   DB_PATH=/var/lib/floq/database/floq.sqlite
   DB_BACKUP_DIR=/var/lib/floq/database/backups
   ALLOW_MOCK_AUTH=false
   ALLOW_MOCK_PAYMENTS=false
   ```

---

## Nginx HTTPS Reverse Proxy Configuration

Install Certbot and Nginx to terminate SSL certificates:

```nginx
server {
    listen 443 ssl http2;
    server_name api.floq.in;

    ssl_certificate /etc/letsencrypt/live/api.floq.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.floq.in/privkey.pem;

    location /api/realtime {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Cache-Control 'no-cache';
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## SQLite Database Persistence & Backup Schedule

1. **WAL Mode**: SQLite operates in Write-Ahead Logging (WAL) mode (`PRAGMA journal_mode=WAL;`), enabling concurrent readers and writers without database locking bottlenecks.
2. **Directory Permissions**: Ensure the directory containing `floq.sqlite` has `0755` write permissions for the `node` service user.
3. **Automated Point-in-Time Backups**:
   Schedule an automated cron job executing SQLite online backup every 6 hours:
   ```crontab
   0 */6 * * * node /var/lib/floq/backend/dist/db/backup.js >> /var/log/floq-backup.log 2>&1
   ```
