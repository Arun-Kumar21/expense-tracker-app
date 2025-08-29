import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { acceptFriendRequest, getAllFriendRequests, getAllFriends, getFriendInfo, rejectFriendRequest, removeFriend, removeFriendRequest, sendFriendRequest } from '../../controller/friend';

export const friendRouter = express.Router();

friendRouter.use(userMiddleware);

friendRouter.get("/", getAllFriends);
friendRouter.get("/requests", getAllFriendRequests);
friendRouter.post("/requests", sendFriendRequest);
friendRouter.delete("/requests/:requestId", removeFriendRequest);
friendRouter.put("/requests/:requestId/accept", acceptFriendRequest);
friendRouter.put("/requests/:requestId/reject", rejectFriendRequest);
friendRouter.get("/:friendId", getFriendInfo);
friendRouter.delete("/:friendId", removeFriend);
