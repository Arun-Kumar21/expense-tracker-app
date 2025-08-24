import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";

export const adminMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): any => {
    const header = req.headers["authorization"];
    const token = header && header.split(" ")[1];

    if (!token) {
        res.status(401).json({ message: "Unauthorized" });
        return Promise.reject(new Error("Unauthorized"));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
            role: string;
            userId: string;
        };
        if (decoded.role !== "Admin") {
            res.status(403).json({ message: "Forbidden" });
            return Promise.reject(new Error("Forbidden"));
        }
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: "Unauthorized" });
        return Promise.reject(new Error("Unauthorized"));
    }
};