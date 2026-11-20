# Deploy the Phishing Trip website on Vercel

## What this deploys

The existing website, including Hook, Check, Directory, My Trips, Help and
the extension installation page. It does **not** deploy the Expo app,
slide deck, database, private API, or browser extension to an extension store.
The existing Replit preview continues using `/phishing-trip/`; Vercel serves
the website at `/`.

**Live number checks and directory data need the separately prepared public
checking service.** Until that is approved and published, `/api` deliberately
returns HTTP 503 with an explanatory JSON error, not the website HTML or a
fabricated verification result. The page itself can be deployed now.

## Import from GitHub

1. Commit and push these changes to your existing GitHub repository.
2. Sign in at https://vercel.com/new using GitHub.
3. Import the repository containing this workspace. If it is not listed,
   grant Vercel's GitHub integration access to that repository.
4. Leave **Root Directory** at the **repository root** (`./`), not
   `artifacts/phishing-trip-web`. Shared workspace packages, the lockfile,
   patches and extension release metadata must remain accessible.
5. Choose **Other** as the framework preset and **Node.js 22.x**.
6. Keep the settings supplied by the root `vercel.json`:

   | Setting | Value |
   | --- | --- |
   | Install Command | `pnpm install --frozen-lockfile` |
   | Build Command | `BASE_PATH=/ PORT=5173 pnpm --filter @workspace/phishing-trip-web run build` |
   | Output Directory | `artifacts/phishing-trip-web/dist/public` |

7. No environment variables or Google keys are needed for this **frontend-only**
   deployment. Click **Deploy** in Vercel.
8. Open the address Vercel provides. Refresh `/directory`, `/trips`, `/help`
   and `/extension` directly to confirm deep links work.

The root `packageManager` field pins pnpm. Do not replace it with npm or
deploy using the root `build` script: that would build unrelated artifacts.
After import, pushes to the configured production branch trigger new Vercel
deployments.

## Connect live checks later

Do not point Vercel at a private Replit deployment or development preview.
Do not make the existing project public just to make Vercel work.
Never add `GOOGLE_PLACES_API_KEY`, database credentials or a Replit bypass
token to `VITE_*` variables, browser JavaScript, or a rewrite URL.

Once the separate public service is approved, published and verified:

1. Obtain its actual production HTTPS origin.
2. Confirm it supports all operations used by this website: capabilities,
   company lists/details, travel safety guidance, explicit phone checks and
   optional Places searches. An extension-only service may not support all
   these operations.
3. Replace **only the first entry** in `vercel.json`'s `routes` array with
   a rewrite for each approved operation below, using that real origin:

   ```json
   {
     "src": "/api/checks",
     "methods": ["POST"],
     "dest": "https://YOUR-PUBLIC-SERVICE/api/checks",
     "headers": { "Cache-Control": "no-store" }
   }
   ```

   Repeat for `POST /api/places/search`, `GET /api/capabilities`,
   `GET /api/companies`, `GET /api/companies/[id]`, and
   `GET /api/travel-safety`, using a bounded company-ID pattern for the
   detail route. Keep a final `/api(?:/.*)?` 503 rule **before**
   `handle: filesystem` so unknown API routes never serve the SPA.
   The example hostname is a placeholder, not a working service.
4. Redeploy and verify successful/error requests, explicit consent,
   no-store responses, and source attribution. Check that POST bodies and
   directory query parameters reach the service correctly.

The public service must enforce validation, abuse limits and the existing
shared **10 Google Places attempts per day**. Hosting the frontend on Vercel
does not provide a spam database or increase that allowance. Google Places
listings remain discovery evidence, not a safety verdict.

## Local verification

From the repository root:

```sh
pnpm --filter @workspace/phishing-trip-web run typecheck
BASE_PATH=/ PORT=5173 pnpm --filter @workspace/phishing-trip-web run build
```

The output is ignored by Git. Only the compiled website in the configured
output directory is served; workspace source files are not the public root.
