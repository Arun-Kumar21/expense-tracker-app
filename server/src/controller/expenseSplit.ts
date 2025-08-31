import { Request, Response } from "express";
import { UpdateExpenseSplitSchema, MarkExpenseSplitPaidSchema } from "../types";
import db from "../db";
import { asyncHandler, AppError } from "../middleware/errorHandler";

// @desc    Get expense split by ID
// @route   GET /api/v1/expense-splits/:splitId
export const getExpenseSplitById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { splitId } = req.params;

    if (!splitId) {
        throw new AppError("Split ID is required", 400);
    }

    const expenseSplit = await db.expenseSplit.findFirst({
        where: {
            id: splitId,
            OR: [
                { userId: req.userId },
                {
                    splitExpense: {
                        paidById: req.userId
                    }
                }
            ]
        },
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
        }
    });

    if (!expenseSplit) {
        throw new AppError("Expense split not found or you don't have access", 404);
    }

    res.status(200).json(expenseSplit);
});

// @desc    Update expense split (mark as paid/unpaid, update amount)
// @route   PUT /api/v1/expense-splits/:splitId
export const updateExpenseSplit = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { splitId } = req.params;

    if (!splitId) {
        throw new AppError("Split ID is required", 400);
    }

    const parsedData = UpdateExpenseSplitSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    // Check if user has permission to update this split
    const expenseSplit = await db.expenseSplit.findFirst({
        where: {
            id: splitId,
            OR: [
                { userId: req.userId }, // User can update their own split
                {
                    splitExpense: {
                        paidById: req.userId // Payer can update any split for their expense
                    }
                }
            ]
        },
        include: {
            splitExpense: {
                include: {
                    group: true
                }
            }
        }
    });

    if (!expenseSplit) {
        throw new AppError("Expense split not found or you don't have permission to update it", 404);
    }

    const updateData: any = {};

    // If marking as paid, set settledAt timestamp
    if (parsedData.data.isPaid !== undefined) {
        updateData.isPaid = parsedData.data.isPaid;
        if (parsedData.data.isPaid) {
            updateData.settledAt = new Date();
        } else {
            updateData.settledAt = null;
        }
    }

    // Only the payer can update the amount
    if (parsedData.data.amount !== undefined) {
        if (expenseSplit.splitExpense.paidById !== req.userId) {
            throw new AppError("Only the payer can update split amounts", 403);
        }
        updateData.amount = parsedData.data.amount;
    }

    const updatedSplit = await db.expenseSplit.update({
        where: { id: splitId },
        data: updateData,
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
        }
    });

    res.status(200).json(updatedSplit);
});

// @desc    Mark multiple expense splits as paid
// @route   POST /api/v1/expense-splits/mark-paid
export const markExpenseSplitsPaid = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const parsedData = MarkExpenseSplitPaidSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const { expenseSplitIds } = parsedData.data;

    // Verify user has permission to mark these splits as paid
    const expenseSplits = await db.expenseSplit.findMany({
        where: {
            id: { in: expenseSplitIds },
            OR: [
                { userId: req.userId }, // User can mark their own splits as paid
                {
                    splitExpense: {
                        paidById: req.userId // Payer can mark any split for their expense as paid
                    }
                }
            ]
        },
        include: {
            splitExpense: {
                select: {
                    paidById: true,
                    group: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }
        }
    });

    if (expenseSplits.length !== expenseSplitIds.length) {
        throw new AppError("Some expense splits not found or you don't have permission", 404);
    }

    // Update all splits to paid
    const updatedSplits = await db.expenseSplit.updateMany({
        where: {
            id: { in: expenseSplitIds }
        },
        data: {
            isPaid: true,
            settledAt: new Date()
        }
    });

    res.status(200).json({
        message: `${updatedSplits.count} expense splits marked as paid`,
        updatedCount: updatedSplits.count
    });
});

