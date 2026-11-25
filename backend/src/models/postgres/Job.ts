
import { pool } from '../../config/database';

export interface Job {
    id: string;
    user_id: string;
    /** jobs.title NOT NULL — soddalashtirilgan e'londa matnning birinchi qatoridan olinadi */
    title?: string;
    sub_type: 'seeker' | 'employer';
    category_id: number;
    type: 'online' | 'offline';
    status: 'active' | 'closed' | 'draft';
    payment_status: 'unpaid' | 'paid' | 'free';
    publication_fee: string | number;
    short_text: string;
    created_at: Date;

    // Seeker specific fields
    full_name?: string;
    birth_date?: Date;
    location?: string;
    /** Yo'nalish kodi (constants/directions) */
    direction?: string;
    experience_years?: number;
    salary_min?: string;
    is_salary_negotiable?: boolean;
    skills_json?: any;
    has_diploma?: boolean;
    has_certificate?: boolean;
    resume_url?: string;

    // Employer specific fields
    company_name?: string;
    responsible_person?: string;
    work_type?: string;
    work_hours?: string;
    day_off?: string;
    age_range?: string;
    gender_pref?: string;
    requirements_json?: any;
    salary_text?: string;
    benefits_json?: any;
    apply_method_json?: any;

    user?: {
        name: string;
        phone: string;
    };
    category_name_uz?: string;
    category_icon?: string;
}

export class JobModel {

    async create(job: Partial<Job>, client?: any): Promise<Job> {
        const query = `
            INSERT INTO jobs (
                user_id, title, sub_type, category_id, type, status, short_text, 
                full_name, birth_date, location, experience_years, salary_min, is_salary_negotiable, skills_json, has_diploma, has_certificate, resume_url,
                company_name, responsible_person, work_type, work_hours, day_off, age_range, gender_pref, requirements_json, salary_text, benefits_json, apply_method_json,
                payment_status, publication_fee, direction
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
            RETURNING *
        `;
        const values = [
            job.user_id, job.title || (job.short_text || '').split('\n')[0].slice(0, 120) || 'E\'lon', job.sub_type, job.category_id, job.type, job.status || 'active', job.short_text,
            job.full_name, job.birth_date, job.location, job.experience_years, job.salary_min, job.is_salary_negotiable, job.skills_json, job.has_diploma, job.has_certificate, job.resume_url,
            job.company_name, job.responsible_person, job.work_type, job.work_hours, job.day_off, job.age_range, job.gender_pref, job.requirements_json, job.salary_text, job.benefits_json, job.apply_method_json,
            job.payment_status || 'unpaid', job.publication_fee || 0, job.direction ?? null
        ];

        try {
            const result = await (client || pool).query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Job creation db error:', error);
            throw error;
        }
    }

    async findAll(filters: {
        type?: string;
        category_id?: number;
        sub_type?: string;
        /** Matn bo'yicha qidiruv (e'lon matni, kompaniya, kategoriya, muallif ismi) */
        q?: string;
        /** Viloyat kodi: shu viloyat e'lonlari birinchi, keyin masofaviy, keyin qolganlari */
        region?: string;
        /** Yo'nalish kodi — qat'iy filtr */
        direction?: string;
        limit?: number;
        offset?: number;
    }): Promise<Job[]> {
        let query = `
            SELECT j.*, u.name as user_name, u.surname as user_surname, u.username as user_username,
                   u.avatar_url as user_avatar_url, u.phone as user_phone,
                   c.name_uz as category_name_uz, c.icon as category_icon
            FROM jobs j
            LEFT JOIN users u ON j.user_id = u.id
            LEFT JOIN job_categories c ON j.category_id = c.id
            WHERE 1=1 AND j.status = 'active'
        `;
        const values: any[] = [];
        let paramIndex = 1;

        if (filters.type && filters.type !== 'all') {
            query += ` AND j.type = $${paramIndex}`;
            values.push(filters.type);
            paramIndex++;
        }

        if (filters.category_id) {
            query += ` AND j.category_id = $${paramIndex}`;
            values.push(filters.category_id);
            paramIndex++;
        }

        if (filters.sub_type) {
            query += ` AND j.sub_type = $${paramIndex}`;
            values.push(filters.sub_type);
            paramIndex++;
        }

        if (filters.direction) {
            query += ` AND j.direction = $${paramIndex}`;
            values.push(filters.direction);
            paramIndex++;
        }

        const q = filters.q?.trim();
        if (q) {
            const p = `$${paramIndex}`;
            query += ` AND (
                COALESCE(j.short_text,'') ILIKE ${p}
                OR COALESCE(j.description,'') ILIKE ${p}
                OR COALESCE(j.title,'') ILIKE ${p}
                OR COALESCE(j.company_name,'') ILIKE ${p}
                OR COALESCE(c.name_uz,'') ILIKE ${p}
                OR COALESCE(u.name,'') ILIKE ${p}
            )`;
            values.push(`%${q}%`);
            paramIndex++;
        }

        if (filters.region) {
            query += ` ORDER BY CASE WHEN j.location = $${paramIndex} THEN 0 WHEN j.location = 'remote' THEN 1 ELSE 2 END, j.created_at DESC`;
            values.push(filters.region);
            paramIndex++;
        } else {
            query += ` ORDER BY j.created_at DESC`;
        }

        if (filters.limit) {
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(filters.limit, filters.offset || 0);
            paramIndex += 2;
        }

        const result = await pool.query(query, values);

        return result.rows.map(row => ({
            ...row,
            category_name: row.category_name_uz,
            user: {
                name: row.user_name || 'Unknown',
                surname: row.user_surname || '',
                username: row.user_username || '',
                avatar_url: row.user_avatar_url || null,
                phone: row.user_phone || ''
            }
        }));
    }

