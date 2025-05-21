import request from 'supertest';
import { app, server, prisma, redisClient } from '../src/server'; 
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

let anonymousToken: string;
let userId: string;
let pollId: string;
let option1Id: string;
let option2Id: string;
let testWs: WebSocket;

const testPollQuestion = 'What is your favorite color?';
const testOptions = ['Red', 'Blue', 'Green'];
const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString(); 

beforeAll(async () => {
    
    await prisma.$connect();
    await redisClient.connect(); 

    await prisma.vote.deleteMany();
    await prisma.option.deleteMany();
    await prisma.poll.deleteMany();
    await prisma.user.deleteMany();

    // 1. Generate anonymous token
    const authRes = await request(app)
        .post('/api/auth/anon')
        .expect(200);
    anonymousToken = authRes.body.token;
    userId = authRes.body.userId;
    expect(anonymousToken).toBeDefined();
    expect(userId).toBeDefined();

    // 2. Create a poll
    const pollRes = await request(app)
        .post('/api/poll')
        .send({
            question: testPollQuestion,
            options: testOptions,
            expiresAt: futureDate
        })
        .expect(201);
    pollId = pollRes.body.id;
    option1Id = pollRes.body.options[0].id;
    option2Id = pollRes.body.options[1].id;
    expect(pollId).toBeDefined();
    expect(option1Id).toBeDefined();
    expect(pollRes.body.question).toBe(testPollQuestion);
});

afterAll(async () => {
    await prisma.vote.deleteMany();
    await prisma.option.deleteMany();
    await prisma.poll.deleteMany();
    await prisma.user.deleteMany();

    await prisma.$disconnect();
    await redisClient.quit();
    server.close(); 
});

