import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Sxema va migratsiyalar Prisma orqali boshqariladi; ilova kodi hozircha `pg` bilan ishlaydi.
// DATABASE_URL: .env dan olinadi (buyruq qatorida berilgan qiymat ustun turadi).
export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: env('DATABASE_URL'),
    },
});
