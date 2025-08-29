import express from 'express';
import { adminMiddleware } from '../../middleware/admin';
import { addGlobalCategory, deleteGlobalCategory } from '../../controller/admin';

export const adminRouter = express.Router();


adminRouter.use(adminMiddleware);

adminRouter.post("/categories", addGlobalCategory);
adminRouter.delete("/categories/:categoryId", deleteGlobalCategory);
