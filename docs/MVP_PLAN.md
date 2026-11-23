# ExpertLine — Claude Code uchun ish rejasi

Nov 23, 2026

## Maqsad va kontekst

ExpertLine'ni to'lovsiz, parolsiz va mutaxassis topishga qaratilgan MVP'ga aylantiramiz; ish 4 bosqichda, har biri alohida branch va PR bilan qilinadi.

ExpertLine — mijozlarni mutaxassislar (psixolog, yurist, ustoz, mentor) bilan bog'laydigan platforma: chat, bron, LiveKit video. Monorepo: `backend/` (Node.js + Express 5 + Socket.IO, PostgreSQL, Redis), `frontend/` (Next.js 16 + Electron), `mobile-app/` (Expo / React Native), `messenjrali-tasdiqlash-bot/` (Telegram OTP bot).

Qabul qilingan qarorlar:

- **Til va framework o'zgarmaydi.** Node.js qoladi; Go'ga ko'chirish yo'q. Tezlik muammosi o'lchangandagina qayta ko'rib chiqiladi.
- **Ilova ichida to'lov yo'q.** MALI token, P2P, escrow, wallet olib tashlanadi. Mijoz mutaxassisga to'g'ridan-to'g'ri oldindan to'laydi, platforma faqat to'lov holatini kuzatadi.
- **Ro'yxatdan o'tish Telegram'dek:** telefon → kod → profil. Parol yo'q.
- **UI marketplace'ga aylanadi:** asosiy ish — mutaxassisni topib, bron qilish. Messenjer ikkinchi darajaga tushadi.

> Muhim: bu reja ARCHITECTURE.md asosida yozilgan. Har bosqichdan oldin haqiqiy fayllar tekshiriladi va reja kodga moslanadi. Kodga asoslangan xarita: [CODEBASE_MAP.md](CODEBASE_MAP.md).

## 0-bosqich: repo, paketlar va lokal ishga tushirish

Natija: uchala ilova lokal ishlaydi, `mvp-refactor` branch ochilgan, kod bazasi xaritasi `docs/CODEBASE_MAP.md` da yozilgan.

1. Talablarni tekshirish: Node.js 20+, npm, Git, Docker (PostgreSQL va Redis uchun).
2. Klonlash va `mvp-refactor` branch.
3. Lokal baza va Redis (Docker):
   ```
   docker run -d --name expertline-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=expertline -p 5432:5432 postgres:16
   docker run -d --name expertline-redis -p 6379:6379 redis:7
   ```
4. Paketlar: har bir ilovada `npm install` (lock fayl bo'lsa `npm ci`).
5. `.env` fayllar: `.env.example` dan nusxa, faqat lokal qiymatlar. LiveKit, AWS, Firebase kalitlari bo'sh.
6. Sxema: `cd backend && npm run db:migrate` (Prisma migratsiyalari, `backend/prisma/migrations/`). Backend ishga tushganda `runAutoMigration()` ham ishlaydi va seed qatorlarni yozadi.
7. Ishga tushirish: backend `npm run dev`, frontend `npm run dev`, mobile `npx expo start`. `GET /api/health` javob berishi kerak.
8. Kod xaritasi: to'lov, auth va asosiy ekranlarga tegishli fayllar, route'lar va jadvallar → `docs/CODEBASE_MAP.md`.

Taqiqlar: haqiqiy production kalitlari va `.env` fayllar hech qachon commit qilinmaydi; production bazasiga ulanilmaydi.

## 1-bosqich: to'lov tizimini olib tashlash

Natija: ilovada pul, token va balans yo'q; bron qilishda mijoz mutaxassisga to'g'ridan-to'g'ri to'laydi, ilova faqat to'lov holatini ko'rsatadi.

Olib tashlanadi yoki o'chirib qo'yiladi:

| Qatlam | Nima |
|---|---|
| Backend route'lar | `/api/token`, `/api/wallet`, `/api/escrow`, `/api/p2p`, `/api/listing-deals`, `/api/expenses` |
| Backend servislar | `token.service.ts`, `escrow.service.ts`, oylik `MENTOR_MONTHLY_MALI` hisobdan yechish |
| Socket | `balance_updated` event |
| Web | wallet, top-up, P2P sahifalari; admin panelda tranzaksiya, top-up, nizo bo'limlari |
| Mobile | Wallet ekrani va unga olib boradigan tugmalar |
| Env | `SERVICE_COMMISSION_PERCENTAGE`, `MENTOR_MONTHLY_MALI` |

Jadvallar (`token_balances`, `escrow`, `transactions`, `platform_balance`) o'chirilmaydi: avval kod ulardan uziladi, jadvallarni tashlash alohida migratsiyada, keyinroq va egasining ruxsati bilan qilinadi.

O'rniga qo'shiladi — bron uchun to'lov holati:

1. Mutaxassis profiliga to'lov ma'lumoti: `payment_link` (Click/Payme havola) va/yoki `payment_card_note` (matn), `prepay_percent` (0–100), `cancellation_policy` (matn).
2. `sessions` jadvaliga `payment_status`: `awaiting_payment` → `client_marked_paid` → `confirmed` (yoki `cancelled`), ixtiyoriy `payment_receipt_url`.
3. API: mijoz `POST /api/sessions/:id/mark-paid` (chek bilan yoki cheksiz), mutaxassis `POST /api/sessions/:id/confirm-payment`. Faqat sessiya egalari chaqira oladi.
4. Video sessiya faqat `confirmed` holatda ochiladi.
5. Har bir holat o'zgarishida ikkala tomonga bildirishnoma (socket + push).

Sessiya narxi faqat ko'rsatish uchun saqlanadi (so'm, butun son); ilova pul hisoblamaydi.

