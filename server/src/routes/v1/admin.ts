import express from 'express';
import { adminMiddleware } from '../../middleware/admin';
import { addGlobalCategory, deleteGlobalCategory } from '../../controller/admin';

export const adminRouter = express.Router();


adminRouter.post("/categories", adminMiddleware, addGlobalCategory);
adminRouter.delete("/categories/:categoryId", adminMiddleware, deleteGlobalCategory);
