import prisma from '../utils/prisma';
import redisClient from '../utils/redis'; // Ensure this is the connected client

export const createPoll = async (question: string, options: string[], expiresAt: Date) => {
    const poll = await prisma.poll.create({
        data: {
            question,
            expiresAt,
            options: {
                create: options.map(text => ({ text }))
            }
        },
        include: { options: true }
    });
    return poll;
};

export const castVote = async (pollId: string, optionId: string, userId: string) => {
    const now = new Date();

    // Check if poll exists and is not expired
    const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        select: { expiresAt: true }
    });

    if (!poll) {
        throw new Error('Poll not found.');
    }
    if (poll.expiresAt < now) {
        throw new Error('Poll has expired. Cannot cast vote.');
    }

    // Ensure option belongs to the poll
    const option = await prisma.option.findFirst({
        where: {
            id: optionId,
            pollId: pollId
        }
    });

    if (!option) {
        throw new Error('Option not found or does not belong to this poll.');
    }

    // Create or find user
    const user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId }
    });

    // Check for existing vote by this user for this poll (idempotency)
    const existingVote = await prisma.vote.findUnique({
        where: {
            userId_pollId: {
                userId: user.id,
                pollId: pollId
            }
        }
    });

    if (existingVote) {
        if (existingVote.optionId === optionId) {
            console.log(`[CastVote] User ${userId} already voted for option ${optionId} in poll ${pollId}. No change needed.`);
            return { message: 'Vote already cast for this option by this user.', vote: existingVote };
        } else {
            // Update the existing vote to the new option
            const updatedVote = await prisma.vote.update({
                where: { id: existingVote.id },
                data: {
                    optionId: optionId,
                    votedAt: now
                }
            });
            console.log(`[CastVote] User ${userId} changed vote from ${existingVote.optionId} to ${optionId}. Attempting to publish update.`);
            await publishPollUpdate(pollId); // Call publish
            return { message: 'Vote updated successfully.', vote: updatedVote };
        }
    } else {
        // Create new vote
        const newVote = await prisma.vote.create({
            data: {
                userId: user.id,
                pollId: pollId,
                optionId: optionId
            }
        });
        console.log(`[CastVote] New vote cast by ${userId} for option ${optionId} in poll ${pollId}. Attempting to publish update.`);
        await publishPollUpdate(pollId); // Call publish
        return { message: 'Vote cast successfully.', vote: newVote };
    }
};

export const getPollResults = async (pollId: string) => {
    const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
            options: {
                include: {
                    _count: {
                        select: { votes: true }
                    }
                }
            }
        }
    });

    if (!poll) {
        return null;
    }

    const results = poll.options.map(option => ({
        optionId: option.id,
        text: option.text,
        votes: option._count.votes
    }));

    return {
        id: poll.id,
        question: poll.question,
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
        isClosed: poll.expiresAt < new Date(),
        results: results
    };
};

// Publishes a message to a Redis channel for real-time updates
export const publishPollUpdate = async (pollId: string) => {
    console.log(`[PublishPollUpdate] Attempting to publish update for pollId: ${pollId}`);
    try {
        if (!redisClient.isReady) {
            console.warn(`[PublishPollUpdate] Redis client is not ready. Current status: ${redisClient.isReady}`);
            // Attempt to reconnect if not ready, or handle gracefully
            if (!redisClient.isOpen) { // isOpen indicates if connection is established
                console.warn(`[PublishPollUpdate] Redis client is not open. Attempting to reconnect...`);
                await redisClient.connect().catch(err => console.error(`[PublishPollUpdate] Failed to reconnect Redis:`, err));
                if (!redisClient.isReady) {
                    console.error(`[PublishPollUpdate] Redis client still not ready after reattempt. Cannot publish.`);
                    return; // Cannot publish if not ready
                }
            }
        }

        const results = await getPollResults(pollId);
        if (results) {
            const channel = `poll:${pollId}`;
            const message = JSON.stringify(results);
            console.log(`[PublishPollUpdate] Publishing to channel: ${channel}, message size: ${message.length} bytes`);
            await redisClient.publish(channel, message);
            console.log(`[PublishPollUpdate] Successfully published poll update for channel: ${channel}`);
        } else {
            console.warn(`[PublishPollUpdate] Attempted to publish update for poll ${pollId}, but results were null. Skipping publish.`);
        }
    } catch (error) {
        console.error(`[PublishPollUpdate] Failed to publish poll update for ${pollId}:`, error);
    }
};