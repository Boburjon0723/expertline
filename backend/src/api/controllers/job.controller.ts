import { Request, Response } from 'express';
import { JobModel } from '../../models/postgres/Job';
import { JobCategoryModel } from '../../models/postgres/JobCategory';
import { pool } from '../../config/database';
import { safeClearCache } from '../../config/redis';

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
            const jobData = req.body;

            if (!jobData.sub_type || !jobData.category_id || !jobData.type) {
                return res.status(400).json({ message: 'Missing required fields' });
            }

            await client.query('BEGIN');

            const catRes = await client.query('SELECT 1 FROM job_categories WHERE id = $1', [jobData.category_id]);
            if (catRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Category not found' });
            }

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
            const { type, category_id, sub_type } = req.query;
            const jobs = await this.jobModel.findAll({
                type: type as string,
                category_id: category_id ? parseInt(category_id as string) : undefined,
                sub_type: sub_type as string
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
