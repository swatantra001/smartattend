# SmartAttend Go-Live Checklist

## 1. Infrastructure
- [ ] VPS provisioned (min 4 vCPU, 8GB RAM recommended)
- [ ] `infra/scripts/provision.sh` executed successfully
- [ ] Domain DNS A records pointing to server IP:
  - [ ] `api.smartattend.yourdomain.com`
  - [ ] `admin.smartattend.yourdomain.com`
- [ ] SSL certificates obtained via `setup-ssl.sh`
- [ ] Firewall rules verified (ports 22, 80, 443 only)

## 2. Secrets & Environment
- [ ] All secrets generated (never committed to git):
  - [ ] `POSTGRES_PASSWORD` (openssl rand -hex 24)
  - [ ] `REDIS_PASSWORD` (openssl rand -hex 24)
  - [ ] `JWT_SECRET` (openssl rand -hex 64)
  - [ ] `JWT_REFRESH_SECRET` (openssl rand -hex 64, different from above)
  - [ ] `INTERNAL_SECRET` (openssl rand -hex 32)
- [ ] Firebase project created, service account JSON saved
- [ ] AWS S3 bucket created with server-side encryption enabled
- [ ] S3 lifecycle policy set:
  - [ ] `verifications/` folder → delete after 30 days
  - [ ] `proofs/` folder → delete after 90 days
  - [ ] `enrollments/` folder → never delete
- [ ] `.env` file deployed to `/opt/smartattend/.env`

## 3. Database
- [ ] `docker compose up -d postgres` successful
- [ ] `init.sql` executed (tables + PostGIS extension created)
- [ ] Admin user seeded manually:
```sql
  INSERT INTO colleges (name) VALUES ('Your College Name')
  RETURNING college_id;

  INSERT INTO users (email, password_hash, role, college_id, is_active)
  VALUES (
    'admin@yourcollege.edu',
    '$2b$12$<bcrypt hash of your admin password>',
    'ADMIN',
    '<college_id from above>',
    TRUE
  );
```
- [ ] Daily backup cron installed (`0 2 * * * /opt/smartattend/infra/scripts/backup.sh`)
- [ ] Test backup and restore procedure

## 4. Services
- [ ] All containers healthy:
```bash
  docker compose -f docker-compose.prod.yml ps
  # All should show "healthy"
```
- [ ] API health check passing:
```bash
  curl https://api.smartattend.yourdomain.com/health
  # Expected: {"status":"healthy",...}
```
- [ ] AI engine health check passing:
```bash
  # From inside backend network only:
  docker exec smartattend-api wget -qO- http://ai-engine:8000/health
```
- [ ] Admin web loading at `https://admin.smartattend.yourdomain.com`
- [ ] Admin login working

## 5. Mobile Apps
- [ ] EAS project IDs updated in `app.json` files
- [ ] Push notification credentials configured in EAS dashboard:
  - [ ] Android: Firebase project linked
  - [ ] iOS: APNs key uploaded
- [ ] Staging APK built and tested:
```bash
  cd apps/student-app && eas build --platform android --profile staging
  cd apps/professor-app && eas build --platform android --profile staging
```
- [ ] Push notifications received on staging build
- [ ] Background location pinging confirmed (every 60s in logs)
- [ ] Face enrollment tested end-to-end
- [ ] Attendance verification tested end-to-end

## 6. End-to-End Test Flow
Run this exact test before go-live:
```
1. Admin creates department + course in web dashboard
2. Admin registers professor account via API
3. Admin registers student account via API
4. Admin enrolls student in course
5. Student logs into app → face enrollment (5 photos)
6. Professor logs into app → starts attendance session
7. Student receives push notification within 5 seconds
8. Student taps notification → liveness challenges → face capture → submit
9. Professor dashboard shows student card turn green
10. Professor ends session
11. Admin reports page shows attendance record with scores
12. Admin audit log shows all actions
```

