import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler";

export const userMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {

    const headers = req.headers["authorization"];
    // Expecting header format: "Bearer <token>"
    const token = headers && headers.split(" ")[1];

    if (!token) {
        return next(new AppError("Unauthorized", 401));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
            userId: string;
            role: string;
        };
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return next(new AppError("Unauthorized", 401));
    }
};
