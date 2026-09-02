# Funscapes Website

A responsive, interactive scroller for Funscapes visitors and partners. The
site combines the supplied Two Rivers 3D model with visitor experiences, the
Eye of Kenya story, group capabilities, and visit-planning information.

## Stack

- Next.js App Router
- React and TypeScript
- Three.js for the interactive park model
- Plain CSS for the visual system and responsive layout

## Local development

Use Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Before committing a change, verify the production build:

```bash
pnpm build
pnpm lint
```

## Deploy with GitHub and Vercel

1. Push this directory to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Vercel will detect Next.js automatically. Keep the default build and output
   settings, then deploy.
4. Add the production domain in the Vercel project settings when ready.

The current site requires no environment variables or external services.

## Content and assets

The supplied park visualisations and 3D model live in `public/`. They are
concept/architectural visuals rather than documentary photography. Confirm
current operating hours, ticketing, branch status, contact details, and any
market-leading claims with Funscapes before a public launch.
