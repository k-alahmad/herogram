import { Request, Response } from 'express';
import { generateToken } from '../utils/jwt';
import prisma from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid'; 
export const generateAnonymousTokenHandler = async (req: Request, res: Response) => {
    try {
        
        const newUser = await prisma.user.create({
            data: {
                id: uuidv4() 
            }
        });

        const token = generateToken(newUser.id);
        res.status(200).json({ token, userId: newUser.id, message: 'Anonymous token generated successfully.' });
    } catch (error: any) {
        console.error('Error generating anonymous token:', error);
        res.status(500).json({ message: 'Failed to generate anonymous token.', error: error.message });
    }
};