import dotenv from 'dotenv';
dotenv.config(); 

import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import prisma from './utils/prisma';
import redisClient from './utils/redis';
import { setupWebSocket } from './services/websocketService';


const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/poll-ws' }); 

setupWebSocket(wss);

server.listen(PORT, () => {
    console.log(`HTTP/WebSocket Server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP/WebSocket server');
    server.close(async () => {
        console.log('HTTP/WebSocket server closed');
        await prisma.$disconnect();
        await redisClient.quit();
        console.log('Prisma and Redis connections closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP/WebSocket server');
    server.close(async () => {
        console.log('HTTP/WebSocket server closed');
        await prisma.$disconnect();
        await redisClient.quit();
        console.log('Prisma and Redis connections closed');
        process.exit(0);
    });
});

export {
    app 
    , server, prisma, redisClient
};
