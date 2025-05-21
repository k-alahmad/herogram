import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.error('[Redis Client] Error:', err));
redisClient.on('connect', () => console.log('[Redis Client] Connected to Redis server.'));
redisClient.on('reconnecting', () => console.log('[Redis Client] Reconnecting to Redis...'));
redisClient.on('end', () => console.log('[Redis Client] Connection to Redis ended.'));

// Connect to Redis immediately upon import
(async () => {
    try {
        // Only connect if not already connected or connecting
        if (!redisClient.isOpen && !redisClient.isReady) {
            console.log('[Redis Client] Attempting initial connection to Redis...');
            await redisClient.connect();
            console.log('[Redis Client] Initial connection to Redis successful.');
        } else {
            console.log(`[Redis Client] Redis client already open/ready on import. isOpen: ${redisClient.isOpen}, isReady: ${redisClient.isReady}`);
        }
    } catch (err) {
        console.error('[Redis Client] Failed to establish initial connection to Redis:', err);
        // Do NOT exit here. Allow the app to start, but publishing will fail.
        // The publishPollUpdate function will handle if it's not ready.
    }
})();

export default redisClient;