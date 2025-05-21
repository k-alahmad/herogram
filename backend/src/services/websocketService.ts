import { WebSocket, WebSocketServer } from 'ws';
// We need a separate subscriber client to avoid blocking the publisher
import { createClient as createRedisClient } from 'redis';
import { getPollResults } from './pollService';

interface CustomWebSocket extends WebSocket {
    isAlive: boolean;
    pollId?: string; // To track which poll a client is subscribed to
}

export const setupWebSocket = (wss: WebSocketServer) => {
    const clients = new Map<string, Set<CustomWebSocket>>();

    // Create a dedicated Redis client for subscribing
    const redisSubscriber = createRedisClient({
        url: process.env.REDIS_URL // Use the same Redis URL from environment
    });

    // Add comprehensive event listeners for the subscriber client
    redisSubscriber.on('error', (err) => console.error('[WS Redis Subscriber] Error:', err));
    redisSubscriber.on('connect', () => console.log('[WS Redis Subscriber] Connected to Redis.'));
    redisSubscriber.on('reconnecting', () => console.log('[WS Redis Subscriber] Reconnecting to Redis...'));
    redisSubscriber.on('end', () => console.log('[WS Redis Subscriber] Connection to Redis ended.'));
    redisSubscriber.on('ready', () => console.log('[WS Redis Subscriber] Redis client is ready.'));


    // Attempt to connect the subscriber client
    redisSubscriber.connect().then(() => {
        console.log('[WS Redis Subscriber] Initial connection successful.');
    }).catch(err => {
        console.error('[WS Redis Subscriber] Failed to establish initial connection:', err);
        // Do not exit here, but log the critical error. The application can still run,
        // but real-time updates via this subscriber won't work.
    });

    // This listener receives messages from Redis channels that this subscriber is subscribed to
    redisSubscriber.on('message', (channel, message) => {
        console.log(`[WS Redis Subscriber] Received message on channel: ${channel}`); // New log for incoming Redis messages
        const pollId = channel.split(':')[1]; // Extract pollId from channel name (e.g., "poll:123" -> "123")

        // Check if there are any connected WebSocket clients for this pollId
        if (pollId && clients.has(pollId)) {
            const connectedClients = clients.get(pollId);
            console.log(`[WS Redis Subscriber] Broadcasting to ${connectedClients?.size || 0} clients for poll: ${pollId}`); // Log number of clients
            connectedClients?.forEach(ws => {
                // Only send if the WebSocket connection is open
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(message); // Forward the message (which is the JSON string of poll results)
                } else {
                    console.warn(`[WS Redis Subscriber] Skipping broadcast to non-open WS client for poll ${pollId}. State: ${ws.readyState}`); // Log if client is not open
                }
            });
        } else {
            console.warn(`[WS Redis Subscriber] No active clients or pollId found for channel: ${channel}. Message not broadcast.`); // Log if no clients are listening
        }
    });

    // WebSocket Server connection handler
    wss.on('connection', async (ws: CustomWebSocket, req) => {
        ws.isAlive = true; // For heartbeat (ping/pong) mechanism

        // Extract pollId from WebSocket URL query parameter
        const urlParams = new URLSearchParams(req.url?.split('?')[1]);
        const pollId = urlParams.get('pollId');

        if (!pollId) {
            ws.send(JSON.stringify({ error: 'Poll ID is required in WebSocket URL query parameter (e.g., /api/poll-ws?pollId=your_poll_id)' }));
            ws.close(1008, 'Poll ID missing'); // Close connection with protocol error code
            console.warn('[WS Server] Connection rejected: Poll ID missing in URL.'); // Log rejection
            return;
        }

        ws.pollId = pollId; // Store pollId on the WebSocket instance

        // Add client to the map of connected clients for this pollId
        // If this is the first client for this poll, subscribe the Redis subscriber to its channel
        if (!clients.has(pollId)) {
            clients.set(pollId, new Set());
            // Subscribe the dedicated Redis subscriber client to the poll-specific channel
            await redisSubscriber.subscribe(`poll:${pollId}`, (message, channel) => {
                // This empty callback is required by the redis client library's 'subscribe' method signature.
                // The actual message handling is done by the global redisSubscriber.on('message') listener above.
            });
            console.log(`[WS Server] Subscribed WS Redis Subscriber to channel: poll:${pollId}`); // Log successful subscription
        }
        clients.get(pollId)?.add(ws); // Add the new WebSocket client to the set for this pollId
        console.log(`[WS Server] Client connected for poll: ${pollId}. Total clients for poll: ${clients.get(pollId)?.size}`); // Log client connection

        // Send initial poll results to the newly connected client
        try {
            const initialResults = await getPollResults(pollId); // Fetch current poll state from DB
            if (initialResults) {
                ws.send(JSON.stringify(initialResults)); // Send as JSON string
                console.log(`[WS Server] Sent initial results to new client for poll: ${pollId}`); // Log initial send
            } else {
                ws.send(JSON.stringify({ error: 'Poll not found for initial fetch.' }));
                console.warn(`[WS Server] Poll ${pollId} not found for initial fetch to new client.`); // Log if poll not found
            }
        } catch (error) {
            console.error(`[WS Server] Error sending initial poll results for ${pollId}:`, error);
            ws.send(JSON.stringify({ error: 'Failed to fetch initial poll results.' }));
        }

        // WebSocket heartbeat (ping/pong) for liveness detection
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // WebSocket client disconnection handler
        ws.on('close', async () => {
            console.log(`[WS Server] Client disconnected from poll: ${ws.pollId}`); // Log disconnection
            if (ws.pollId) {
                const pollClients = clients.get(ws.pollId);
                pollClients?.delete(ws); // Remove client from the set
                // If no more clients are listening for this poll, unsubscribe from Redis channel
                if (pollClients?.size === 0) {
                    clients.delete(ws.pollId); // Remove poll entry from map
                    await redisSubscriber.unsubscribe(`poll:${ws.pollId}`); // Unsubscribe from Redis
                    console.log(`[WS Server] Unsubscribed WS Redis Subscriber from channel: poll:${ws.pollId} (no more clients)`); // Log unsubscription
                }
            }
        });

        // WebSocket error handler
        ws.on('error', (error) => {
            console.error(`[WS Server] WebSocket error for poll ${ws.pollId}:`, error); // Log error
        });
    });

    // Periodically check for stale WebSocket connections and terminate them
    setInterval(() => {
        wss.clients.forEach((ws: WebSocket) => {
            const customWs = ws as CustomWebSocket; // Cast to CustomWebSocket to access custom properties
            if (!customWs.isAlive) {
                console.log(`[WS Server] Terminating stale WebSocket connection for poll: ${customWs.pollId}`);
                return customWs.terminate(); // Terminate if no pong received
            }
            customWs.isAlive = false; // Reset for next ping
            customWs.ping(); // Send ping to client
        });
    }, 30000); // Ping every 30 seconds
}