import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redisClient from '../utils/redis';


const voteRateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'vote_rate_limit',
    points: 5, 
    duration: 1, 
    blockDuration: 0, 
});

export const rateLimitVotes = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId; 

    if (!userId) {
        
        res.status(401).json({ message: 'User ID not found for rate limiting' });
        return; 
    }

    try {
        const rateLimiterRes = await voteRateLimiter.consume(userId);
        // --- ADDED LOGGING ---
        console.log(`RateLimiter: Consume successful for userId: ${userId}. Remaining points: ${rateLimiterRes.remainingPoints}`);
        // --- END ADDED LOGGING ---
        next();
    } catch (rejRes:any) {
         console.warn(`RateLimiter: Request rejected for userId: ${userId}. Consumed points: ${rejRes.consumedPoints}`);
        res.status(429).json({ message: 'Too many requests. Please try again later.' });
        return; 
    }
};