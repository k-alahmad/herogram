import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';


declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) {
        res.status(401).json({ message: 'Authentication token required' }); 
        return;
    }

    const decoded = verifyToken(token);

    if (!decoded) {
        res.status(403).json({ message: 'Invalid or expired token' }); 
        return; 
    }

    req.userId = decoded.userId; 
    next();
};