import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { addCategory, deleteCategory, getAllCategories, updateCategory } from '../../controller/category';

export const categoryRouter = express.Router();

categoryRouter.get("/", userMiddleware, getAllCategories)
categoryRouter.post("/", userMiddleware, addCategory)
categoryRouter.patch("/:categoryId", userMiddleware, updateCategory)
categoryRouter.delete("/:categoryId", userMiddleware, deleteCategory)