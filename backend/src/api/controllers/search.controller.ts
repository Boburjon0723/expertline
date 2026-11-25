import { Request, Response } from 'express';
import { pool } from '../../config/database';

/**
 * Qidiruv maydoni uchun kalit so'z takliflari.
 *
 * GET /api/search/suggestions?scope=listings&type=employer&q=fr
 * GET /api/search/suggestions?scope=experts&q=yur
 *
 * - listings: faol e'lonlar matnidagi eng ko'p uchraydigan so'zlar + kategoriya nomlari
 * - experts:  tasdiqlangan mutaxassislarning kasb / mutaxassislik qiymatlari
 * `q` berilsa — shu harflar bilan boshlanadigan (yoki ichida bor) takliflar qoladi.
 */

const MAX_SUGGESTIONS = 12;
const MIN_WORD_LEN = 4;

/** Juda umumiy so'zlar — kalit so'z sifatida foydasiz (uz/ru/en) */
const STOPWORDS = new Set([
    // uz
    'uchun', 'bilan', 'kerak', 'bormi', 'yoki', 'hamda', 'ham', 'emas', 'bo‘lsa', "bo'lsa", 'bo‘lgan', "bo'lgan",
    'qilish', 'qiladi', 'qilaman', 'ishlash', 'ishlayman', 'bizga', 'menga', 'sizga', 'biz', 'men', 'siz',
    'haqida', 'yaxshi', 'katta', 'kichik', 'barcha', 'shart', 'shartlar', 'talab', 'talablar', 'mumkin',
    'kerakli', 'boshqa', 'ushbu', 'shu', 'bu', 'har', 'kun', 'kuni', 'yil', 'yillik', 'oylik', 'soat',
    'tajriba', 'tajribali', 'ish', 'ishga', 'ishchi', 'xodim', 'aloqa', 'telefon', 'raqam', 'murojaat',
    // ru
    'для', 'или', 'что', 'это', 'как', 'нужен', 'нужна', 'нужно', 'требуется', 'работа', 'работы', 'опыт',
    'опытом', 'зарплата', 'график', 'связь', 'телефон', 'есть', 'без', 'при', 'под', 'все', 'наш', 'наша',
    // en
    'with', 'from', 'that', 'this', 'have', 'will', 'your', 'need', 'work', 'job', 'experience', 'salary',
]);

const WORD_SPLIT = /[^0-9a-zA-Zа-яА-ЯёЁўЎқҚғҒҳҲ‘’'ʻʼ+#.-]+/u;

function normalizeWord(w: string): string {
    return w
        .toLowerCase()
        .replace(/[’ʻʼ`]/g, '‘')
        .replace(/^[.\-‘']+|[.\-‘']+$/g, '');
}

function matchesQuery(value: string, q: string): boolean {
    if (!q) return true;
    return value.toLowerCase().includes(q);
}

/** Avval `q` bilan boshlanadiganlar, keyin ichida borlar; har biri ichida — chastota bo'yicha */
function rank(entries: Map<string, number>, q: string): string[] {
    return [...entries.entries()]
        .filter(([k]) => matchesQuery(k, q))
        .sort((a, b) => {
            if (q) {
                const as = a[0].toLowerCase().startsWith(q) ? 1 : 0;
                const bs = b[0].toLowerCase().startsWith(q) ? 1 : 0;
                if (as !== bs) return bs - as;
            }
            return b[1] - a[1] || a[0].localeCompare(b[0]);
        })
        .slice(0, MAX_SUGGESTIONS)
        .map(([k]) => k);
}

async function listingSuggestions(subType: string | null, q: string): Promise<string[]> {
    const params: any[] = [];
    let where = `WHERE j.status = 'active'`;
    if (subType) {
        params.push(subType);
        where += ` AND j.sub_type = $${params.length}`;
    }
    const jobs = await pool.query(
        `SELECT COALESCE(j.short_text, j.description, '') AS text, c.name_uz AS category
         FROM jobs j LEFT JOIN job_categories c ON c.id = j.category_id
         ${where}
         ORDER BY j.created_at DESC
         LIMIT 500`,
        params
    );

    const counts = new Map<string, number>();
    for (const row of jobs.rows as { text: string; category: string | null }[]) {
        if (row.category) {
            counts.set(row.category, (counts.get(row.category) || 0) + 3);
        }
        const seen = new Set<string>();
        for (const raw of String(row.text).split(WORD_SPLIT)) {
            const w = normalizeWord(raw);
            if (w.length < MIN_WORD_LEN || STOPWORDS.has(w) || /^\d+$/.test(w) || seen.has(w)) continue;
            seen.add(w);
            counts.set(w, (counts.get(w) || 0) + 1);
        }
    }

    // E'lonlar kam bo'lsa ham bo'sh qolmasin — faol kategoriyalar nomlari
    if (counts.size < MAX_SUGGESTIONS) {
        const cats = await pool.query(`SELECT name_uz FROM job_categories WHERE is_active = true ORDER BY id LIMIT 30`);
        for (const c of cats.rows as { name_uz: string }[]) {
            if (c.name_uz && !counts.has(c.name_uz)) counts.set(c.name_uz, 0);
        }
    }
    return rank(counts, q);
}

async function expertSuggestions(q: string): Promise<string[]> {
    const rows = await pool.query(
        `SELECT p.profession, p.specialization_details, p.specialization
         FROM user_profiles p
         WHERE p.is_expert = TRUE AND p.verified_status = 'approved'
         LIMIT 1000`
    );
    const counts = new Map<string, number>();
    const add = (v: unknown, weight: number) => {
        const s = String(v || '').trim();
        if (s.length < 3 || s.length > 60 || s === 'Other') return;
        counts.set(s, (counts.get(s) || 0) + weight);
    };
    for (const r of rows.rows) {
        add(r.profession, 2);
        add(r.specialization_details || r.specialization, 1);
    }
    return rank(counts, q);
}

export const getSearchSuggestions = async (req: Request, res: Response) => {
    try {
        const scope = String(req.query.scope || '');
        const q = String(req.query.q || '').trim().toLowerCase().slice(0, 50);
        const typeRaw = String(req.query.type || '');
        const subType = typeRaw === 'employer' || typeRaw === 'seeker' ? typeRaw : null;

        if (scope === 'listings') {
            return res.json({ suggestions: await listingSuggestions(subType, q) });
        }
        if (scope === 'experts') {
            return res.json({ suggestions: await expertSuggestions(q) });
        }
        return res.status(400).json({ message: "scope 'listings' yoki 'experts' bo'lishi kerak" });
    } catch (error) {
        console.error('Search suggestions error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
