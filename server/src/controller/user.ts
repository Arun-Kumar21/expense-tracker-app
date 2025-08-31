import { Request, Response } from "express";
import db from "../db";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { SearchUserSchema } from "../types";


// @desc    Get user by userId
// @route   GET /api/v1/users/:userId
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) {
        throw new AppError("Missing user ID", 400);
    }

    const user = await db.user.findUnique({
        where: {
            id: userId
        },
        omit: {
            password: true,
            role: true
        }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    res.status(200).json({ user });
});


// @desc    Get user by username
// @route   POST /api/v1/users/search
export const getUserByUsername = asyncHandler(async (req: Request, res: Response) => {
    const parsedData = SearchUserSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const user = await db.user.findUnique({
        where: {
            username: parsedData.data.username
        },
        omit: {
            password: true,
            role: true
        }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    res.status(200).json({ user });
});

