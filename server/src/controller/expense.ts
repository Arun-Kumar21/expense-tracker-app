import { Request, Response } from "express";
import { AddExpenseSchema } from "../types";
import db from "../db";
import { asyncHandler, AppError } from "../middleware/errorHandler";


// @desc    Get all expenses for user
// @route   GET /api/v1/expenses
export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
	if (!req.userId) {
		throw new AppError("Unauthorized", 401);
	}

	const expenses = await db.expense.findMany({
		where: {
			userId: req.userId
		},
		include: {
			category: true
		},
		orderBy: {
			date: 'desc'
		}
	});

	res.status(200).json({ expenses });
});

// @desc    Get expense by ID
// @route   GET /api/v1/expenses/:expenseId
export const getExpenseById = asyncHandler(async (req: Request, res: Response) => {
	if (!req.userId) {
		throw new AppError("Unauthorized", 401);
	}

	const { expenseId } = req.params;

	if (!expenseId) {
		throw new AppError("Expense ID missing or invalid", 400);
	}

	const expense = await db.expense.findFirst({
		where: {
			id: expenseId,
			userId: req.userId
		},
		include: {
			category: true
		}
	});

	if (!expense) {
		throw new AppError("Expense not found", 404);
	}

	res.status(200).json({ expense });
});

// @desc    Add new expense
// @route   POST    /api/v1/expenses

export const addExpense = asyncHandler(async (req: Request, res: Response) => {
	const parsedData = AddExpenseSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new AppError("Validation failed", 400);
	}

	if (!req.userId) {
		throw new AppError("Unauthorized", 401);
	}

	const expense = await db.expense.create({
		data: {
			userId: req.userId,
			amount: parsedData.data.amount,
			description: parsedData.data.description,
			categoryId: parsedData.data.categoryId,
			date: parsedData.data.date,
		},
		include: {
			category: true,
		},
	});

	res.status(201).json({ expense });
});


// @desc    Update expense
// @route   PUT /api/v1/expenses/:expenseId
export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
	if (!req.userId) {
		throw new AppError("Unauthorized", 401);
	}

	const { expenseId } = req.params;

	if (!expenseId) {
		throw new AppError("Expense ID missing or invalid", 400);
	}

	const parsedData = AddExpenseSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new AppError("Validation failed", 400);
	}

	const expense = await db.expense.findFirst({
		where: {
			id: expenseId,
			userId: req.userId
		}
	});

	if (!expense) {
		throw new AppError("Expense not found", 404);
	}

	const updatedExpense = await db.expense.update({
		where: {
			id: expenseId
		},
		data: {
			amount: parsedData.data.amount,
			description: parsedData.data.description,
			categoryId: parsedData.data.categoryId,
			date: parsedData.data.date
		},
		include: {
			category: true
		}
	});

	res.status(200).json({ expense: updatedExpense });
});


// @desc    Delete expense
// @route   DELETE /api/v1/expenses/:expenseId
export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
	if (!req.userId) {
		throw new AppError("Unauthorized", 401);
	}

	const { expenseId } = req.params;

	if (!expenseId) {
		throw new AppError("Expense ID missing or invalid", 400);
	}

	const existingExpense = await db.expense.findFirst({
		where: {
			id: expenseId,
			userId: req.userId
		}
	});

	if (!existingExpense) {
		throw new AppError("Expense not found", 404);
	}

	await db.expense.delete({
		where: {
			id: expenseId
		}
	});

	res.status(200).json({ message: "Expense deleted successfully" });
});