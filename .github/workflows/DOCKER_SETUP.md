# Docker Hub CI/CD Setup

## Current Issue
The workflow is failing with: `incorrect username or password`

## Root Cause
The `DOCKERHUB_TOKEN` secret must be a Docker Hub **Access Token**, not your Docker Hub password.

## Fix Instructions

### Step 1: Create Docker Hub Access Token

1. Go to [Docker Hub](https://hub.docker.com/)
2. Sign in to your account
3. Click your username (top-right) → **Account Settings**
4. Navigate to **Security** → **Personal Access Tokens** (or **Access Tokens**)
5. Click **Generate New Token** or **New Access Token**
6. Configure the token:
   - **Description**: `GitHub Actions - Goodbudget`
   - **Access permissions**: Select **Read, Write, Delete** (or at minimum **Read & Write**)
7. Click **Generate**
8. **IMPORTANT**: Copy the token immediately (you won't see it again)

### Step 2: Update GitHub Secrets

#### Option A: Using GitHub CLI (gh)

```bash
# Set DOCKERHUB_USERNAME (your Docker Hub username, e.g., "onkarsathe007")
gh secret set DOCKERHUB_USERNAME --body "YOUR_DOCKERHUB_USERNAME"

# Set DOCKERHUB_TOKEN (the access token you just created)
gh secret set DOCKERHUB_TOKEN --body "YOUR_ACCESS_TOKEN_HERE"
```

#### Option B: Using GitHub Web UI

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Update/Create secrets:
   - **DOCKERHUB_USERNAME**: Your Docker Hub username (e.g., `onkarsathe007`)
   - **DOCKERHUB_TOKEN**: Paste the access token from Step 1

### Step 3: Verify Docker Hub Repository

The workflow will push to: `<DOCKERHUB_USERNAME>/goodbudget:latest`

Example: If your username is `onkarsathe007`, the image will be:
```
docker.io/onkarsathe007/goodbudget:latest
```

Docker Hub will automatically create the repository on first push if it doesn't exist.

### Step 4: Test the Workflow

Push to the `prod` branch to trigger the workflow:

```bash
git push origin prod
```

Or manually trigger from GitHub Actions tab if workflow_dispatch is configured.

## Workflow Changes Made

✅ **Updated to latest actions**:
- `docker/build-push-action@v6` (was v5)
- Added `docker/metadata-action@v5` for better tagging

✅ **Improved tagging strategy**:
- `latest` - always points to latest prod build
- `prod-<git-sha>` - unique tag per commit

✅ **Added build caching**:
- Uses GitHub Actions cache for faster builds

✅ **Security improvements**:
- Explicit permissions
- Uses access tokens instead of passwords

✅ **Better image naming**:
- Changed from generic `myapp` to `goodbudget`

## Expected Result

After fixing the secrets, the workflow will:
1. ✅ Checkout code
2. ✅ Set up Docker Buildx
3. ✅ Login to Docker Hub
4. ✅ Build multi-stage Docker image
5. ✅ Push to Docker Hub as:
   - `<username>/goodbudget:latest`
   - `<username>/goodbudget:prod-<sha>`

## Troubleshooting

### Still getting "incorrect username or password"?

1. **Verify DOCKERHUB_USERNAME is correct**:
   ```bash
   # Check current value (will show "***" for security)
   gh secret list
   ```

2. **Regenerate Docker Hub token**:
   - Delete old token from Docker Hub
   - Create new one
   - Update GitHub secret

3. **Check Docker Hub username format**:
   - Should be just the username (e.g., `onkarsathe007`)
   - NOT the full image path (e.g., `onkarsathe007/goodbudget`)
   - NOT an email address

### Build failing for other reasons?

Check the logs:
```bash
gh run view --log
```

## Security Notes

- ✅ Access tokens are more secure than passwords
- ✅ Tokens can be revoked without changing your password
- ✅ Tokens can have limited permissions (read/write only)
- ✅ Never commit tokens to the repository
- ✅ Rotate tokens periodically (every 90 days recommended)
