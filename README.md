# Internship Buddy

An all-in-one internship finder and application tracker for college students in India.

You answer a short profile quiz, starting with your CV. Internship Buddy then searches job boards and company career pages at once, ranks every opening against your profile, helps you check your fit and write your application, and gives you a board to track each application from *saved* to *offer*.

## Features

**Profile quiz**
- Starts with your CV: AI reads it and fills in your name, college, degree, branch, year, CGPA, skills, projects, experience and suggested roles
- Then seven short steps you confirm or correct; every step is validated, and a half-finished quiz survives a refresh
- Graduation year and current year are worked out from each other
- Final-year students and graduates see full-time jobs as well, by default

**CVs**
- Upload PDF, DOCX or TXT; skills and profile links are pulled out automatically
- Keep several versions (e.g. one for web roles, one for data roles) and pick a main one
- Record which CV you sent with each application, and see which version gets more replies
- **AI CV review** for any of your target roles: a score, missing keywords, sharper bullet points and fixes

**Discover**
- Searches up to 11 sources in parallel (see below); each fills in as soon as it answers
- Every listing gets a 0–100 match score with reasons: role, skills you have, location, stipend and freshness
- **Plain-English search**: type "remote React internships paying 10k+" and it sets the role, place, pay and keywords
- **AI fit check** on any listing: what you meet, what you lack, each eligibility rule (location, start date, graduation year), warning signs and what to highlight
- **Fake internship warnings**: rule-based checks on every card (fees, deposits, WhatsApp-only contact, "no interview" promises) plus a deeper AI check
- **Write your application**: Internshala's "Why should you be hired?" and availability answers, a cover letter, a cold email or a LinkedIn note, all from your real profile and CV
- The same opening on several boards is merged into one card

**Tracker**
- Kanban board: Saved → Applied → Test / Assignment → Interview → Offer → Not selected, with a stamp on every move
- Deadlines, next steps, contacts, notes, CV sent and full history for each application
- **Prep notes per company**: notes and a question bank shared by every application to that company
- **Reminders**: a "coming up" list, follow-up nudges after a week without a reply, AI follow-up emails, device notifications, and one-click export of everything to your calendar (.ics with alerts, or Google Calendar)
- **Save from any site**: a bookmark button that adds the job you are looking at (any career page, LinkedIn, Naukri, Wellfound) with role, company, location, pay and deadline filled in

**Insights**
- Funnel, applications per week, reply rate by board and by CV version, median days to a reply
- **Skills to learn next**: the skills current listings for your role ask for that you lack, and an AI learning plan with free resources

**Your data**
- Profile, CVs, tracker and prep notes live in your browser (IndexedDB); no account needed
- Download a JSON backup and restore it on another device

## Sources

| Source | Key | What it adds |
| --- | --- | --- |
| Internshala (omkar.cloud scraper) | `INTERNSHALA_API_KEY` | Indian internships with stipend, duration, skills and eligibility |
| Google Jobs (JSearch on RapidAPI) | `RAPIDAPI_KEY` | Jobs aggregated from many boards |
| LinkedIn (Jobs API on RapidAPI) | `RAPIDAPI_KEY` | LinkedIn internship and entry-level postings |
| Unstop (RapidAPI) | `RAPIDAPI_KEY` | Unstop internships |
| Company careers | none | Public Greenhouse, Lever, Ashby and SmartRecruiters boards of ~45 companies hiring in India (Paytm, Swiggy, PhonePe, Razorpay, Stripe, Rubrik, Sarvam AI, Groww…) |
| [Himalayas](https://himalayas.app) | none | Remote internships and entry-level roles open to India |
| [jobdataapi](https://jobdataapi.com) | none | Latest internships posted in India |
| Programs | none | Curated internship programmes and research fellowships with deadlines, from [India-Tech-Internships](https://github.com/iitian-vibes/India-Tech-Internships) (MIT) |
| [Careerjet](https://www.careerjet.com/partners/register/as-publisher) | `CAREERJET_API_KEY` (free) | Large India index with an internship filter |
| [Adzuna](https://developer.adzuna.com/signup) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (free) | India job index |
| [Jooble](https://in.jooble.org/api/about) | `JOOBLE_API_KEY` (free on request) | India job index |

Sources without a key are skipped and hidden. AI features use [Groq](https://console.groq.com/keys) (`GROQ_API_KEY`).

### Staying inside free limits

Several free plans are small (Unstop allows 6 calls a month, LinkedIn 50), so the server never calls an API it does not need to:

- Responses are cached on disk in `.data/` and reused until they go stale (6 hours to 5 days per source)
- Remaining quota is read from each API's rate-limit headers; a source stops being called before it runs out and its last saved results are shown instead
- Identical requests that arrive together share one upstream call
- AI answers are saved in the browser per listing, so reopening a listing does not call the AI again
- Listing text is screened for prompt injection before it reaches the AI
- The profile page shows how many calls are left for each source

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Cache Components) and React 19
- [shadcn/ui](https://ui.shadcn.com) on Radix, with Tailwind CSS 4
- [anime.js 4](https://animejs.com) for the stamps, card entrances and counters
- [Groq](https://groq.com) (`gpt-oss-120b`, `gpt-oss-20b`, Prompt Guard) for AI features, with structured JSON output
- Zustand + IndexedDB (`idb-keyval`) for local data
- `@dnd-kit/core` for the tracker board
- `unpdf` and `mammoth` for reading CVs

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Fill in the keys you have in `.env.local`, then:

```bash
npm run dev
```

Open http://localhost:3000.

## Project structure

```
src/
  app/
    page.tsx                         landing page
    onboarding/                      profile quiz
    (app)/discover/                  matched listings, AI search
    (app)/tracker/                   application board
    (app)/insights/                  analytics and skills to learn
    (app)/profile/                   profile, CVs, settings, backups
    save/                            "save from any site" window
    api/listings/[source]/           one route per source
    api/listings/[source]/details/   full description for one listing
    api/ai/[task]/                   AI tasks
    api/cv/                          CV text and skill extraction
    api/usage/                       remaining API calls
  components/                        UI, including shadcn/ui in components/ui
  lib/
    match.ts                         scoring and de-duplication
    scam.ts                          fake internship warning signs
    reminders.ts                     reminders and calendar export
    skills.ts                        skill dictionary and extraction
    taxonomy.ts                      roles, degrees, cities, colleges
    store.ts                         local data store
  server/
    sources.ts, sources-extra.ts     API clients and normalisers
    ats-boards.ts                    company career boards
    run-source.ts                    cache, quota guard and fallbacks
    ai.ts, ai-tasks.ts               Groq client, prompts and schemas
```

## Credits

The programmes list comes from [iitian-vibes/India-Tech-Internships](https://github.com/iitian-vibes/India-Tech-Internships), © 2026 AIVOLVIX PRIVATE LIMITED, MIT License. Listings link back to their original postings.