## 2-bosqich: Telegram'dek ro'yxatdan o'tish

Natija: yangi foydalanuvchi 3 ekranda, parolsiz, taxminan 30 soniyada ichkariga kiradi; ro'yxatdan o'tish va kirish bitta oqim.

Ekranlar (web va mobile bir xil):

1. **Telefon:** +998 oldindan tanlangan, avtomatik format, "Davom etish".
2. **Kod:** 6 xonali, telefon avtomatik to'ldiradi (web: `autocomplete="one-time-code"`), 60 soniyadan keyin "Qayta yuborish".
3. **Profil** (faqat yangi foydalanuvchiga): ism (majburiy), familiya (ixtiyoriy), avatar (ixtiyoriy, yo'q bo'lsa bosh harflar), tug'ilgan sana (majburiy).

Backend:

- Ikkita endpoint: `POST /api/auth/request-code {phone}` va `POST /api/auth/verify-code {phone, code}`. Javob: access + refresh token va `isNewUser`.
- `POST /api/auth/complete-profile` — ism, familiya, avatar, `birth_date`.
- `users.password_hash` majburiy emas bo'ladi; eski parolli foydalanuvchilar ham kod orqali kira oladi. Eski `/register`, `/login`, `/request-reset`, `/confirm-reset` route'lari o'chiriladi.
- Kodni yetkazish bitta interfeys orqali: `OtpSender` — `TelegramBotSender` (hozirgi bot) va `SmsSender` (provayder keyin tanlanadi). Provayder `.env` dagi `OTP_PROVIDER` bilan tanlanadi; lokal muhitda kod konsolga chiqadi.
- Xavfsizlik: kod 3 daqiqa amal qiladi, bcrypt bilan hash qilinib saqlanadi, 5 noto'g'ri urinishdan keyin bloklanadi; bitta raqamga 15 daqiqada ko'pi bilan 3 ta kod, bitta IP'ga ham limit (rate-limit-redis).
- 18 yoshdan kichiklar uchun `users.is_minor` (tug'ilgan sanadan hisoblanadi); voyaga yetmaganlar uchun kategoriya cheklovi keyingi qadamda, hozir faqat belgi saqlanadi.

Mobile: token `expo-secure-store` da qoladi, ixtiyoriy passcode o'zgarmaydi.

## 3-bosqich: oddiy foydalanuvchi uchun UI/UX

Natija: ilova ochilganda foydalanuvchi mutaxassis qidiradi va bron qiladi; chat ikkinchi darajada. Ekspert paneli bu bosqichda o'zgarmaydi.

Pastki navigatsiya (mobile) va yon menyu (web): **Asosiy · Sessiyalarim · Chatlar · Profil**.

| Ekran | Nima bo'ladi |
|---|---|
| Onboarding (bir marta) | "Sizga qanday yordam kerak?" — kategoriyalarni tanlash, o'tkazib yuborsa ham bo'ladi |
| Asosiy | Qidiruv, kategoriyalar (katta ikonka), "Hozir onlayn", tavsiya etilganlar |
| Mutaxassis kartochkasi | Rasm, ism, kasb, tasdiqlangan belgi, reyting + sharhlar soni, narx, eng yaqin bo'sh vaqt, tillar |
| Mutaxassis profili | 30 soniyalik video (bo'lsa), men haqimda, xizmatlar (narx, davomiylik), bo'sh vaqtlar, sharhlar, bekor qilish qoidasi; pastda doim "Bron qilish", yonida "Savol berish" |
| Bron (3 qadam) | Xizmat → vaqt → tasdiqlash va to'lov ma'lumoti; keyin holat: To'lov kutilmoqda → To'landi → Tasdiqlandi → Sessiya |
| Sessiyalarim | Kelgusilar (sanoq, "Qo'shilish" 10 daqiqa oldin faollashadi); o'tganlar (yozuv, materiallar, baho qo'yish) |

Qo'shimcha:

- Eslatmalar: sessiyadan 24 soat va 15 daqiqa oldin push.
- Oddiy foydalanuvchidan yashiriladi: guruhlar, kanallar, ish e'lonlari (kod o'chirilmaydi, feature flag bilan yashiriladi).
- Bo'sh holatlar harakatga undaydi ("Mos mutaxassisni toping").
- O'zbek va rus tillari, qorong'i rejim saqlanadi.

