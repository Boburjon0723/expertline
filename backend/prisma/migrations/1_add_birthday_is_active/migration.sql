-- 0_init'ga tushmay qolgan, lekin kod ishlatadigan ustunlar.
-- Manba: add_birthday.sql, migration_fix.sql.
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "birthday" DATE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT TRUE;
