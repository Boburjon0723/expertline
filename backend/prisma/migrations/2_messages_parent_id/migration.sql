-- 0_init'ga tushmay qolgan, lekin kod ishlatadigan ustunlar.
-- messages.parent_id: javob (reply) xabarlar; yo'qligi sabab xabar yuborish/o'qish 500 berardi.
-- Manba: migrate_parent_id.js, src/scripts/fix_profiles_created_at.ts.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "parent_id" UUID REFERENCES "messages"("id") ON DELETE SET NULL;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
