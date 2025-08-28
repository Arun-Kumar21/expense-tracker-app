import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { getCurrentUserProfile, updateCurrentUserProfile } from '../../controller/me';

export const meRouter = express.Router();

meRouter.get("/", userMiddleware, getCurrentUserProfile);
meRouter.put("/", userMiddleware, updateCurrentUserProfile);