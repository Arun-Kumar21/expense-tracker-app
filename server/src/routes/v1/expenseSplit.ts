import express from "express";
import { userMiddleware } from "../../middleware/user";
import {
    getExpenseSplitById,
    updateExpenseSplit,
    markExpenseSplitsPaid,
    markExpenseSplitUnpaid,
    getGroupExpenseSplits,
    getMyExpenseSplitsSummary
} from "../../controller/expenseSplit";

export const expenseSplitRouter = express.Router();

expenseSplitRouter.use(userMiddleware);

expenseSplitRouter.get("/my-summary", getMyExpenseSplitsSummary);

expenseSplitRouter.post("/mark-paid", markExpenseSplitsPaid);

expenseSplitRouter.get("/group/:groupId", getGroupExpenseSplits);

expenseSplitRouter.get("/:splitId", getExpenseSplitById);
expenseSplitRouter.put("/:splitId", updateExpenseSplit);
expenseSplitRouter.post("/:splitId/mark-unpaid", markExpenseSplitUnpaid);
