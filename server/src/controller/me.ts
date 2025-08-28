import express, { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import db from '../db';
import { UpdateProfileSchema } from '../types';


// @desc    Get current user profile
// @route   GET /api/v1/me

export const getCurrentUserProfile = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const userProfile = await db.user.findUnique({
        where: {
            id: req.userId
        },
        omit: {
            password: true,
        }
    })

    if (!userProfile) {
        throw new AppError("User not found", 404);
    }

    res.json({ userProfile });
}

// @desc    Update current user profile
// @route   PUT /api/v1/me

export const updateCurrentUserProfile = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const parsedData = UpdateProfileSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }
    
    const updatedProfile = await db.user.update({
        where: {
            id: req.userId
        },
        data: {
            displayName: parsedData.data.displayName,
            avatar: parsedData.data.avatar
        },
        omit: {
            password: true
        }
    })

    res.json({ updatedProfile })
}


//TODO: Add account deletion functionality after a time period.
