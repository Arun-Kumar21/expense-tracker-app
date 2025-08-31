import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { addCategory, deleteCategory, getAllCategories, updateCategory } from '../../controller/category';

export const categoryRouter = express.Router();

categoryRouter.use(userMiddleware);

categoryRouter.get("/", getAllCategories);
categoryRouter.post("/", addCategory);
categoryRouter.put("/:categoryId", updateCategory);
categoryRouter.delete("/:categoryId", deleteCategory);
