# Admin Dashboard

Admin Dashboard for Movie-streaming built with React + TypeScript + Vite.

## Stack

- React 19 + TypeScript
- React Router
- React Query
- Zustand (auth/session state)
- Firebase Auth + Firestore
- React Hook Form + Zod

## Setup

1. Install packages:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Fill Firebase values in .env.local.

4. Start dev server:

```bash
npm run dev
```

## Scripts

- `npm run dev`: Run development server.
- `npm run build`: Type-check and build production bundle.
- `npm run typecheck`: Run TypeScript project checks.
- `npm run lint`: Run ESLint.

## Source Layout

- `src/components/layout`: Dashboard shell and shared layout components.
- `src/lib`: Firebase config, Firestore service layer, query hooks, Zustand store.
- `src/pages`: Route-level pages.
- `src/types`: Data contract types aligned with Firestore collections.
