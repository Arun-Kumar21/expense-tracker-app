import express from "express";
import { userMiddleware } from "../../middleware/user";
import {
    getSplitExpenses,
    getSplitExpenseById,
    createSplitExpense,
    updateSplitExpense,
    deleteSplitExpense,
    getGroupSplitExpenses,
    getMyDebts,
    getOwedToMe
} from "../../controller/splitExpense";

export const splitExpenseRouter = express.Router();

splitExpenseRouter.use(userMiddleware);

splitExpenseRouter.get("/my-debts", getMyDebts);
splitExpenseRouter.get("/owed-to-me", getOwedToMe);

splitExpenseRouter.get("/group/:groupId", getGroupSplitExpenses);

splitExpenseRouter.get("/", getSplitExpenses);
splitExpenseRouter.post("/", createSplitExpense);
splitExpenseRouter.get("/:expenseId", getSplitExpenseById);
splitExpenseRouter.put("/:expenseId", updateSplitExpense);
splitExpenseRouter.delete("/:expenseId", deleteSplitExpense);