Kod tartibi: `frontend/src/app/messages` va admin sahifasi shu bosqichda o'zgarsa, avval kichik komponentlarga bo'linadi, keyin o'zgartiriladi. Kerakli backend: mutaxassislarni kategoriya, onlayn holat va eng yaqin bo'sh vaqt bo'yicha qidirish endpointi.

## 4-bosqich: xavfsizlik va repo tozalash

Natija: ma'lum zaif joylar yopilgan va ommaviy repo toza ko'rinadi.

- [ ] CORS: barcha `*.vercel.app` ruxsatini olib tashlash; faqat `CORS_ORIGINS` dagi aniq domenlar (Vercel preview kerak bo'lsa, faqat o'z loyiha prefiksi).
- [ ] Admin yo'li: `/AdminZero0723s` ni oddiy `/admin` ga o'zgartirish va har bir admin route'da server tomonida rol tekshiruvini tasdiqlash. ARCHITECTURE.md'dan eski yo'lni o'chirish.
- [ ] Bot API: `update-phone` va boshqa bot endpointlari tokensiz rad etilishini test bilan tasdiqlash.
- [ ] JWT: access va refresh secret'lar alohida; refresh token hash qilib saqlanishini tekshirish.
- [ ] Repo tozalash: ildizdagi `fix_dashboard.py` va `stitch_three_column_marketplace_interface/` ni olib tashlash yoki `docs/` ga ko'chirish; `uploads/` git'ga tushmasligini tekshirish.
- [ ] Sirlar: git tarixida kalit qolmaganini tekshirish (gitleaks yoki shunga o'xshash). Topilsa, egasiga aytiladi — kalitlarni u almashtiradi.
- [ ] Hujjatlar: README va ARCHITECTURE.md ni yangi oqimga (to'lovsiz, parolsiz) moslash.

## Tekshiruv va ish tartibi

Har bir bosqich tugaganda ilova lokal ishga tushadi, testlar o'tadi va qo'lda tekshiruv ro'yxati bajariladi; shundan keyingina keyingisiga o'tiladi.

Ish tartibi:

- Har bosqich alohida branch (`mvp/1-remove-payments`, `mvp/2-otp-auth`, `mvp/3-ux`, `mvp/4-security`) va kichik, tushunarli commitlar.
- Bosqich boshida reja (qaysi fayllar o'zgaradi) ko'rsatiladi va egasining tasdig'i kutiladi.
- Ma'lumot yo'qotadigan har qanday amal (jadval tashlash, fayl o'chirish, force push) faqat egasining ruxsati bilan.
- Backend uchun test framework (Vitest) — yangi endpointlar test bilan keladi.

Qo'lda tekshiruv:

- [ ] Yangi raqam bilan ro'yxatdan o'tish 3 ekranda tugaydi, parol so'ralmaydi.
- [ ] Noto'g'ri kod 5 marta kiritilganda bloklanadi; muddati o'tgan kod qabul qilinmaydi.
- [ ] Ilovaning hech bir joyida balans, token, wallet yoki top-up qolmagan.
- [ ] Bron: mijoz "To'ladim" bosadi → mutaxassis tasdiqlaydi → "Qo'shilish" faollashadi; tasdiqsiz video ochilmaydi.
- [ ] Begona foydalanuvchi boshqa sessiyaning to'lov holatini o'zgartira olmaydi.
- [ ] Asosiy ekrandan mutaxassisni topib bron qilish 5 bosishdan oshmaydi.
- [ ] Ruxsat berilmagan domendan kelgan CORS so'rovi rad etiladi; admin sahifasi oddiy foydalanuvchiga 403 qaytaradi.
- [ ] Web va mobile ikkalasida ham tekshirilgan.
