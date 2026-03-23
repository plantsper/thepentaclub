# Vercel Deployment Guide

## Current Setup

Your project is now configured for Vercel deployment with:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Framework**: Vite (Static Site)

## Deployment Options

### Option 1: Deploy via Git (Recommended)

If your repo is connected to Vercel:

```bash
# Commit and push changes
git add .
git commit -m "Migrate to TypeScript + Vite"
git push
```

Vercel will automatically:
1. Detect the changes
2. Install dependencies
3. Run `npm run build`
4. Deploy the `dist/` folder

### Option 2: Deploy via Vercel CLI

```bash
# Deploy to production
vercel --prod

# Or just deploy
vercel
```

### Option 3: Vercel Dashboard

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Build & Development Settings
4. Update the settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

## Vercel Configuration

The `vercel.json` file includes:
- ✅ SPA routing support (all routes go to index.html)
- ✅ Correct build command
- ✅ Correct output directory

## Build Verification

Before deploying, test the production build locally:

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

## Important Notes

### File Changes
- Old `index.html` in root is now a backup
- New entry point is `src/index.html`
- Vite outputs to `dist/` folder

### Environment Variables
If you need environment variables:
1. Add them in Vercel Dashboard → Settings → Environment Variables
2. Access them in code: `import.meta.env.VITE_YOUR_VAR`

### Custom Domain
Your custom domain should continue to work automatically after deployment.

## Troubleshooting

### Build Fails on Vercel

Check Vercel build logs. Common issues:
- Node version (Vercel uses Node 18+ by default, which is fine)
- Missing dependencies (run `npm install` locally first)
- TypeScript errors (run `npm run build` locally to test)

### 404 on Routes

The `vercel.json` rewrites configuration handles SPA routing. All routes redirect to `index.html`.

### Old Version Still Showing

- Clear Vercel cache in dashboard
- Force redeploy from Vercel dashboard
- Check that git push was successful

## Quick Deploy

```bash
# 1. Build locally to verify
npm run build

# 2. Commit changes
git add .
git commit -m "TypeScript migration complete"

# 3. Push to trigger deployment
git push

# Or use Vercel CLI
vercel --prod
```

Your site should be live at your Vercel URL within 1-2 minutes!
