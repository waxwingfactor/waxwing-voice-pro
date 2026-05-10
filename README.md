# Waxwing Voice Pro

Waxwing Voice Pro is an AI leasing assistant for property managers. It connects Twilio phone calls to Gemini Live, answers property-specific questions from a database, qualifies rental interest, books showings on Google Calendar, stores transcripts and raw audio, sends post-call emails through Resend, and updates a Miro leasing command board.

## Quick Start

1. Copy `.env.example` to `.env`.
2. Follow `docs/secrets-setup.md` to gather credentials.
3. Run `npm install`.
4. Run `npm run typecheck` and `npm test`.
5. Start the API with `npm run dev`.
6. Configure the Twilio voice webhook to `POST /twilio/voice`.

## Render Deployment

Deploy the realtime voice API as the Render Web Service.

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/health`

The root production build is API-only because Twilio Media Streams need the
Fastify WebSocket service. The dashboard can be deployed as a separate web
service later with `npm run build:web`.

The repo is intentionally split into small packages so the voice gateway, admin UI, provider adapters, and core leasing logic can grow independently.
