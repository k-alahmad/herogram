import { Request, Response } from 'express';
import { createPoll, castVote, getPollResults } from '../services/pollService';

export const createPollHandler = async (req: Request, res: Response) => {
    const { question, options, expiresAt } = req.body;

    if (!question || !Array.isArray(options) || options.length < 2 || !expiresAt) {
        res.status(400).json({ message: 'Missing required fields: question, options (min 2), expiresAt' });
        return;
    }
    if (new Date(expiresAt) <= new Date()) {
        res.status(400).json({ message: 'expiresAt must be in the future.' });
        return;
    }

    try {
        const poll = await createPoll(question, options, new Date(expiresAt));
        res.status(201).json({
            id: poll.id,
            question: poll.question,
            options: poll.options.map(o => ({ id: o.id, text: o.text })),
            expiresAt: poll.expiresAt,
            message: 'Poll created successfully.'
        });
        return;
    } catch (error: any) {
        console.error('Error creating poll:', error);
        res.status(500).json({ message: 'Failed to create poll.', error: error.message });
        return;
    }
};



export const castVoteHandler = async (req: Request, res: Response) => {
    const { id: pollId } = req.params;
    const { optionId } = req.body;
    const userId = req.userId; // From authentication middleware

    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' }); // REMOVE 'return'
        return;
    }
    if (!optionId) {
        res.status(400).json({ message: 'Option ID is required.' }); // REMOVE 'return'
        return;
    }

    try {
        const result = await castVote(pollId, optionId, userId);
        res.status(200).json({ message: result.message, vote: result.vote }); // REMOVE 'return'
        return;
    } catch (error: any) {
        console.error('Error casting vote:', error);
        if (error.message.includes('Poll not found') || error.message.includes('Option not found')) {
            res.status(404).json({ message: error.message }); // REMOVE 'return'
            return; 
        }
        if (error.message.includes('Poll has expired')) {
            res.status(403).json({ message: error.message }); // REMOVE 'return'
            return; 
        }
        res.status(500).json({ message: 'Failed to cast vote.', error: error.message }); // REMOVE 'return'
        return; 
    }
};


export const getPollResultsHandler = async (req: Request, res: Response) => {
    const { id: pollId } = req.params;

    try {
        const results = await getPollResults(pollId);
        if (!results) {
            res.status(404).json({ message: 'Poll not found.' });
            return;
        }
        res.status(200).json(results);
        return;
    } catch (error: any) {
        console.error('Error getting poll results:', error);
        res.status(500).json({ message: 'Failed to retrieve poll results.', error: error.message });
        return;
    }
};
