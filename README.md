# JobCards.io

JobCards is an applicant-side ATS: a private workspace for screening job opportunities, making decisions, tracking applications, and learning which parts of the market respond best.

## Current product

- Public landing page at `index.html`
- Supabase email/password account creation and sign-in
- Authenticated workspace at `app.html`
- First-use preference onboarding
- Curated starter job deck
- Pass, Shortlist, and Pursue decisions
- Application pipeline with stage changes
- Early applicant analytics
- Persistent sessions with refresh-token handling
- Responsive desktop and mobile layouts

Starter jobs are labeled as samples. Live sourcing and AI scoring are the next product layer.

## Data and security

Supabase Auth manages accounts. Product data is stored in `profiles`, `user_preferences`, `jobs`, and `job_actions`.

Row-level security is enabled on every product table. Profiles, preferences, and pipeline activity are restricted to their owning user. The job catalog is readable only by authenticated users. Browser code contains only the Supabase publishable key; no secret or service-role key is exposed.

The versioned schema is in:

`supabase/migrations/20260916102800_create_jobcards_mvp.sql`

## Deployment

The repository deploys as a static GitHub Pages site from the root of `main`. Supabase Auth URL Configuration should use:

- Site URL: `https://jobcards.io/`
- Redirect URL: `https://jobcards.io/**`