// @desc    Mark expense split as unpaid
// @route   POST /api/v1/expense-splits/:splitId/mark-unpaid
export const markExpenseSplitUnpaid = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { splitId } = req.params;

    if (!splitId) {
        throw new AppError("Split ID is required", 400);
    }

    // Check if user has permission to mark this split as unpaid
    const expenseSplit = await db.expenseSplit.findFirst({
        where: {
            id: splitId,
            OR: [
                { userId: req.userId }, // User can mark their own split as unpaid
                {
                    splitExpense: {
                        paidById: req.userId // Payer can mark any split for their expense as unpaid
                    }
                }
            ]
        }
    });

    if (!expenseSplit) {
        throw new AppError("Expense split not found or you don't have permission", 404);
    }

    const updatedSplit = await db.expenseSplit.update({
        where: { id: splitId },
        data: {
            isPaid: false,
            settledAt: null
        },
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
        }
    });

    res.status(200).json(updatedSplit);
});

// @desc    Get all expense splits for a group
// @route   GET /api/v1/expense-splits/group/:groupId
export const getGroupExpenseSplits = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId } = req.params;
    const { isPaid, userId } = req.query;

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

    const whereClause: any = {
        splitExpense: {
            groupId: groupId
        }
    };

    if (isPaid !== undefined) {
        whereClause.isPaid = isPaid === 'true';
    }

    if (userId) {
        whereClause.userId = userId as string;
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
                    category: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(expenseSplits);
});

// @desc    Get expense splits summary for user
// @route   GET /api/v1/expense-splits/my-summary
export const getMyExpenseSplitsSummary = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    // Get splits where user owes money
    const myDebts = await db.expenseSplit.findMany({
        where: {
            userId: req.userId,
            isPaid: false
        },
        include: {
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
                    }
                }
            }
        }
    });

    // Get splits where user is owed money
    const owedToMe = await db.expenseSplit.findMany({
        where: {
            splitExpense: {
                paidById: req.userId
            },
            userId: { not: req.userId },
            isPaid: false
        },
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
                    }
                }
            }
        }
    });

    // Calculate totals
    const totalDebt = myDebts.reduce((sum, split) => sum + split.amount, 0);
    const totalOwed = owedToMe.reduce((sum, split) => sum + split.amount, 0);
    const netBalance = totalOwed - totalDebt;

    // Group by person for easier understanding
    const debtsByPerson = new Map();
    myDebts.forEach(debt => {
        const payerId = debt.splitExpense.paidBy.id;
        if (!debtsByPerson.has(payerId)) {
            debtsByPerson.set(payerId, {
                user: debt.splitExpense.paidBy,
                totalOwed: 0,
                expenses: []
            });
        }
        const entry = debtsByPerson.get(payerId);
        entry.totalOwed += debt.amount;
        entry.expenses.push({
            id: debt.id,
            amount: debt.amount,
            description: debt.splitExpense.description,
            group: debt.splitExpense.group,
            date: debt.splitExpense.date
        });
    });

    const owedByPerson = new Map();
    owedToMe.forEach(owed => {
        const debtorId = owed.user.id;
        if (!owedByPerson.has(debtorId)) {
            owedByPerson.set(debtorId, {
                user: owed.user,
                totalOwed: 0,
                expenses: []
            });
        }
        const entry = owedByPerson.get(debtorId);
        entry.totalOwed += owed.amount;
        entry.expenses.push({
            id: owed.id,
            amount: owed.amount,
            description: owed.splitExpense.description,
            group: owed.splitExpense.group,
            date: owed.splitExpense.date
        });
    });

    const summary = {
        totalDebt,
        totalOwed,
        netBalance,
        debtsByPerson: Array.from(debtsByPerson.values()),
        owedByPerson: Array.from(owedByPerson.values()),
        recentActivity: {
            myDebts: myDebts.slice(0, 5),
            owedToMe: owedToMe.slice(0, 5)
        }
    };

    res.status(200).json(summary);
});