    async facets(f: { subType?: string; region?: string; direction?: string }): Promise<{
        regions: Record<string, number>;
        directions: Record<string, number>;
    }> {
        const count = async (column: 'location' | 'direction', extra?: { column: string; value: string }) => {
            const values: any[] = [];
            let where = `status = 'active' AND ${column} IS NOT NULL`;
            if (f.subType) {
                values.push(f.subType);
                where += ` AND sub_type = $${values.length}`;
            }
            if (extra) {
                values.push(extra.value);
                where += ` AND ${extra.column} = $${values.length}`;
            }
            const result = await pool.query(
                `SELECT ${column} AS k, COUNT(*)::int AS n FROM jobs WHERE ${where} GROUP BY ${column}`,
                values
            );
            const out: Record<string, number> = {};
            for (const r of result.rows) out[r.k] = r.n;
            return out;
        };
        const [regions, directions] = await Promise.all([
            count('location', f.direction ? { column: 'direction', value: f.direction } : undefined),
            // Viloyat ichida: shu viloyat + masofaviy e'lonlar
            f.region
                ? (async () => {
                      const values: any[] = [f.region];
                      let where = `status = 'active' AND direction IS NOT NULL AND location IN ($1, 'remote')`;
                      if (f.subType) {
                          values.push(f.subType);
                          where += ` AND sub_type = $2`;
                      }
                      const result = await pool.query(
                          `SELECT direction AS k, COUNT(*)::int AS n FROM jobs WHERE ${where} GROUP BY direction`,
                          values
                      );
                      const out: Record<string, number> = {};
                      for (const r of result.rows) out[r.k] = r.n;
                      return out;
                  })()
                : count('direction'),
        ]);
        return { regions, directions };
    }

    /** Bitta faol e'lon — ro'yxatdagi bilan bir xil ko'rinishda (muallif bilan) */
    async findPublicById(id: string): Promise<Job | null> {
        const result = await pool.query(
            `SELECT j.*, u.name as user_name, u.surname as user_surname, u.username as user_username,
                    u.avatar_url as user_avatar_url
             FROM jobs j
             LEFT JOIN users u ON j.user_id = u.id
             WHERE j.id::text = $1 AND j.status = 'active'
             LIMIT 1`,
            [id]
        );
        const row = result.rows[0];
        if (!row) return null;
        return {
            ...row,
            user: {
                name: row.user_name || 'Unknown',
                surname: row.user_surname || '',
                username: row.user_username || '',
                avatar_url: row.user_avatar_url || null,
            },
        };
    }

    async findById(id: string): Promise<Job | null> {
        const query = `SELECT * FROM jobs WHERE id = $1`;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    async findByUserId(userId: string): Promise<Job[]> {
        const query = `
            SELECT j.*, c.name_uz as category_name_uz, c.icon as category_icon
            FROM jobs j
            LEFT JOIN job_categories c ON j.category_id = c.id
            WHERE j.user_id = $1::uuid
            ORDER BY j.created_at DESC
        `;
        const result = await pool.query(query, [userId]);
        return result.rows.map((row) => ({
            ...row,
            category_name: row.category_name_uz,
        }));
    }

    async updateStatusForOwner(
        jobId: string,
        userId: string,
        status: 'active' | 'closed'
    ): Promise<Job | null> {
        const result = await pool.query(
            `UPDATE jobs
             SET status = $3
             WHERE id = $1 AND user_id = $2::uuid
             RETURNING *`,
            [jobId, userId, status]
        );
        return result.rows[0] || null;
    }
}
