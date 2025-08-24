import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { addExpense, deleteExpense, getExpenseById, getExpenses, updateExpense } from '../../controller/expense';

export const expenseRouter = express.Router();

expenseRouter.post("/", userMiddleware, addExpense);
expenseRouter.get("/", userMiddleware, getExpenses);
expenseRouter.get("/:expenseId", userMiddleware, getExpenseById);
expenseRouter.put("/:expenseId", userMiddleware, updateExpense);
expenseRouter.delete("/:expenseId", userMiddleware, deleteExpense);
