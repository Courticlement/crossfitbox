# Crossfit Box — Coach Planning

Tracks the box's weekly coach planning: assign coaches to classes, verify they
gave all the lessons planned for them, get alerted when someone is scheduled
over their weekly quota, and send yourself a weekly digest email.

No login. This runs on your local network only, and anyone who can reach it
has full access — that's an intentional tradeoff for simplicity, not an
oversight.

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

There's no coach login or dashboard — coaches use the **Coach Upload** page
(`/upload`), shared as a link on the box WiFi:

1. Pick their name and the week (defaults to the week that just ended).
2. Download their template — an Excel file pre-filled with their assigned
   classes for that week.
3. Fill in the **Status** column for each row (PLANNED / DONE / MISSED —
   there's a dropdown in the cell) and save.
4. Upload the file back on the same page.

The upload only updates classes that were actually assigned to the selected
coach for that week — rows that don't match are silently skipped, so
coaches can't edit each other's records even without a login.

## Database

SQLite, stored at `dev.db`. After changing `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name <description>
```

## Notes on this phase

This covers coach planning only. Resawod integration (athlete counts, class
saturation) is intentionally out of scope for now — see the original plan
for the roadmap.
