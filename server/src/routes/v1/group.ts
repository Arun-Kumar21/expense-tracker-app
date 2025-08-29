import express from "express";
import { userMiddleware } from "../../middleware/user";
import {
    getGroups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    addGroupMember,
    removeGroupMember,
    getGroupSummary,
    getGroupBalances
} from "../../controller/group";

export const groupRouter = express.Router();

groupRouter.use(userMiddleware);

groupRouter.get("/", getGroups);
groupRouter.post("/", createGroup);
groupRouter.get("/:groupId", getGroupById);
groupRouter.put("/:groupId", updateGroup);
groupRouter.delete("/:groupId", deleteGroup);

// Group member management
groupRouter.post("/:groupId/members", addGroupMember);
groupRouter.delete("/:groupId/members/:userId", removeGroupMember);

// Group analytics
groupRouter.get("/:groupId/summary", getGroupSummary);
groupRouter.get("/:groupId/balances", getGroupBalances);
