import { Request, Response } from "express";

import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { AddCategorySchema } from "../types";



// CATEGORIES


// @desc    Add global category (Admin)
// @route   POST    /api/v1/admin/categories

export const addGlobalCategory = async (req: Request, res: Response) => {
    const parsedData = AddCategorySchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const category = await db.category.create({
        data: {
            name: parsedData.data.name,
            icon: parsedData.data.icon,
            color: parsedData.data.color,
            userId: null
        }
    })

    res.status(201).json({ category });
}

// @desc    Delete global category (Admin)
// @route   DELETE  /api/v1/admin/categories/:categoryId

export const deleteGlobalCategory = async (req: Request, res: Response) => {
    const categoryId = req.params.categoryId;

    const category = await db.category.findUnique({
        where: {
            id: categoryId,
        }
    })

    if (!category) {
        throw new AppError("Category not found", 404);
    }

    await db.category.delete({
        where: {
            id: categoryId,
        }
    })

    res.status(204).send();
}
