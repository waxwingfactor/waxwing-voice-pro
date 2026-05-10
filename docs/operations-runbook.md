# Operations Runbook

## Local Development

1. Install dependencies.

```bash
npm install
```

2. Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

3. Fill in credentials using `docs/secrets-setup.md`.

4. Run checks.

```bash
npm run typecheck
npm test
```

5. Start the API.

```bash
npm run dev
```

6. Start the dashboard in a second terminal.

```bash
npm run dev:web
```

## Database Setup

Run the migration in Supabase:

```bash
supabase db push
```

Or paste `supabase/migrations/0001_initial.sql` into the Supabase SQL editor for a first manual setup.

After migration:

- Confirm `clients` exists.
- Confirm `properties` exists.
- Confirm `calls` exists.
- Confirm `call_audio_files` exists.
- Confirm `call-artifacts` storage bucket exists and is private.

## Twilio Setup

1. Deploy the API to a public HTTPS domain.
2. Open Twilio Console.
3. Select the phone number.
4. Set incoming voice webhook:
   `POST https://your-api-domain.com/twilio/voice`
5. Optional status callback:
   `POST https://your-api-domain.com/twilio/status`
6. Place a test call.

Expected verification:

- Twilio connects to `/twilio/media`.
- A call row is created.
- Transcript turns appear.
- Raw audio files are uploaded at call end.

## Google Calendar Setup

1. Configure Google OAuth credentials.
2. Visit `/google/oauth/start`.
3. Sign in as the calendar owner.
4. Store encrypted refresh token in `calendar_connections`.
5. Add `calendar_id` to relevant properties.

Expected verification:

- `find_showing_slots` returns open slots.
- `book_showing` creates an event.
- The showing row is stored.

## Resend Setup

1. Verify sending domain.
2. Add `RESEND_API_KEY`.
3. Add `RESEND_FROM_EMAIL`.
4. Place a test call.

Expected verification:

- `emails` table has a `sent` row.
- Client recipients receive summary, transcript, structured lead data, and raw audio links.
- Owner/admin recipient receives the same package.

## Miro Setup

1. Create the client Miro board.
2. Add board ID to configuration.
3. Visit `/miro/oauth/start`, approve the app, and add the returned
   `MIRO_ACCESS_TOKEN` and `MIRO_REFRESH_TOKEN` to Render.
4. Place a test call.

Expected verification:

- A Miro call frame is created with summary, next action, captured info,
  transcript excerpt, and audio links.
- Failed Miro sync is recorded without blocking email if token is missing.

## Test Call Script

Use this checklist during a real phone test:

1. Ask about a known address.
2. Ask one direct property fact, such as rent or pets.
3. Say you are interested in renting.
4. Answer qualification questions.
5. Give name and phone number.
6. Ask for a showing.
7. Ask one protected-class-sensitive question to verify safe refusal.
8. End the call.

Expected artifacts:

- One call row.
- Transcript turns for caller and agent.
- Qualification result.
- Lead capture fields.
- Compliance event.
- Inbound and outbound raw audio files.
- Email delivery row.
- Miro export row.

## Retry Policy

Initial V1:

- Calendar booking errors are reported to the caller as follow-up needed.
- Email failures are recorded and should be retried by an operator.
- Miro failures are recorded and do not block the call package.

Before production volume:

- Add `pg-boss` queues for post-call email and Miro sync.
- Retry transient provider failures once immediately.
- Retry email and Miro jobs with exponential backoff.
- Do not retry successful jobs.

## Rollback

If the voice agent fails during launch:

1. In Twilio, point the phone number to a simple forwarding TwiML Bin or Studio flow.
2. Keep Supabase online to preserve call data.
3. Disable calendar booking by removing calendar IDs from properties.
4. Disable Miro sync by removing the Miro token.
5. Fix and redeploy the API.
6. Place a full test call before pointing Twilio back.

## Human Review Triggers

Review a call manually when:

- The caller asks a protected-class-sensitive question.
- The caller asks for immediate access.
- The call transfers.
- Qualification status is `debatable`.
- Calendar booking fails.
- Email or Miro sync fails.
- The transcript has low confidence or missing required fields.
