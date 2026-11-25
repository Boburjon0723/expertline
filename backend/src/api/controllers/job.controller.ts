import { Request, Response } from 'express';
import { JobModel } from '../../models/postgres/Job';
import { JobCategoryModel } from '../../models/postgres/JobCategory';
import { pool } from '../../config/database';
import { safeClearCache } from '../../config/redis';

const JOB_TEXT_MIN = 20;
const JOB_TEXT_MAX = 3000;

export class JobController {
    private jobModel: JobModel;
    private categoryModel: JobCategoryModel;

    constructor() {
        this.jobModel = new JobModel();
        this.categoryModel = new JobCategoryModel();
    }

    createJob = async (req: Request, res: Response) => {
        const client = await pool.connect();
        try {
            const userId = (req as any).user.id;
            const body = req.body || {};

            // Soddalashtirilgan e'lon: tur (ish beruvchi / ish qidiruvchi) + bitta erkin matn.
            const subType = String(body.sub_type || '');
            if (subType !== 'employer' && subType !== 'seeker') {
                return res.status(400).json({ message: "sub_type 'employer' yoki 'seeker' bo'lishi kerak" });
            }
            const text = String(body.short_text || '').trim();
            if (text.length < JOB_TEXT_MIN) {
                return res.status(400).json({ message: `E'lon matni kamida ${JOB_TEXT_MIN} ta belgidan iborat bo'lsin` });
            }
            if (text.length > JOB_TEXT_MAX) {
                return res.status(400).json({ message: `E'lon matni ${JOB_TEXT_MAX} ta belgidan oshmasin` });
            }

            await client.query('BEGIN');

            // Kategoriya ixtiyoriy (eski klientlar yuborishi mumkin) — berilsa, mavjudligini tekshiramiz
            let categoryId: number | null = null;
            if (body.category_id != null && body.category_id !== '') {
                const catRes = await client.query('SELECT id FROM job_categories WHERE id = $1', [body.category_id]);
                if (catRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Category not found' });
                }
                categoryId = catRes.rows[0].id;
            }
            const jobData = {
                sub_type: subType as 'employer' | 'seeker',
                short_text: text,
                category_id: categoryId as any,
                type: (body.type === 'online' || body.type === 'offline' ? body.type : null) as any,
            };

            // MVP: e'lon joylash bepul (hamyon olib tashlangan). job_categories.publication_price_mali hisobga olinmaydi.
            const job = await this.jobModel.create({
                ...jobData,
                user_id: userId,
                payment_status: 'free',
                publication_fee: 0
            }, client);

            await client.query('COMMIT');
            
            // Invalidate cache
            safeClearCache('cache:/api/jobs*').catch(e => console.warn('Cache clear error:', e));

            res.status(201).json(job);
        } catch (error: any) {
            await client.query('ROLLBACK');
            console.error('Create Job Error:', error);
            res.status(500).json({ message: error.message || 'Internal server error' });
        } finally {
            client.release();
        }
    };

    getJobs = async (req: Request, res: Response) => {
        try {
            const { type, category_id, sub_type, q, limit, offset } = req.query;
            const lim = limit != null ? Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100) : undefined;
            const jobs = await this.jobModel.findAll({
                type: type as string,
                category_id: category_id ? parseInt(category_id as string) : undefined,
                sub_type: sub_type as string,
                q: typeof q === 'string' ? q.slice(0, 100) : undefined,
                limit: lim,
                offset: lim ? Math.max(parseInt(String(offset), 10) || 0, 0) : undefined,
            });
            res.json(jobs);
        } catch (error) {
            console.error('Get Jobs Error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };

    getMyJobs = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id as string;
            const jobs = await this.jobModel.findByUserId(userId);
            res.json(jobs);
        } catch (error) {
            console.error('Get My Jobs Error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };

    updateJobStatus = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id as string;
            const jobId = String(req.params.id || '');
            const status = String((req.body as { status?: string })?.status || '');
            if (!['active', 'closed'].includes(status)) {
                return res.status(400).json({ message: "Status faqat 'active' yoki 'closed' bo'lishi kerak" });
            }
            const updated = await this.jobModel.updateStatusForOwner(
                jobId,
                userId,
                status as 'active' | 'closed'
            );
            if (!updated) {
                return res.status(404).json({ message: "E'lon topilmadi yoki sizga tegishli emas" });
            }
            await safeClearCache('cache:/api/jobs*');
            res.json(updated);
        } catch (error) {
            console.error('Update Job Status Error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };

    getCategories = async (req: Request, res: Response) => {
        try {
            const categories = await this.categoryModel.findAll();
            res.json(categories);
        } catch (error) {
            console.error('Get Categories Error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };

    createCategory = async (req: Request, res: Response) => {
        try {
            const { name_uz, name_ru, icon, publication_price_mali } = req.body;
            const category = await this.categoryModel.create({ name_uz, name_ru, icon, publication_price_mali });
            
            // Invalidate categories cache
            safeClearCache('cache:/api/jobs/categories*').catch(e => console.warn('Cache clear error:', e));
            
            res.status(201).json(category);
        } catch (error) {
            console.error('Create Category Error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };
}
