# ExpertLine — kod bazasi xaritasi

Holat: 2026-11-23, `mvp-refactor` branch (`ca0b987 Initial public release` ustida).
Manba: kodning o'zi va lokal bazadagi haqiqiy sxema (ARCHITECTURE.md emas). 1–4-bosqichlar shu xaritaga tayanadi.

## 1. Lokal ishga tushirish (tekshirilgan)

| Narsa | Qiymat |
|---|---|
| Repo yo'li | `~/Desktop/expertline` (yo'lda `\` bo'lmasligi shart — Node ESM yuklovchisi yiqiladi) |
| PostgreSQL | Docker `expertline-pg`, `postgres:16`, `localhost:5432`, db `expertline`, parol `dev` |
| Redis | Docker `expertline-redis`, `redis:7`, `localhost:6379` |
| Backend | `cd backend && npm run dev` → `http://localhost:4000`, `GET /api/health` |
| Frontend | `cd frontend && npm run dev` → `http://localhost:3000` (`.env.local`) |
| Mobile | `cd mobile-app && npx expo start` (`.env`: `EXPO_PUBLIC_API_URL=http://localhost:4000`) |
| Bot | `BOT_TOKEN` siz ishlamaydi — lokal ishga tushirilmaydi |

Sxemani noldan qurish tartibi (hujjatdagidan farq qiladi):

1. `psql < backend/database_schema.sql` — 188-qatorda ortiqcha `推` belgisi bor, xato beradi, lekin jadvallar yaratiladi.
2. Backendni bir marta ishga tushirish — `runAutoMigration()` (`backend/src/index.ts:57`) qolgan jadvallarni yaratadi.
3. `npx ts-node backend/scripts/migrate-features.ts` — `specialist_notes`, `whiteboard_snapshots`.
4. `npx ts-node backend/scripts/migrate_service_sessions.ts` — `service_sessions` (kod ishlatadi, auto-migratsiya yaratmaydi).
5. `psql < backend/migrations/ALL_RECENT_MIGRATIONS.sql` — 3-qadamsiz `specialist_notes` xatosi beradi.

Lokal ishga tushirish uchun kiritilgan kod o'zgarishi: `backend/src/config/firebase.ts` — Firebase kaliti bo'lmasa server yiqilmaydi, `bucket`/`db` ishlatilgandagina xato beradi.

Testlar: backend `npx vitest run` → 17 fayl, 71 test, hammasi o'tadi. Vitest allaqachon o'rnatilgan.

## 2. Backend route'lar (`backend/src/app.ts:110-137`)

### To'lov / pul (1-bosqichda olib tashlanadi)

| Mount | Route fayl → controller | Endpointlar |
|---|---|---|
| `/api/token` | `token.routes.ts` → `token.controller.ts` | `GET /balance`, `GET /config`, `POST /transfer`, `POST /setup`, `POST /change-pin`, `POST /recovery`, `POST,GET /topup`, `GET /transactions` |
| `/api/wallet` | `wallet.routes.ts` → `wallet.controller.ts` | `GET /balance`, `POST /subscribe`, `POST /book`, `POST /complete`, `GET /my-bookings`, `POST /booking/reject`, `GET /settings`, `POST /subscribe-to-mentor`, `GET /subscription-status` |
| `/api` | `escrow.routes.ts` → `escrow.controller.ts` | `POST /escrow/hold`, `/escrow/release`, `/escrow/refund` |
| `/api/p2p` | `p2p.routes.ts` → `p2p.controller.ts` | e'lonlar va savdolar (`/`, `/my-ads`, `/trades`, `/trade/*`, `/trade-chat/:id`) |
| `/api/listing-deals` | `listing-deal.routes.ts` → `listing-deal.controller.ts` | `/chat/:chatId`, `/request`, `/pay`, `/mark-done`, `/complete`, `/dispute`, `/cancel` |
| `/api/expenses` | `expense.routes.ts` → `expense.controller.ts` | shaxsiy xarajatlar trekeri (`/`, `/stats`, `/:id`) |
| **`/api/settlement/v1`** | `settlement.routes.ts` → `settlement.controller.ts`, `settlement.service.ts`, `settlementAuth.middleware.ts` | `/wallets/link`, `/wallets/:companyId/balance`, `/hold`, `/release`, `/refund`, `/transactions` — **rejada yo'q** |
| `/api/service` | `service.routes.ts` → `service.controller.ts` | `POST /initiate` (escrow hold), `/complete`, `/cancel`, `/start-ongoing`, `GET /my-sessions` — **bron oqimining yadrosi, o'chirilmaydi, qayta yoziladi** |
| `/api/admin` | `admin.routes.ts` | `GET /topups`, `POST /topups/approve|reject`, `GET /transactions`, `GET /escrow/disputes`, `POST /escrow/resolve` |

