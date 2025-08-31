import { Request, Response } from "express";
import { CreateSplitExpenseSchema, UpdateSplitExpenseSchema } from "../types";
import db from "../db";
import { asyncHandler, AppError } from "../middleware/errorHandler";

// @desc    Get all split expenses for user (across all groups)
// @route   GET /api/v1/split-expenses
export const getSplitExpenses = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId, limit = 20, offset = 0 } = req.query;

    const whereClause: any = {
        OR: [
            { paidById: req.userId },
            {
                expenseSplits: {
                    some: {
                        userId: req.userId
                    }
                }
            }
        ]
    };

    if (groupId) {
        whereClause.groupId = groupId as string;
    }

    const splitExpenses = await db.splitExpense.findMany({
        where: whereClause,
        include: {
            paidBy: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            group: {
                select: {
                    id: true,
                    name: true,
                    image: true
                }
            },
            category: true,
            expenseSplits: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset)
    });

    res.status(200).json(splitExpenses);
});

// @desc    Get split expense by ID
// @route   GET /api/v1/split-expenses/:expenseId
export const getSplitExpenseById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { expenseId } = req.params;

    if (!expenseId) {
        throw new AppError("Expense ID is required", 400);
    }

    const splitExpense = await db.splitExpense.findFirst({
        where: {
            id: expenseId,
            OR: [
                { paidById: req.userId },
                {
                    expenseSplits: {
                        some: {
                            userId: req.userId
                        }
                    }
                }
            ]
        },
        include: {
            paidBy: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            group: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                    creator: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true
                        }
                    }
                }
            },
            category: true,
            expenseSplits: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!splitExpense) {
        throw new AppError("Split expense not found or you don't have access", 404);
    }

    res.status(200).json(splitExpense);
});

// @desc    Create a new split expense
// @route   POST /api/v1/split-expenses
export const createSplitExpense = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const parsedData = CreateSplitExpenseSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const { groupId, amount, description, categoryId, date, splitType, customSplits } = parsedData.data;

    // Verify user is a member of the group
    const groupMembership = await db.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: req.userId,
            isActive: true
        },
        include: {
            group: {
                include: {
                    members: {
                        where: { isActive: true },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    displayName: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!groupMembership) {
        throw new AppError("Group not found or you're not a member", 404);
    }

    // Verify category exists and belongs to user (if provided)
    if (categoryId) {
        const category = await db.category.findFirst({
            where: {
                id: categoryId,
                OR: [
                    { userId: req.userId },
                    { userId: null } // Global categories
                ]
            }
        });

        if (!category) {
            throw new AppError("Category not found or you don't have access", 404);
        }
    }

    const activeMembers = groupMembership.group.members;

    // Calculate splits based on splitType
    let splits: { userId: string; amount: number }[] = [];

    if (splitType === 'Equal') {
        const splitAmount = amount / activeMembers.length;
        splits = activeMembers.map(member => ({
            userId: member.userId,
            amount: Math.round(splitAmount * 100) / 100 // Round to 2 decimal places
        }));
    } else if (splitType === 'Amount' && customSplits) {
        // Validate custom splits
        const totalCustomAmount = customSplits.reduce((sum, split) => sum + split.amount, 0);
        if (Math.abs(totalCustomAmount - amount) > 0.01) {
            throw new AppError("Sum of custom split amounts must equal total expense amount", 400);
        }

        // Validate all split users are group members
        const memberIds = activeMembers.map(m => m.userId);
        const invalidUsers = customSplits.filter(split => !memberIds.includes(split.userId));
        if (invalidUsers.length > 0) {
            throw new AppError("Some users in custom splits are not group members", 400);
        }

        splits = customSplits.map(split => ({
            userId: split.userId,
            amount: split.amount
        }));
    } else if (splitType === 'Percentage' && customSplits) {
        // Validate percentages sum to 100
        const totalPercentage = customSplits.reduce((sum, split) => sum + (split.percentage || 0), 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
            throw new AppError("Sum of percentages must equal 100%", 400);
        }

        // Validate all split users are group members
        const memberIds = activeMembers.map(m => m.userId);
        const invalidUsers = customSplits.filter(split => !memberIds.includes(split.userId));
        if (invalidUsers.length > 0) {
            throw new AppError("Some users in custom splits are not group members", 400);
        }

        splits = customSplits.map(split => ({
            userId: split.userId,
            amount: Math.round((amount * (split.percentage || 0) / 100) * 100) / 100
        }));
    } else {
        throw new AppError("Invalid split type or missing custom splits", 400);
    }

    // Create split expense and splits in a transaction
    const result = await db.$transaction(async (tx) => {
        const splitExpense = await tx.splitExpense.create({
            data: {
                groupId,
                paidById: req.userId!,
                amount,
                description,
                categoryId,
                date: date || new Date(),
                splitType
            }
        });

        // Create expense splits
        const expenseSplits = await tx.expenseSplit.createMany({
            data: splits.map(split => ({
                splitExpenseId: splitExpense.id,
                userId: split.userId,
                amount: split.amount,
                isPaid: split.userId === req.userId // Mark as paid if it's the person who paid
            }))
        });

        return splitExpense;
    });

    // Fetch the created expense with all details
    const createdExpense = await db.splitExpense.findUnique({
        where: { id: result.id },
        include: {
            paidBy: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            group: {
                select: {
                    id: true,
                    name: true,
                    image: true
                }
            },
            category: true,
            expenseSplits: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    }
                }
            }
        }
    });

    res.status(201).json(createdExpense);
});

