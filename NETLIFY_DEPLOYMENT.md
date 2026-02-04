# Netlify Deployment Guide

This Express.js application is configured to deploy on Netlify as serverless functions.

## Prerequisites

- Node.js 18.14.0 or later
- Netlify CLI installed globally: `npm install netlify-cli -g`
- Git repository initialized

## Configuration Files

### 1. `netlify.toml`
Contains the build configuration and redirect rules:
- Build command: `pnpm run build` (compiles TypeScript and generates Prisma client)
- Functions directory: `netlify/functions`
- External modules bundled: express, @prisma/client, pg
- Redirects all traffic to the serverless function

### 2. `netlify/functions/api.ts`
The Netlify Function that wraps your Express app using `serverless-http`

### 3. `src/app.ts`
Exported Express app instance (separated from the server listener)

## Environment Variables

Set up your environment variables in Netlify:

1. Go to your site settings in Netlify
2. Navigate to Environment Variables
3. Add all variables from your `.env` file:
   - `DATABASE_URL`
   - `BETTER_AUTH_URL`
   - `BETTER_AUTH_SECRET`
   - Any other required environment variables

## Deployment Steps

### Option 1: Deploy with Netlify CLI (Manual)

1. Install Netlify CLI (if not already installed):
   ```bash
   npm install netlify-cli -g
   ```

2. Initialize Netlify site:
   ```bash
   netlify init
   ```

3. Follow the prompts to:
   - Create a new site or link to an existing one
   - Select your team
   - Configure build settings (use defaults from netlify.toml)

4. Deploy:
   ```bash
   netlify deploy --prod
   ```

### Option 2: Deploy with Git (Continuous Deployment)

1. Push your code to GitHub/GitLab/Bitbucket

2. In Netlify dashboard:
   - Click "New site from Git"
   - Connect your repository
   - Netlify will auto-detect the configuration from `netlify.toml`
   - Add environment variables
   - Deploy!

## Testing Locally

To test the Netlify Functions locally:

```bash
netlify dev
```

This will start a local development server that simulates the Netlify environment.

## API Endpoints

All your API routes are accessible at:
- `/api/auth/*` - Authentication endpoints
- `/api/categories` - Category endpoints
- `/api/expenses` - Expense endpoints
- `/api/accounts` - Account endpoints
- `/api/users` - User endpoints

## Important Notes

1. **Function Limitations**: Netlify Functions have execution time limits (10 seconds for free tier, 26 seconds for Pro)
2. **Cold Starts**: The first request after inactivity may be slower due to cold starts
3. **Database**: Ensure your database is accessible from Netlify's servers (not localhost)
4. **Prisma**: The Prisma client is generated during build time

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify environment variables are set in Netlify
- Check build logs in Netlify dashboard

### Function Timeout
- Optimize database queries
- Consider upgrading Netlify plan for longer execution times

### Database Connection Issues
- Ensure DATABASE_URL is set correctly
- Check that your database allows connections from Netlify's IP ranges
- For PostgreSQL, consider using connection pooling (PgBouncer)

## Resources

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Express on Netlify Guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/)
