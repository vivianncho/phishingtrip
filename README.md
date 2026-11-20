# Phishing Trip

**Sleep with the phishes.**

Made by **Vivian Cho** and **Esther Tran** for the **Replit x Cornell Tech hackathon**.

A calmer way to check a travel phone number before calling. Phishing Trip
helps anxious travelers compare numbers with available official-source
evidence and find alternative contacts for airlines, hotels and other
travel businesses. Hook, our lantern fish, makes the evidence state easy
to recognize.

## What is included

- **Website:** responsive Check, Directory, My Trips and Help screens,
  plus an extension installation page.
- **iPhone-first mobile app:** built with Expo and React Native.
- **Browser extension source:** Chrome/Edge and Safari packaging resources
  for checking a number the user explicitly chooses.
- **Shared API:** sourced contact evidence and optional Google Places
  discovery.

Source code and packaging resources do not mean an app or extension is
published in a store. The installation page shows actual listing availability.

## What Hook's light means

| Light | Meaning |
| --- | --- |
| Green | An exact current official-source match. Not a safety guarantee or authentication of an incoming caller. |
| Red | Unverified: pause and check another source. This is **not proof of a scam**. |
| Neutral | Ready, checking, or unable to complete a check. An error is not a verdict. |

Caller ID can be spoofed. No live spam-reputation provider is currently
connected. Google Places helps discover business listings; it does not
provide a spam verdict or establish an official-source match.

## Deploy the website on Vercel

The repository includes a root [`vercel.json`](vercel.json) that builds
**only the website** and supports refreshing nested pages.

1. Commit and push the latest changes to GitHub.
2. Go to [Vercel's import page](https://vercel.com/new) and select this
   repository.
3. Leave **Root Directory** as `./` (the repository root), choose **Other**
   as the framework preset, and use **Node.js 22.x**.
4. Keep the settings supplied by `vercel.json`:

   | Setting | Value |
   | --- | --- |
   | Install Command | `pnpm install --frozen-lockfile` |
   | Build Command | `BASE_PATH=/ PORT=5173 pnpm --filter @workspace/phishing-trip-web run build` |
   | Output Directory | `artifacts/phishing-trip-web/dist/public` |

5. Click **Deploy** in Vercel.

No Google key or other environment variables are needed for this
**frontend-only** deployment. Do not select the website subfolder as the
root: it depends on shared files elsewhere in this repository.

### Current live-check limitation

The website can be hosted now, but **live number checks and directory data
on Vercel still require the separate public checking service**. Until it
is connected, API requests deliberately return an unavailable response,
not a fabricated safe/scam result.

Deploying the website does not deploy the API, database, Expo app or
browser extension. Keep provider credentials server-side; never put a
Google API key or private-service access token into browser code.

See the [full Vercel deployment guide](docs/vercel-deployment.md) for
connecting the approved public service later.

## Development

This is a pnpm workspace. Use the pnpm version pinned in the root
`package.json`.

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/phishing-trip-web run typecheck
BASE_PATH=/ PORT=5173 pnpm --filter @workspace/phishing-trip-web run build
```

The website build is written to
`artifacts/phishing-trip-web/dist/public`. In Replit, use the existing
website workflow for the preview; it supplies the `/phishing-trip/` base
path. The Vercel website uses `/`.

### Project guides

- [Website behavior, privacy and development](artifacts/phishing-trip-web/README.md)
- [Vercel deployment](docs/vercel-deployment.md)
- [Browser extension development](extensions/stillwater/README.md)
- [Browser extension installation](extensions/stillwater/INSTALL.md)

## Privacy and service limits

- Checks require explicit user action; typing or selecting a number does
  not automatically submit it.
- The browser extension checks the selected number rather than uploading
  browsing history or page contents.
- My Trips stores official contact references locally, not a history of
  checked numbers.
- Optional Google Places searches share the existing **10 upstream
  attempts per day across all users**; failures count toward that limit.
- An official listing is evidence, not a guarantee. If a check cannot
  finish, use contact details from the company's own official website.
