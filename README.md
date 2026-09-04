# TOR Radar (TOR Finder)

A platform that aggregates Thai government software procurement announcements (TOR)
from e-GP and BMA sources, uses AI to extract and classify key details, and matches
relevant opportunities to registered software companies.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Database:** MongoDB Atlas (with Vector Search)
- **AI:** Google Vertex AI (Gemini + Document AI)
- **Auth:** JWT / session-based

## Getting Started

### 1. Clone and install

\`\`\`bash
git clone <repo-url>
cd torfinder
npm install
\`\`\`

### 2. Set up environment variables

Copy the example file and fill in your own values:
\`\`\`bash
cp .env.example .env.local
\`\`\`
Ask a teammate for the MongoDB connection string and other secrets — never commit `.env.local`.

Required variables:
- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — secret used to sign auth session/JWT tokens

The app validates these at startup (see `frontend/src/lib/env.ts`) and fails fast with a clear error if any are missing.

### 3. Run the dev server

\`\`\`bash
npm run dev
\`\`\`
Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

\`\`\`
src/
├── app/ # Pages and API routes (Next.js App Router)
│ └── api/ # Backend endpoints
├── components/ # Reusable UI components
├── data/ # Mock data (being replaced by real DB calls)
└── lib/ # Shared utilities (e.g. MongoDB connection)
\`\`\`

## Branching & Commits

- `main` — always deployable
- `feature/<name>` — one branch per issue
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)

## Course Context

Built for Collaborative Software Process and Project Management (01219346),
Kasetsart University.
