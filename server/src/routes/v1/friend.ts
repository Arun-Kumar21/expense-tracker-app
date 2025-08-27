import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { acceptFriendRequest, getAllFriendRequests, getAllFriends, getFriendInfo, rejectFriendRequest, removeFriend, removeFriendRequest, sendFriendRequest } from '../../controller/friend';

export const friendRouter = express.Router();

friendRouter.get("/", userMiddleware, getAllFriends);
friendRouter.get("/requests", userMiddleware, getAllFriendRequests);
friendRouter.post("/requests", userMiddleware, sendFriendRequest);
friendRouter.delete("/requests/:requestId", userMiddleware, removeFriendRequest);
friendRouter.put("/requests/:requestId/accept", userMiddleware, acceptFriendRequest);
friendRouter.put("/requests/:requestId/reject", userMiddleware, rejectFriendRequest);
friendRouter.get("/:friendId", userMiddleware, getFriendInfo);
friendRouter.delete("/:friendId", userMiddleware, removeFriend);

