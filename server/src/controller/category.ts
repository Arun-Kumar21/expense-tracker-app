import { Request, Response } from "express";
import { AddCategorySchema, UpdateCategorySchema } from "../types";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import db from "../db";

// @desc    Get all categories for user
// @route   GET /api/v1/categories
export const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const userCategories = await db.category.findMany({
        where: {
            userId: req.userId
        },
        orderBy: {
            name: 'asc'
        }
    });

    const globalCategories = await db.category.findMany({
        where: {
            userId: null
        },
        orderBy: {
            name: 'asc'
        }
    });

    res.status(200).json({ categories: [...userCategories, ...globalCategories] });
});

// @desc    Add category
// @route   POST /api/v1/categories
export const addCategory = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const parsedData = AddCategorySchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const category = await db.category.create({
        data: {
            name: parsedData.data.name,
            userId: req.userId,
            icon: parsedData.data.icon,
            color: parsedData.data.color
        }
    });

    res.status(201).json({ category });
});

// @desc    Update category
// @route   PUT /api/v1/categories/:categoryId
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const parsedData = UpdateCategorySchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const { categoryId } = req.params;

    const category = await db.category.findUnique({
        where: {
            id: categoryId,
        }
    });

    if (!category) {
        throw new AppError("Category not found", 404);
    }

    if (category.userId !== req.userId) {
        throw new AppError("Forbidden: You do not own this category", 403);
    }

    const updateData: Record<string, any> = {};
    if (parsedData.data.name !== undefined) updateData.name = parsedData.data.name;
    if (parsedData.data.color !== undefined) updateData.color = parsedData.data.color;
    if (parsedData.data.icon !== undefined) updateData.icon = parsedData.data.icon;

    const updatedCategory = await db.category.update({
        where: {
            id: categoryId,
        },
        data: updateData,
    });

    res.status(200).json({ category: updatedCategory });
});

// @desc    Delete category
// @route   DELETE /api/v1/categories/:categoryId
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { categoryId } = req.params;

    const category = await db.category.findUnique({
        where: {
            id: categoryId,
        }
    });

    if (!category) {
        throw new AppError("Category not found", 404);
    }

    if (category.userId !== req.userId) {
        throw new AppError("Forbidden: You do not own this category", 403);
    }

    await db.category.delete({
        where: {
            id: categoryId,
        }
    });

    res.status(200).json({ message: "Category deleted successfully" });
});