describe('Poll API Functional Tests', () => {
    it('should generate an anonymous token', async () => {
        const res = await request(app)
            .post('/api/auth/anon')
            .expect(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('userId');
    });

    it('should create a poll', async () => {
        const res = await request(app)
            .get(`/api/poll/${pollId}`)
            .expect(200);

        expect(res.body.id).toBe(pollId);
        expect(res.body.question).toBe(testPollQuestion);
        expect(res.body.options.length).toBe(testOptions.length);
        expect(res.body.isClosed).toBe(false);
    });

    it('should cast a vote successfully', async () => {
        const res = await request(app)
            .post(`/api/poll/${pollId}/vote`)
            .set('Authorization', `Bearer ${anonymousToken}`)
            .send({ optionId: option1Id })
            .expect(200);

        expect(res.body.message).toBe('Vote cast successfully.');
        expect(res.body.vote).toHaveProperty('id');
        expect(res.body.vote.optionId).toBe(option1Id);
    });

    it('should retrieve poll results with votes', async () => {
        const res = await request(app)
            .get(`/api/poll/${pollId}`)
            .expect(200);

        expect(res.body.id).toBe(pollId);
        const votedOption = res.body.results.find((o: any) => o.optionId === option1Id);
        expect(votedOption.votes).toBe(1);
    });

    it('should update vote if user votes again for the same poll', async () => {
        const newOptionId = option2Id; 

        const res = await request(app)
            .post(`/api/poll/${pollId}/vote`)
            .set('Authorization', `Bearer ${anonymousToken}`)
            .send({ optionId: newOptionId })
            .expect(200);

        expect(res.body.message).toBe('Vote updated successfully.');
        expect(res.body.vote.optionId).toBe(newOptionId);


        const resultsRes = await request(app)
            .get(`/api/poll/${pollId}`)
            .expect(200);

        const oldOption = resultsRes.body.results.find((o: any) => o.optionId === option1Id);
        const newOption = resultsRes.body.results.find((o: any) => o.optionId === newOptionId);

        expect(oldOption.votes).toBe(0); // Old option should have 0 votes
        expect(newOption.votes).toBe(1); // New option should have 1 vote
    });

    it('should not allow voting on an expired poll', async () => {
        // Create an expired poll
        const expiredDate = new Date(Date.now() - 1000 * 60).toISOString(); // 1 minute ago
        const expiredPollRes = await request(app)
            .post('/api/poll')
            .send({
                question: 'Expired Poll Question',
                options: ['Option X', 'Option Y'],
                expiresAt: expiredDate
            })
            .expect(201);
        const expiredPollId = expiredPollRes.body.id;
        const expiredOptionId = expiredPollRes.body.options[0].id;

        const authRes = await request(app)
            .post('/api/auth/anon')
            .expect(200);
        const tokenForExpired = authRes.body.token;

        const voteRes = await request(app)
            .post(`/api/poll/${expiredPollId}/vote`)
            .set('Authorization', `Bearer ${tokenForExpired}`)
            .send({ optionId: expiredOptionId })
            .expect(403); // Forbidden, as poll is expired

        expect(voteRes.body.message).toBe('Poll has expired. Cannot cast vote.');
    });

    it('should rate-limit a user for too many votes', async () => {
        const authRes = await request(app).post('/api/auth/anon').expect(200);
        const rateLimitToken = authRes.body.token;
        const rateLimitUserId = authRes.body.userId;

        // Make 5 requests within 1 second
        for (let i = 0; i < 5; i++) {
            await request(app)
                .post(`/api/poll/${pollId}/vote`)
                .set('Authorization', `Bearer ${rateLimitToken}`)
                .send({ optionId: option1Id })
                .expect(200); // Expect success for the first 5
        }

        // The 6th request should be rate-limited
        const res = await request(app)
            .post(`/api/poll/${pollId}/vote`)
            .set('Authorization', `Bearer ${rateLimitToken}`)
            .send({ optionId: option1Id })
            .expect(429); // Too Many Requests

        expect(res.body.message).toBe('Too many requests. Please try again later.');

        // Clear rate limiter for this user for subsequent tests if any
        await redisClient.del(`vote_rate_limit:${rateLimitUserId}`);
    }, 10000); // Increase timeout for rate limit test

    it('should connect to WebSocket and receive initial poll data', (done) => {
        // WebSocket connection URL
        const wsUrl = `ws://localhost:3000/api/poll-ws?pollId=${pollId}`;
        testWs = new WebSocket(wsUrl);

        testWs.onopen = () => {
            console.log('WebSocket connected.');
        };

        testWs.onmessage = (event) => {
            const data = JSON.parse(event.data.toString());
            expect(data).toHaveProperty('id', pollId);
            expect(data).toHaveProperty('question', testPollQuestion);
            expect(data).toHaveProperty('results');
            // Ensure some votes are present if applicable from previous tests
            const totalVotes = data.results.reduce((sum: number, opt: any) => sum + opt.votes, 0);
            expect(totalVotes).toBeGreaterThanOrEqual(1); // At least one vote from the update test

            testWs.close();
            done();
        };

        testWs.onerror = (err) => {
            console.error('WebSocket error:', err);
            done(err);
        };
    }, 10000);

    it('should receive real-time updates via WebSocket after a vote', (done) => {
        // Make sure previous websocket is closed or use a new one
        if (testWs && testWs.readyState === WebSocket.OPEN) {
            testWs.close();
        }

        const wsUrl = `ws://localhost:3000/api/poll-ws?pollId=${pollId}`;
        const newWs = new WebSocket(wsUrl);
        let initialDataReceived = false;

        newWs.onopen = () => {
            console.log('WebSocket for real-time update test connected.');
            // Cast another vote AFTER the WebSocket is open
            request(app)
                .post(`/api/poll/${pollId}/vote`)
                .set('Authorization', `Bearer ${anonymousToken}`) // Use the same user token
                .send({ optionId: option1Id }) // Vote for option 1 again to trigger update
                .expect(200)
                .then(() => console.log('Vote cast to trigger WS update'))
                .catch(err => {
                    console.error('Error casting vote for WS test:', err);
                    done(err);
                });
        };

        newWs.onmessage = (event) => {
            const data = JSON.parse(event.data.toString());
            console.log('WS message received:', data);
            if (!initialDataReceived) {
                // First message is initial data
                initialDataReceived = true;
                // Wait for the next message which should be the update
                return;
            }

            // This should be the update from the new vote
            expect(data).toHaveProperty('id', pollId);
            expect(data).toHaveProperty('results');

            // Find option1 and expect its vote count to be incremented
            const option1 = data.results.find((o: any) => o.optionId === option1Id);
            expect(option1.votes).toBe(1); // Should be 1 because the user changed to option2 then back to option1

            newWs.close();
            done();
        };

        newWs.onerror = (err) => {
            console.error('WebSocket error in real-time test:', err);
            done(err);
        };
    }, 15000); // Extended timeout for WS tests
});