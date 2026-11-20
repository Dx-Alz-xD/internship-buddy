# Internship Buddy

An all-in-one internship finder and application tracker for college students in India.

You answer a short profile quiz (who you are, college, year, CV, target roles, skills and preferences). Internship Buddy then searches **Internshala, Unstop, LinkedIn and Google Jobs** at once, ranks every opening against your profile, and gives you a board to track each application from *saved* to *offer*.

## Features

**Profile quiz**
- Seven steps: about you, college, CV, roles, skills, preferences, review
- Every step is validated before you can move on, and a half-finished quiz survives a page refresh
- Graduation year is worked out from your degree and current year
- Final-year students and graduates see full-time jobs as well as internships, by default
- A student card fills in live as you answer

**CV reading**
- Upload a PDF, DOCX or TXT (up to 5 MB)
- Skills, GitHub, LinkedIn and portfolio links are pulled out and pre-filled
- The file is kept in your browser; the server reads its text once and stores nothing

**Discover**
- Searches four job boards in parallel; each one fills in as soon as it answers
- Every listing gets a 0–100 match score with the reasons behind it: role, skills you have, location, stipend, how recent it is
- Flags listings that ask for senior experience, pay below your minimum, or are full-time when you want internships
- The same opening posted on several boards is merged into one card
- Switch between your target roles; filter by work mode, type and stipend; sort by match, newest or pay
- Hide listings you are not interested in

**Tracker**
- Kanban board: Saved → Applied → Test / Assignment → Interview → Offer → Not selected
- Drag cards between columns (mouse, touch or keyboard); each move stamps the card
- Deadlines, next steps, contacts, notes and a status history for every application
- "Next 14 days" list of upcoming deadlines and interviews
- Stats: applied, response rate, interviews, offers
- Add applications you found elsewhere (referrals, campus drives)

**Your data**
- Profile, CV and tracker live in your browser (IndexedDB); no account needed
- Download a JSON backup and restore it on another device
- Delete everything in one step

## Staying inside the free API limits

The free plans are small (Unstop allows 6 calls a month), so the server never calls an API it does not need to:

| Source | Free plan | Results reused for |
| --- | --- | --- |
| Internshala (omkar.cloud) | 1,000 calls / month | 6 hours |
| Google Jobs (JSearch) | 200 calls / month | 24 hours |
| LinkedIn (Jobs API) | 50 calls / month | 48 hours |
| Unstop | 6 calls / month | 5 days, shared by everyone |

- Responses are cached on disk in `.data/` and reused until they go stale
- The remaining quota is read from each API's rate-limit headers; a source stops being called before it runs out and its last saved results are shown instead
- Identical requests that arrive together share one upstream call
- The profile page shows how many calls are left for each source

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Cache Components) and React 19
- [shadcn/ui](https://ui.shadcn.com) on Radix, with Tailwind CSS 4
- [anime.js 4](https://animejs.com) for the stamps, card entrances and counters
- Zustand + IndexedDB (`idb-keyval`) for local data
- `@dnd-kit/core` for the tracker board
- `unpdf` and `mammoth` for reading CVs

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
# Internshala scraper key from https://www.omkar.cloud/tools/internshala-scraper/about
INTERNSHALA_API_KEY=
# One RapidAPI key subscribed to JSearch, Unstop API and Jobs API (jobs-api14)
RAPIDAPI_KEY=
```

Then run:

```bash
npm run dev
```

Open http://localhost:3000. Any source without a key is skipped and the rest still work.

## Project structure

```
src/
  app/
    page.tsx                 landing page
    onboarding/              profile quiz
    (app)/discover/          matched listings
    (app)/tracker/           application board
    (app)/profile/           profile, CV, backups, API usage
    api/listings/[source]/   one route per job board
    api/cv/                  CV text and skill extraction
    api/usage/               remaining API calls
  components/                UI, including shadcn/ui in components/ui
  lib/
    match.ts                 scoring and de-duplication
    skills.ts                skill dictionary and extraction
    taxonomy.ts              roles, degrees, cities, colleges
    store.ts                 local data store
  server/
    sources.ts               API clients and normalisers
    run-source.ts            cache, quota guard and fallbacks
    store.ts                 disk cache and quota ledger
```
