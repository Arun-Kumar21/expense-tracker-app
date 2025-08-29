import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { getCurrentUserProfile, updateCurrentUserProfile } from '../../controller/me';

export const meRouter = express.Router();
meRouter.use(userMiddleware);

meRouter.get("/", getCurrentUserProfile);
meRouter.put("/", updateCurrentUserProfile);