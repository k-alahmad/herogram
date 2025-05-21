import { Router } from 'express';
import { generateAnonymousTokenHandler } from '../controllers/authController';

import { authenticateToken } from '../middleware/auth';
import { rateLimitVotes } from '../middleware/rateLimit';
import { castVoteHandler, createPollHandler, getPollResultsHandler } from '../controllers/pollController';

const router = Router();

// Auth endpoint
router.post('/auth/anon', generateAnonymousTokenHandler);

// Poll creation
router.post('/poll', createPollHandler);

// Vote casting (requires authentication and rate limiting)
router.post('/poll/:id/vote', authenticateToken, castVoteHandler);

// Get poll results
router.get('/poll/:id', getPollResultsHandler);

export default router;