import { Router } from 'express';
import { getSearchSuggestions } from '../controllers/search.controller';
import { authenticateToken } from '../../middleware/auth.middleware';
import { cacheMiddleware } from '../../middleware/cache.middleware';

const router = Router();

/** Qidiruv maydoni uchun kalit so'zlar (tabga qarab: listings | experts) */
router.get('/suggestions', authenticateToken, cacheMiddleware(300), getSearchSuggestions);

export default router;
