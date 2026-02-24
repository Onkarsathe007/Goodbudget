# GitHub Actions Workflows

## test.yml - Complete Test Suite

Runs on every push to `main` branch.

### What it tests:
- ✅ TypeScript compilation
- ✅ Biome lint/format checks
- ✅ Database migrations (Prisma)
- ✅ Application build
- ✅ Server startup validation
- ✅ Tests (if test script exists)

### Services:
- PostgreSQL 17
- Redis 7

### Doppler Integration:
- **With DOPPLER_TOKEN secret**: Uses Doppler config `ci` from project `goodbudget`
- **Without DOPPLER_TOKEN**: Falls back to basic .env with test database credentials

### Setup:
1. Add `DOPPLER_TOKEN` to GitHub repository secrets (optional but recommended)
2. Ensure Doppler has a `ci` config in `goodbudget` project
3. Push to `main` branch to trigger

### Doppler CI Config Setup:
```bash
# Create ci config if it doesn't exist
doppler configs create ci --project goodbudget --environment dev

# Set CI-specific secrets
doppler secrets set DATABASE_URL="postgresql://goodbudget_test:test_password@localhost:5432/goodbudget_test" --config ci --project goodbudget
doppler secrets set REDIS_URL="redis://localhost:6379" --config ci --project goodbudget
doppler secrets set BETTER_AUTH_SECRET="your-ci-secret-key" --config ci --project goodbudget
```

### Get Service Token:
```bash
# Generate token for GitHub Actions
doppler configs tokens create github-actions --config ci --project goodbudget
```

Add the generated token as `DOPPLER_TOKEN` in GitHub repo settings → Secrets → Actions.
