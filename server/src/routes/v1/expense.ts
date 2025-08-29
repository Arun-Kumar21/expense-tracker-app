import express from 'express';
import { userMiddleware } from '../../middleware/user';
import { addExpense, deleteExpense, getExpenseById, getExpenses, updateExpense } from '../../controller/expense';

export const expenseRouter = express.Router();

expenseRouter.use(userMiddleware);

expenseRouter.post("/", addExpense);
expenseRouter.get("/", getExpenses);
expenseRouter.get("/:expenseId", getExpenseById);
expenseRouter.put("/:expenseId", updateExpense);
expenseRouter.delete("/:expenseId", deleteExpense);
