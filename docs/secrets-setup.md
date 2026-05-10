# Secrets And API Key Setup

This guide explains how to get every key, secret, client ID, token, and identifier needed for V1.

Create `.env` from `.env.example` first:

```bash
cp .env.example .env
```

Never commit `.env`.

## App Secrets

### `SESSION_SECRET`

Use any strong random string of at least 32 characters.

```bash
openssl rand -base64 32
```

### `WEBHOOK_SIGNING_SECRET`

Use a different random value.

```bash
openssl rand -base64 32
```

### `ENCRYPTION_KEY`

This must decode to exactly 32 bytes. Use:

```bash
openssl rand -base64 32
```

Store this carefully. If it is lost, encrypted OAuth refresh tokens cannot be recovered.

## Gemini

### `GEMINI_API_KEY`

1. Open Google AI Studio.
2. Go to API keys.
3. Create a new API key.
4. Copy it into `.env`.

### `GEMINI_LIVE_MODEL`

Use the currently available Gemini Live model string. The default in this repo is:

```text
gemini-3.1-flash-live-preview
```

If Google changes the exact model name, update only this environment variable.

## Twilio

### `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`

1. Open the Twilio Console.
2. Go to Account Info.
3. Copy Account SID.
4. Copy Auth Token.
5. Add both to `.env`.

### `TWILIO_PHONE_NUMBER`

1. In Twilio Console, go to Phone Numbers.
2. Buy or select a voice-capable number.
3. Copy the number in E.164 format, for example `+15125550123`.

### `TWILIO_WEBHOOK_BASE_URL`

Use your deployed API base URL, for example:

```text
https://voice.yourdomain.com
```

For local testing, use a tunnel such as ngrok or Cloudflare Tunnel and set the public HTTPS URL.

Twilio setup:

1. Open the Twilio phone number.
2. Under Voice Configuration, set incoming call webhook to:
   `https://your-api-domain.com/twilio/voice`
3. Use HTTP `POST`.
4. Add status callback if desired:
   `https://your-api-domain.com/twilio/status`

## Supabase

### `SUPABASE_URL`

1. Open Supabase.
2. Select the project.
3. Go to Project Settings, then API.
4. Copy Project URL.

### `SUPABASE_ANON_KEY`

1. Same Supabase API page.
2. Copy the anon public key.
3. Use this only in browser-safe code.

### `SUPABASE_SERVICE_ROLE_KEY`

1. Same Supabase API page.
2. Copy the service role key.
3. Use this only on the server.

### `DATABASE_URL`

1. Go to Supabase Project Settings.
2. Open Database.
3. Copy the connection string.
4. Use the pooled or direct connection depending on the deployment host.

### `SUPABASE_STORAGE_BUCKET`

Default:

```text
call-artifacts
```

The migration creates this private bucket if permissions allow it.

## Resend

### `RESEND_API_KEY`

1. Open Resend.
2. Go to API Keys.
3. Create a key with sending permission.
4. Copy it into `.env`.

### `RESEND_FROM_EMAIL`

1. Verify your sending domain in Resend.
2. Use a sender on that domain, for example:
   `Morgan Leasing <calls@yourdomain.com>`.

### `RESEND_REPLY_TO`

Use the email address where replies should go, usually the property manager inbox.

## Google Calendar

### `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable the Google Calendar API.
4. Configure OAuth consent screen.
5. Create OAuth Client ID.
6. Choose Web application.
7. Add an authorized redirect URI:
   `https://your-api-domain.com/google/oauth/callback`
8. Copy the client ID and client secret into `.env`.

### `GOOGLE_REDIRECT_URI`

Use the same callback URL from the OAuth client:

```text
https://your-api-domain.com/google/oauth/callback
```

### Calendar ID

1. Open Google Calendar.
2. Open the calendar settings.
3. Find Integrate calendar.
4. Copy Calendar ID.
5. Store it on the property or client calendar connection record.

### Refresh Token

1. Visit `/google/oauth/start` on the deployed API.
2. Sign in as the property manager or calendar owner.
3. Approve requested calendar scopes.
4. The callback returns token information.
5. Encrypt and store the refresh token in `calendar_connections`.

Production note: build a small admin UI flow for this before onboarding non-technical clients.

## Miro

### `MIRO_CLIENT_ID` and `MIRO_CLIENT_SECRET`

1. Open Miro Developer Platform.
2. Create an app.
3. Add required scopes:
   `boards:read` and `boards:write`.
4. Add redirect URI:
   `https://your-api-domain.com/miro/oauth/callback`
5. Copy Client ID and Client Secret.

### `MIRO_REDIRECT_URI`

Use:

```text
https://your-api-domain.com/miro/oauth/callback
```

### `MIRO_DEFAULT_BOARD_ID`

1. Open the client Miro board.
2. Copy the board URL.
3. The board ID is the value in the URL after `/board/`.
4. Store it in `.env` or the client record.

### Miro Access Token

V1 supports the provider boundary for Miro writes. For production, complete the OAuth callback storage so each client has an encrypted Miro access token. During internal testing, an approved developer access token can be added as `MIRO_ACCESS_TOKEN`.

## Owner/Admin Email

### `OWNER_NOTIFICATION_EMAIL`

Set this to your own email address. It receives the same call package as the client.

## Final Checklist

Before the first real call:

- `.env` exists and is not committed.
- Supabase migration has run.
- Twilio number points to `/twilio/voice`.
- Gemini API key works.
- Resend domain is verified.
- Google Calendar OAuth connection is stored.
- Miro board ID and token are ready.
- One test call logs transcript, audio, email, and Miro result.
