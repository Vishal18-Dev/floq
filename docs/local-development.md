# FLOQ Local Development Guide (PostgreSQL)

## 1. Prerequisites
- Node.js v20+
- Docker & Docker Compose (or local PostgreSQL 16 installation)

---

## 2. Quick Start Commands

### Step 1: Start Local PostgreSQL Container
```bash
docker-compose up -d postgres
```

### Step 2: Configure Environment File
Copy `.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Ensure `DATABASE_URL` is set in `backend/.env`:
```ini
DATABASE_URL=postgresql://floq:floq_dev_password_2026@localhost:5432/floq_db
```

### Step 3: Run Database Migrations
```bash
npm run db:migrate --workspace=backend
```

### Step 4: Seed Development Database
```bash
npm run db:seed --workspace=backend
```

### Step 5: Start Backend API & Vendor POS
```bash
# Start backend API server
npm run dev --workspace=backend

# Start Vendor mobile app (Metro bundler)
npm run dev:vendor
```

---

## 3. Running Unit & Concurrency Tests
```bash
npm test --workspace=backend
```