Servislar: `token.service.ts` (balans, `bookSession`, `subscribeToExpert/Mentor`, `MENTOR_MONTHLY_MALI`), `escrow.service.ts` (+ `escrow.authz.test.ts`), `settlement.service.ts`, `consultSession.service.ts`, `consultPanel.service.ts`, `panelInvite.service.ts`, `listingPrivacy.service.ts` (oxirgi to'rttasi `service_sessions` bilan ishlaydi).

`index.ts` dagi fon ishi `releaseExpiredBookings` `listing_service_deals` ga murojaat qiladi.

Socket `balance_updated` emit qiladigan joylar: `socket/socket.service.ts`, `p2p`, `listing-deal`, `service`, `admin`, `wallet`, `token` controllerlari, `token.service.ts` (jami 19 ta). Shuningdek `listing_deal_updated` (12), `service_session_updated` (9).

Env: `MENTOR_MONTHLY_MALI`, `SERVICE_COMMISSION_PERCENTAGE`, `SETTLEMENT_SECRET_PEPPER`, `SETTLEMENT_COMMISSION_RATE`.

### Auth (`auth.routes.ts` → `auth.controller.ts`, mount `/api`)

`POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/start-telegram-link`, `/auth/start-telegram-havolasi`, `/auth/link-telegram`, `/auth/request-reset`, `/auth/confirm-reset`, `/auth/registration-status`, `/auth/verify-registration`, `/auth/resend-registration-otp`.

- Parol: bcrypt (`auth.controller.ts:122`, `:184`).
- Refresh token bcrypt bilan hash qilinib `users.refresh_token` da saqlanadi (`:36-39`, tekshiruv `:582`) ✓.
- OTP: `phone_verification_codes` (ro'yxatdan o'tish), `password_reset_codes` (reset) — kod ochiq matnda saqlanadi, urinishlar soni hisoblanmaydi.
- Kod yetkazish: backend → bot `BOT_SERVICE_URL` + `BOT_CONTROL_TOKEN` (`:83`). Bot: `/internal/send-registration-code`, `/internal/send-reset-code`.
- Bot → backend: `POST /api/bot/update-phone` (`botApi.routes.ts:12`, bot `BOT_API_TOKEN` yuboradi).
- Middleware: `auth.middleware.ts` (`authenticateToken`, `requireAdmin` — DB'dan `role='admin'` tekshiradi ✓), `csrf.middleware.ts`, `rateLimit.middleware.ts` (`express-rate-limit` + `rate-limit-redis` allaqachon o'rnatilgan).

### Sessiyalar va video

- `session.routes.ts`: `GET /sessions/history`, `/sessions/:id/live`, `/sessions/:id/chat`, `POST /sessions/:id/record/start|stop`, `/sessions/:id/recording-done`.
- `specialist.routes.ts`: kurslar, guruhlar, qaydlar, whiteboard, `PATCH /sessions/:id/close`, `/consult/*`, `/lesson-start`, `/mentor/*`.
- `livekit.routes.ts` + `services/livekit.access.ts` (consult-lobby xonalari, rol aniqlash) — hozir to'lov holatiga qarab kirishni cheklamaydi.

### Boshqa

`user`, `chat`, `jobs`, `media`, `notification` (+ `push.service.ts`), `specialists`, `upload` (Firebase), `quiz`, `reviews`, `desktop`, `bots`, `crypto` (E2E kalitlari — to'lov emas), `proxy`, `app-settings`, `health`.

## 3. Jadvallar (lokal bazada 36 ta)

| Guruh | Jadvallar |
|---|---|
| Pul (kod uziladi, jadval qoladi) | `token_balances`, `platform_balance`, `escrow`, `transactions`, `company_wallets`, `settlement_transactions`, `settlement_wallet_links`, `settlement_nonces`, `listing_service_deals`, `expenses`, `student_mentor_subscriptions` |
| Auth | `users`, `user_profiles`, `phone_verification_codes`, `password_reset_codes`, `admin_login_audit`, `security_event_audit`, `user_crypto_keys` |
| Sessiya / bron | `service_sessions`, `sessions`, `live_sessions`, `session_materials`, `services`, `expert_reviews`, `specialist_notes`, `whiteboard_snapshots`, `quizzes` |
| Chat | `chats`, `chat_participants`, `chat_messages`, `messages`, `user_contacts`, `notifications`, `push_tokens`, `bots` |
| Boshqa | `jobs`, `job_categories`, `platform_settings` |

Asosiy ustunlar:

- `users`: `phone!`, `password_hash!` (NOT NULL), `name!`, `surname`, `age` (int, tug'ilgan sana yo'q), `role`, `refresh_token`, `is_expert_active`, `subscription_end_date`, `telegram_chat_id`, `telegram_link_code`, `phone_verified`.
- `user_profiles`: `is_expert`, `profession`, `specialization`, `service_price`, `hourly_rate`, `currency`, `pricing_model`, `services_json`, `languages`, `rating`, `verified_status`, `working_hours` (matn), hujjat URL'lari, `expert_fee_total`.
- `services`: `provider_id`, `category`, `title`, `price_mali!`, `duration_minutes`, `rating`, `total_bookings`.
- `service_sessions`: `id` (int), `expert_id`, `client_id`, `chat_id`, `amount_mali`, `status` (enum `initiated|ongoing|completed|cancelled|disputed`), `started_at`, `completed_at`. **Rejalashtirilgan vaqt ustuni yo'q.**
- `sessions`: `id` (varchar), `service_id`, `provider_id`, `client_id`, `escrow_id`, `video_url`, `platform`, `status`, `started_at`, `ended_at`, `metadata`.

## 4. Web (`frontend/src`)

Sahifalar (`app/`): `/` (`page.tsx`), `/login`, `/register`, `/messages` (`MessagesPageContent.tsx` — **103 KB**, asosiy ilova shu yerda), `/wallet`, `/AdminZero0723s` (33 KB + `tabs/` — allaqachon bo'lingan).

To'lovga tegishli fayllar:

| Fayl | Nima chaqiradi |
|---|---|
| `app/wallet/page.tsx` | `/api/token/*`, `/api/p2p/trades` |
| `components/chat/WalletPanel.tsx` | `/api/token/*`, `/api/p2p/*` |
| `components/chat/wallet/*` | `WalletHistoryCard`, `WalletPinSetupCard`, `WalletSendModal`, `WalletTopUpModal`, `WalletWithdrawModal`, `walletHelpers.ts` |
| `components/chat/profile/ProfileWalletView.tsx`, `SendCoinModal.tsx`, `components/SendTokenModal.tsx`, `components/ui/GlassTokenCard.tsx` | balans / o'tkazma UI |
| `components/chat/ListingDealBar.tsx` | `/api/listing-deals/*` |
| `components/chat/ExpenseTracker.tsx` | `/api/expenses/*` |
| `components/chat/MessageBubble.tsx` | `/api/listing-deals/pay`, `/api/service/initiate`, `/api/wallet/subscribe-to-mentor`, `/api/wallet/subscription-status` |
| `components/chat/ProfileViewer.tsx` | `/api/wallet/balance`, `/api/wallet/subscribe` |
| `components/chat/ChatWindow.tsx` | `/api/p2p/trade/`, `/api/service/my-sessions` |
| `components/chat/ChatPaymentStatusCard.tsx`, `lib/chat-payment-status.ts` | chatdagi to'lov holati kartasi |
| `components/dashboard/RoomAccessGate.tsx`, `MessagesPageContent.tsx`, `ChatMessageList.tsx` | `/api/wallet/subscription-status` |
| `components/dashboard/SpecialistDashboard.tsx` | `/api/service/start-ongoing` |
| `app/AdminZero0723s/tabs/AdminTransactionsTab.tsx`, `AdminTopUpsTab.tsx`, `AdminDisputesTab.tsx` | admin pul bo'limlari |
| `components/BookingModal.tsx` | **hech qayerda import qilinmagan** (o'lik kod) |

Auth: `app/login/page.tsx` (`login`, `request-reset`, `confirm-reset`), `app/register/page.tsx` (`register`, `registration-status`, `verify-registration`, `resend-registration-otp`), `components/auth/AuthSessionRefresh.tsx`, `lib/api.ts` (`refresh`, `logout`), `lib/auth-storage.ts`. Admin sahifasi ham `/api/auth/login` (parol) bilan kiradi.

Tarjimalar: `lib/translations.ts`, `lib/translations-ru-missing.ts` (wallet/MALI matnlari ham shu yerda).

## 5. Mobile (`mobile-app`)

Expo 54 / RN 0.81, `@react-navigation/native` 7, kirish nuqtasi `App.tsx`. Ekranlar: `Login`, `Register`, `Passcode`, `Messages`, `ChatDetail`, `ChatPeerInfo`, `ExpertDetail`, `Profile`, `Wallet`, `Finance`, `Jobs`, `Settings` va sozlamalar ekranlari.

To'lovga tegishli: `src/features/dashboard/screens/WalletScreen.tsx`, `src/features/chat/wallet-service.ts` (`/api/token/*`), `src/features/chat/p2p-service.ts` (`/api/p2p/*`), `src/features/chat/components/ListingDealBar.tsx`, `src/features/finance/ExpenseTrackerScreen.tsx`, `src/features/dashboard/api.ts` (`/api/token/balance|transactions`, `/api/wallet/balance`), `src/features/chat/service.ts` (`/api/service/initiate`, `/api/wallet/subscribe-to-mentor|subscription-status`). Wallet'ga olib boruvchi tugmalar: `App.tsx`, `MessagesMenuDrawer.tsx`, `ChatHeaderMoreMenu.tsx`, `chat-shell-menu.ts`, `ProfileScreen.tsx`, `ExpertDetailScreen.tsx`, `DashboardViews.tsx`.

Auth: `src/features/auth/screens/LoginScreen.tsx`, `RegisterScreen.tsx`, `PasscodeScreen.tsx`, `src/features/auth/service.ts` (`/api/auth/login|register`), `src/lib/api.ts` (`refresh`).

## 6. Reja bilan kod o'rtasidagi farqlar (qaror kerak)

1. **Bron birligi.** Reja `sessions` jadvaliga `payment_status` qo'shishni aytadi. Kodda haqiqiy "bron" — `service_sessions` (chatdan `/api/service/initiate`, escrow bilan). `sessions` — video yozuvlari uchun, `/api/wallet/book` esa `transactions` ga yozadi va hech bir klient uni chaqirmaydi.
2. **Vaqt slotlari yo'q.** Hech bir jadvalda rejalashtirilgan sessiya vaqti yoki mutaxassisning bo'sh vaqtlari yo'q (`working_hours` — erkin matn). 3-bosqichdagi "eng yaqin bo'sh vaqt", "Bron: xizmat → vaqt", "Qo'shilish 10 daqiqa oldin" va 24 soat/15 daqiqa eslatmalari uchun yangi model kerak.
3. **Settlement API** (`/api/settlement/v1`, `company_wallets`, `settlement_*`) rejadagi ro'yxatda yo'q, lekin to'lov tizimining bir qismi.
4. **Mentor obunasi** (`student_mentor_subscriptions`, `subscribe-to-mentor`, `RoomAccessGate`) — MALI bilan ishlaydi; to'lovsiz versiyada guruh darslariga kirish qanday bo'lishi aniqlanishi kerak.
5. **Narx ustunlari** `price_mali`, `amount_mali`, `service_price`, `hourly_rate` — reja "so'm, butun son"ni so'raydi.
6. **Admin login** parol bilan; 2-bosqichda parol olib tashlansa, admin ham OTP orqali kirishi kerak.
7. **Tug'ilgan sana** yo'q — faqat `users.age` (int). `birth_date` va `is_minor` yangi ustun bo'ladi.
8. Admin sahifasi allaqachon tab'larga bo'lingan (33 KB, rejada ~101 KB). Bo'lish kerak bo'lgan katta fayl — `MessagesPageContent.tsx` (103 KB).

## 7. 4-bosqich uchun oldindan topilganlar

- CORS: `backend/src/config/corsOrigins.ts:11-34` — `*.vercel.app` sukut bo'yicha qo'shiladi (`CORS_ALLOW_VERCEL=false` o'chiradi). Socket uchun ham (`index.ts:19`).
- Admin: `requireAdmin` server tomonida bor ✓; yo'l hali `/AdminZero0723s`.
- Refresh token hash ✓; access/refresh secret'lar alohida env (`JWT_SECRET`, `JWT_REFRESH_SECRET`) ✓.
- `NODE_TLS_REJECT_UNAUTHORIZED` 32 joyda (asosan `backend/scripts/`) — TLS tekshiruvini o'chirish holatlari ko'rib chiqilishi kerak.
- Ildizda `fix_dashboard.py`, `stitch_three_column_marketplace_interface/`; backend ildizida ko'p bir martalik skriptlar (`check-db-content.js`, `seed-db.js`, `verify_listing_fix.js` va h.k.).
- `.gitignore` `**/uploads/`, `.env*`, `serviceAccountKey.json` ni ignore qiladi ✓.
- `backend/package-lock.json` `package.json` bilan mos emas edi (`npm ci` ishlamadi, `npm install` bilan yangilandi).
