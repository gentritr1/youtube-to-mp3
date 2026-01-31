/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */

import { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
    statusCode?: number;
}

export function errorHandler(err: CustomError, req: Request, res: Response, next: NextFunction) {
    console.error('[Error]', err.message);

    // Default to 500 Internal Server Error
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: true,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}
