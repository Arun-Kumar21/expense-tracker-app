import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export const errorHandler = (
    error: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let statusCode = 500;
    let message = "Internal server error";

    // Handle custom AppError
    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
    }

    // Handle Prisma errors
    if (error.name === "PrismaClientValidationError") {
        statusCode = 400;
        message = "Invalid data provided";
    }

    if (error.name === "PrismaClientKnownRequestError") {
        statusCode = 400;
        message = "Database operation failed";
    }

    // Handle JWT errors
    if (error.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid token";
    }

    if (error.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Token expired";
    }

    // Log error in development
    if (process.env.NODE_ENV === "development") {
        console.error("Error:", error);
    }

    res.status(statusCode).json({
        message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
};