// @desc    Update split expense
// @route   PUT /api/v1/split-expenses/:expenseId
export const updateSplitExpense = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { expenseId } = req.params;

    if (!expenseId) {
        throw new AppError("Expense ID is required", 400);
    }

    const parsedData = UpdateSplitExpenseSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    // Check if user is the one who paid for this expense
    const splitExpense = await db.splitExpense.findFirst({
        where: {
            id: expenseId,
            paidById: req.userId
        },
        include: {
            expenseSplits: true
        }
    });

    if (!splitExpense) {
        throw new AppError("Split expense not found or you don't have permission to update it", 404);
    }

    // Check if any splits have been paid (except by the payer themselves)
    const paidSplits = splitExpense.expenseSplits.filter(split =>
        split.isPaid && split.userId !== req.userId
    );

    if (paidSplits.length > 0) {
        throw new AppError("Cannot update expense after payments have been made", 400);
    }

    // Verify category exists and belongs to user (if provided)
    if (parsedData.data.categoryId) {
        const category = await db.category.findFirst({
            where: {
                id: parsedData.data.categoryId,
                OR: [
                    { userId: req.userId },
                    { userId: null } // Global categories
                ]
            }
        });

        if (!category) {
            throw new AppError("Category not found or you don't have access", 404);
        }
    }

    const updatedExpense = await db.splitExpense.update({
        where: { id: expenseId },
        data: parsedData.data,
        include: {
            paidBy: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            group: {
                select: {
                    id: true,
                    name: true,
                    image: true
                }
            },
            category: true,
            expenseSplits: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    }
                }
            }
        }
    });

    res.status(200).json(updatedExpense);
});

// @desc    Delete split expense
// @route   DELETE /api/v1/split-expenses/:expenseId
export const deleteSplitExpense = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { expenseId } = req.params;

    if (!expenseId) {
        throw new AppError("Expense ID is required", 400);
    }

    // Check if user is the one who paid for this expense
    const splitExpense = await db.splitExpense.findFirst({
        where: {
            id: expenseId,
            paidById: req.userId
        },
        include: {
            expenseSplits: true
        }
    });

    if (!splitExpense) {
        throw new AppError("Split expense not found or you don't have permission to delete it", 404);
    }

    // Check if any splits have been paid (except by the payer themselves)
    const paidSplits = splitExpense.expenseSplits.filter(split =>
        split.isPaid && split.userId !== req.userId
    );

    if (paidSplits.length > 0) {
        throw new AppError("Cannot delete expense after payments have been made", 400);
    }

    // Delete the expense (cascading delete will handle splits)
    await db.splitExpense.delete({
        where: { id: expenseId }
    });

    res.status(200).json({ message: "Split expense deleted successfully" });
});

// @desc    Get split expenses for a specific group
// @route   GET /api/v1/split-expenses/group/:groupId
export const getGroupSplitExpenses = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    if (!groupId) {
        throw new AppError("Group ID is required", 400);
    }

    // Verify user is a member of the group
    const groupMembership = await db.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: req.userId,
            isActive: true
        }
    });

    if (!groupMembership) {
        throw new AppError("Group not found or you're not a member", 404);
    }

    const splitExpenses = await db.splitExpense.findMany({
        where: { groupId },
        include: {
            paidBy: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            category: true,
            expenseSplits: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset)
    });

    res.status(200).json(splitExpenses);
});

// @desc    Get user's split expenses (where they owe money)
// @route   GET /api/v1/split-expenses/my-debts
export const getMyDebts = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { isPaid } = req.query;

    const whereClause: any = {
        userId: req.userId
    };

    if (isPaid !== undefined) {
        whereClause.isPaid = isPaid === 'true';
    }

    const expenseSplits = await db.expenseSplit.findMany({
        where: whereClause,
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            splitExpense: {
                include: {
                    paidBy: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    },
                    group: {
                        select: {
                            id: true,
                            name: true,
                            image: true
                        }
                    },
                    category: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(expenseSplits);
});

// @desc    Get user's split expenses (where they are owed money)
// @route   GET /api/v1/split-expenses/owed-to-me
export const getOwedToMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { isPaid } = req.query;

    const whereClause: any = {
        splitExpense: {
            paidById: req.userId
        },
        userId: { not: req.userId } // Exclude self
    };

    if (isPaid !== undefined) {
        whereClause.isPaid = isPaid === 'true';
    }

    const expenseSplits = await db.expenseSplit.findMany({
        where: whereClause,
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            splitExpense: {
                include: {
                    group: {
                        select: {
                            id: true,
                            name: true,
                            image: true
                        }
                    },
                    category: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(expenseSplits);
});
