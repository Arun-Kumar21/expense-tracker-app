import { Request, Response } from "express";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { SearchUserSchema } from "../types";


// @desc    Get user by userId
// @route   GET /api/v1/users/:userId

export const getUserById = async (req: Request, res: Response) =>  {
    const userId = req.params.userId;    

    if (!userId) {
        throw new AppError("Missing user id", 400);
    }   

    const user = await db.user.findUnique({
        where: {
            id: userId
        }
    })

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return res.json({user})
}


// @desc    Get user by user
// @route   GET /api/v1/users/search

export const getUserByUsername = async (req: Request, res: Response) => {
    const parsedData = SearchUserSchema.safeParse(req.body);  
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const user = await db.user.findUnique({
        where: {
            username: parsedData.data.username
        }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return res.json({ user });
};