## 7. Performance & Monitoring
- [ ] Load test API: `ab -n 1000 -c 50 https://api.../health`
- [ ] Verify Postgres slow query log (threshold: 1s)
- [ ] Verify Redis memory usage below 200MB at idle
- [ ] Set up uptime monitoring (UptimeRobot / Better Stack)
- [ ] Set up error alerting (Sentry or email on 5xx spike)
- [ ] Monitor AI engine memory — should stabilize at ~2GB after warmup

## 8. Security Final Review
- [ ] No secrets in git history (`git log --all -S "password"`)
- [ ] `.env` in `.gitignore`
- [ ] AI engine not accessible from internet (internal Docker network only)
- [ ] Nginx rate limiting verified (auth endpoint: 10 req/min)
- [ ] JWT secret is at least 64 characters
- [ ] S3 bucket is private (no public read)
- [ ] PostgreSQL port 5432 NOT exposed to host (`ports:` removed in prod compose)
- [ ] Redis port 6379 NOT exposed to host

## 9. Rollback Plan
```bash
# If deployment fails:
cd /opt/smartattend
docker compose -f docker-compose.prod.yml down
git checkout <previous-working-sha>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 10. Post-Launch
- [ ] Monitor error logs for 24 hours after first real use
- [ ] Collect first-day attendance session results and verify accuracy
- [ ] Brief professors on manual override flow
- [ ] Share student enrollment guide (PDF or WhatsApp message)
- [ ] Schedule face re-enrollment period (1 week after launch)
```

---

### Final Project Structure
```
smartattend/
├── .github/
│   └── workflows/deploy.yml          ✅ CI/CD pipeline
├── apps/
│   ├── student-app/                  ✅ React Native (Expo)
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   ├── (auth)/login.tsx
│   │   │   ├── (tabs)/home.tsx
│   │   │   ├── (tabs)/attendance.tsx
│   │   │   ├── (tabs)/profile.tsx
│   │   │   ├── enroll-face.tsx
│   │   │   └── verify.tsx
│   │   ├── src/
│   │   │   ├── constants/
│   │   │   ├── services/ (api, notifications, location, liveness)
│   │   │   └── store/
│   │   ├── app.json
│   │   └── eas.json
│   ├── professor-app/                ✅ React Native (Expo)
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   ├── (auth)/login.tsx
│   │   │   ├── (tabs)/home.tsx
│   │   │   ├── (tabs)/reports.tsx
│   │   │   ├── (tabs)/profile.tsx
│   │   │   └── dashboard/[sessionId].tsx
│   │   └── src/
│   │       ├── constants/
│   │       ├── services/ (api, socket)
│   │       └── store/ (auth, session)
│   └── admin-web/                    ✅ React + Vite
│       ├── src/
│       │   ├── pages/ (7 pages)
│       │   ├── components/ (Layout, ui)
│       │   ├── services/api.ts
│       │   └── store/auth.store.ts
│       └── Dockerfile
├── services/
│   ├── api/                          ✅ Node.js + Express
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── controllers/ (5 controllers)
│   │   │   ├── middleware/ (4 middleware)
│   │   │   ├── routes/ (5 route files)
│   │   │   ├── sockets/
│   │   │   └── utils/
│   │   └── Dockerfile
│   └── ai-engine/                    ✅ Python + FastAPI
│       ├── app/
│       │   ├── routers/ (enroll, verify, upload, health)
│       │   ├── services/ (face_service, scene_service)
│       │   └── utils/ (image, s3)
│       └── Dockerfile
├── packages/
│   └── shared/                       ✅ TypeScript types
├── infra/
│   ├── init.sql                      ✅ DB schema
│   ├── docker-compose.yml            ✅ Development
│   ├── docker-compose.prod.yml       ✅ Production
│   ├── nginx/nginx.conf              ✅ Reverse proxy
│   └── scripts/
│       ├── provision.sh              ✅ Server setup
│       ├── setup-ssl.sh              ✅ TLS certs
│       └── backup.sh                 ✅ DB backups
└── docs/
    └── GO_LIVE_CHECKLIST.md          ✅ Launch guide