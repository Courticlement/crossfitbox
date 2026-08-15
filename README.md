# Crossfit Box — Coach Planning

Tracks the box's weekly coach planning: assign coaches to classes, verify they
gave all the lessons planned for them, get alerted when someone is scheduled
over their weekly quota, and send yourself a weekly digest email.

Deployed publicly, so it's gated by login: a single shared admin password for
you, and a per-coach username (their name) + password for each coach — see
**Auth** below.

## Setup

1. **Install dependencies** (already done if you're reading this from the
   scaffolded project):
   ```bash
   npm install
   ```

2. **(Optional) Resend API key** — only needed for the weekly digest email
   button on the dashboard:
   - Create a free account at https://resend.com
   - Go to https://resend.com/api-keys and create a key, paste into `.env`
     as `RESEND_API_KEY`
   - Set `DIGEST_EMAIL_TO` to where the digest should land. The default
     `RESEND_FROM` (`onboarding@resend.dev`) only delivers to the email you
     signed up to Resend with — fine here, since the digest goes to you.

3. **Run the dev server**:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` locally, or the "Network" URL Next.js
   prints on startup from another device on the same WiFi (the LAN address
   is auto-detected — if it changes after a router reboot, just restart the
   server).

4. Add coaches from **Coaches**, define the weekly timetable in **Class
   Templates**, then use **Planning** to generate and assign each week.

## Day-to-day use (you, the head coach)

- **Class Templates**: the recurring weekly timetable. Check multiple days
  and/or both rooms to create the same slot across all of them in one go.
- **Planning**: pick a week, click "Generate this week from templates" to
  create that week's classes, then assign a coach to each one.
- **Coaches**: add/rename/remove coaches.
- **Dashboard**: set each coach's weekly quota, see assigned/done/missed
  counts, and spot over-quota alerts. Send the weekly digest email from here.

## How coaches report their lessons

Coaches log in at `/login` with their name and password (set/reset by you
from the **Coaches** page — see Auth below), landing on **My Classes**
(`/upload`): the whole week's planning as a live grid. They mark any class
DONE or MISSED (not just ones assigned to them), save, and it's reflected
immediately — no file upload involved.

## Auth

- **Admin** (`/admin-login`): one shared password, set via the `ADMIN_PASSWORD`
  env var. Change it any time by editing that value — no code change needed.
- **Coaches** (`/login`): each coach's unique `name` doubles as their
  username. They have no password until you set one for them from a coach's
  card on the **Coaches** page — that's also how you reset a forgotten one.
- Sessions are signed cookies (`AUTH_SECRET` env var signs them) valid for 30
  days. Changing `AUTH_SECRET` instantly logs everyone out.
- Both `ADMIN_PASSWORD` and `AUTH_SECRET` are required env vars — the app
  won't authenticate anyone without them set.

## Database

Prisma Postgres. After changing `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name <description>
```

## Notes on this phase

This covers coach planning only. Resawod integration (athlete counts, class
saturation) is intentionally out of scope for now — see the original plan
for the roadmap.
