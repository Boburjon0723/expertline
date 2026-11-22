# ExpertLine

A consultation platform that connects clients with experts — lawyers, tutors, psychologists and mentors — and handles the whole session in one place: chat, booking, a video call, and payment held in escrow until the session is done.

One product, three clients: **Web** (Next.js), **Desktop** (Electron) and **Mobile** (Expo / React Native), all on the same backend.

> Public showcase copy of the project. Real credentials are never committed; configure everything through `.env` files (see `.env.example` in each app).

## Features

- **Real-time messaging** — direct chats, groups and channels, pinned messages, media viewer, contacts (Socket.IO with a Redis adapter for horizontal scaling)
- **Video consultations** — 1-on-1 sessions on LiveKit
- **Wallet and escrow** — internal token balance, top-ups, payment locked when a session is booked and released or refunded afterwards, dispute handling
- **Experts and jobs** — expert profiles and services, booking, a jobs board for client requests
- **Auth** — JWT with refresh tokens, Telegram OTP verification bot, optional end-to-end key bootstrap
- **Admin panel** — users, experts, transactions, top-ups, disputes, jobs, login history, settings
- **Multi-language UI**

## Architecture

```
frontend/      Next.js 16 + React 19 + Tailwind 4, also packaged with Electron
mobile-app/    Expo / React Native client
backend/       Node.js + Express 5 API, Socket.IO, LiveKit server SDK
messenjrali-tasdiqlash-bot/   Telegram OTP verification bot
docs/, ARCHITECTURE.md        full architecture write-up
```

Backend stack: PostgreSQL (Supabase), Redis, JWT, bcrypt, Helmet, rate limiting, Multer uploads, Firebase Admin for push notifications. Deployed with Docker on Railway; the web app on Vercel.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the data model, real-time layer, escrow flow and deployment details.

## Running locally

```bash
# backend
cd backend && cp .env.example .env && npm install && npm run dev

# web
cd frontend && cp .env.example .env.local && npm install && npm run dev

# mobile
cd mobile-app && cp .env.example .env && npm install && npx expo start
```
