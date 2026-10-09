# Adaptive AI

An Expo Android frontend prototype for a multimodal assistant that adapts its interface to each user's interaction and accessibility preferences.

## Run & Operate

- `PORT=23262 pnpm --filter @workspace/adaptive-ai run dev` — run the Expo app locally; the Replit workflow `Adaptive AI Mobile` runs this automatically and serves the web/Expo Go preview.
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- The current mobile prototype stores authentication/profile, preferences, history, and schedule data locally with AsyncStorage; the API/database service is not required for the Expo preview.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/adaptive-ai/app/(tabs)/` — Home, Camera, Assistant, History, and Settings screens
- `artifacts/adaptive-ai/src/context/PreferencesContext.tsx` — persisted adaptive preferences and local history
- `artifacts/adaptive-ai/src/services/aiService.ts` — replaceable mock AI/OCR service boundary
- `artifacts/adaptive-ai/src/components/UI.tsx` — shared mobile UI primitives
- `artifacts/adaptive-ai/constants/colors.ts` — centralized product theme tokens

## Architecture decisions

- The first build is frontend-only; AI/OCR calls intentionally use realistic local mocks until the FastAPI contract is connected.
- Preferences and history use AsyncStorage so adaptive changes are immediate and survive app restarts.
- The Home screen derives voice-first, camera-first, and simplified presentation from the shared preference state rather than screen-local flags.

## Product

Adaptive AI provides a touch-friendly Home dashboard, native camera capture and gallery selection, mock OCR analysis, conversational Assistant responses, text-to-speech response playback, locally persisted History, and settings for interaction mode and accessibility.

## User preferences

The product should remain a polished Android-first frontend prototype and must not embed provider API keys or backend implementation details.

## Gotchas

The Expo workflow is the source of truth for previewing the mobile app; native capabilities such as camera permissions are handled at runtime and should degrade gracefully when unavailable.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
