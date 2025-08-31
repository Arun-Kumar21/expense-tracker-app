import { Request, Response } from "express";
import { CreateSettlementSchema, UpdateSettlementSchema } from "../types";
import db from "../db";
import { asyncHandler, AppError } from "../middleware/errorHandler";

// @desc    Get all settlements for user
// @route   GET /api/v1/settlements
export const getSettlements = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { limit = 20, offset = 0, type } = req.query;

    let whereClause: any = {
        OR: [
            { fromUserId: req.userId },
            { toUserId: req.userId }
        ]
    };

    // Filter by type (sent/received)
    if (type === 'sent') {
        whereClause = { fromUserId: req.userId };
    } else if (type === 'received') {
        whereClause = { toUserId: req.userId };
    }

    const settlements = await db.settlement.findMany({
        where: whereClause,
        include: {
            fromUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            toUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        },
        orderBy: { settledAt: 'desc' },
        take: Number(limit),
        skip: Number(offset)
    });

    res.status(200).json(settlements);
});

// @desc    Get settlement by ID
// @route   GET /api/v1/settlements/:settlementId
export const getSettlementById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { settlementId } = req.params;

    if (!settlementId) {
        throw new AppError("Settlement ID is required", 400);
    }

    const settlement = await db.settlement.findFirst({
        where: {
            id: settlementId,
            OR: [
                { fromUserId: req.userId },
                { toUserId: req.userId }
            ]
        },
        include: {
            fromUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            toUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        }
    });

    if (!settlement) {
        throw new AppError("Settlement not found or you don't have access", 404);
    }

    res.status(200).json(settlement);
});

// @desc    Create a new settlement
// @route   POST /api/v1/settlements
export const createSettlement = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const parsedData = CreateSettlementSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const { toUserId, amount, description, splitExpenseId } = parsedData.data;

    // Validate that toUser exists
    const toUser = await db.user.findUnique({
        where: { id: toUserId },
        select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true
        }
    });

    if (!toUser) {
        throw new AppError("Recipient user not found", 404);
    }

    // Cannot settle with yourself
    if (toUserId === req.userId) {
        throw new AppError("Cannot create settlement with yourself", 400);
    }

    // Check if users are friends
    const friendship = await db.friendship.findFirst({
        where: {
            OR: [
                { initiatorId: req.userId, receiverId: toUserId },
                { initiatorId: toUserId, receiverId: req.userId }
            ]
        }
    });

    if (!friendship) {
        throw new AppError("You can only settle with friends", 400);
    }

    // If splitExpenseId is provided, validate it and check balances
    if (splitExpenseId) {
        const splitExpense = await db.splitExpense.findFirst({
            where: {
                id: splitExpenseId,
                OR: [
                    { paidById: req.userId },
                    { paidById: toUserId },
                    {
                        expenseSplits: {
                            some: {
                                OR: [
                                    { userId: req.userId },
                                    { userId: toUserId }
                                ]
                            }
                        }
                    }
                ]
            },
            include: {
                expenseSplits: {
                    where: {
                        OR: [
                            { userId: req.userId },
                            { userId: toUserId }
                        ]
                    }
                }
            }
        });

        if (!splitExpense) {
            throw new AppError("Split expense not found or you don't have access", 404);
        }

        // Validate settlement amount doesn't exceed what's owed
        const userSplit = splitExpense.expenseSplits.find(split => split.userId === req.userId);
        if (userSplit && !userSplit.isPaid && userSplit.amount < amount) {
            throw new AppError("Settlement amount cannot exceed what you owe", 400);
        }
    }

    // Create settlement
    const settlement = await db.settlement.create({
        data: {
            fromUserId: req.userId,
            toUserId,
            amount,
            description,
            splitExpenseId
        },
        include: {
            fromUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            toUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        }
    });

    // If this settlement is for a specific split expense, mark related splits as paid
    if (splitExpenseId) {
        await db.expenseSplit.updateMany({
            where: {
                splitExpenseId: splitExpenseId,
                userId: req.userId,
                amount: { lte: amount }, // Only mark as paid if settlement covers full amount
                isPaid: false
            },
            data: {
                isPaid: true,
                settledAt: new Date()
            }
        });
    }

    res.status(201).json(settlement);
});

// @desc    Update settlement
// @route   PUT /api/v1/settlements/:settlementId
export const updateSettlement = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { settlementId } = req.params;

    if (!settlementId) {
        throw new AppError("Settlement ID is required", 400);
    }

    const parsedData = UpdateSettlementSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    // Check if user is the one who made the settlement
    const settlement = await db.settlement.findFirst({
        where: {
            id: settlementId,
            fromUserId: req.userId
        }
    });

    if (!settlement) {
        throw new AppError("Settlement not found or you don't have permission to update it", 404);
    }

    // Check if settlement was made recently (allow updates within 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (settlement.settledAt < oneDayAgo) {
        throw new AppError("Cannot update settlement after 24 hours", 400);
    }

    const updatedSettlement = await db.settlement.update({
        where: { id: settlementId },
        data: parsedData.data,
        include: {
            fromUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            toUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        }
    });

    res.status(200).json(updatedSettlement);
});

// @desc    Delete settlement
// @route   DELETE /api/v1/settlements/:settlementId
export const deleteSettlement = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { settlementId } = req.params;

    if (!settlementId) {
        throw new AppError("Settlement ID is required", 400);
    }

    // Check if user is the one who made the settlement
    const settlement = await db.settlement.findFirst({
        where: {
            id: settlementId,
            fromUserId: req.userId
        }
    });

    if (!settlement) {
        throw new AppError("Settlement not found or you don't have permission to delete it", 404);
    }

    // Check if settlement was made recently (allow deletion within 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (settlement.settledAt < oneDayAgo) {
        throw new AppError("Cannot delete settlement after 24 hours", 400);
    }

    // If settlement was linked to specific expense splits, mark them as unpaid
    if (settlement.splitExpenseId) {
        await db.expenseSplit.updateMany({
            where: {
                splitExpenseId: settlement.splitExpenseId,
                userId: req.userId,
                settledAt: settlement.settledAt
            },
            data: {
                isPaid: false,
                settledAt: null
            }
        });
    }

    // Delete the settlement
    await db.settlement.delete({
        where: { id: settlementId }
    });

    res.status(200).json({ message: "Settlement deleted successfully" });
});

// @desc    Get settlement summary for user
// @route   GET /api/v1/settlements/summary
export const getSettlementSummary = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { timeframe = '30' } = req.query; // days
    const daysAgo = new Date(Date.now() - Number(timeframe) * 24 * 60 * 60 * 1000);

    // Get settlements sent by user
    const sentSettlements = await db.settlement.findMany({
        where: {
            fromUserId: req.userId,
            settledAt: { gte: daysAgo }
        },
        include: {
            toUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        }
    });

    // Get settlements received by user
    const receivedSettlements = await db.settlement.findMany({
        where: {
            toUserId: req.userId,
            settledAt: { gte: daysAgo }
        },
        include: {
            fromUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        }
    });

    // Calculate totals
    const totalSent = sentSettlements.reduce((sum, settlement) => sum + settlement.amount, 0);
    const totalReceived = receivedSettlements.reduce((sum, settlement) => sum + settlement.amount, 0);

    // Group by user for better insights
    const sentByUser = new Map();
    sentSettlements.forEach(settlement => {
        const userId = settlement.toUser.id;
        if (!sentByUser.has(userId)) {
            sentByUser.set(userId, {
                user: settlement.toUser,
                totalAmount: 0,
                settlementCount: 0,
                settlements: []
            });
        }
        const entry = sentByUser.get(userId);
        entry.totalAmount += settlement.amount;
        entry.settlementCount += 1;
        entry.settlements.push({
            id: settlement.id,
            amount: settlement.amount,
            description: settlement.description,
            settledAt: settlement.settledAt
        });
    });

    const receivedByUser = new Map();
    receivedSettlements.forEach(settlement => {
        const userId = settlement.fromUser.id;
        if (!receivedByUser.has(userId)) {
            receivedByUser.set(userId, {
                user: settlement.fromUser,
                totalAmount: 0,
                settlementCount: 0,
                settlements: []
            });
        }
        const entry = receivedByUser.get(userId);
        entry.totalAmount += settlement.amount;
        entry.settlementCount += 1;
        entry.settlements.push({
            id: settlement.id,
            amount: settlement.amount,
            description: settlement.description,
            settledAt: settlement.settledAt
        });
    });

    const summary = {
        timeframeInDays: Number(timeframe),
        totalSent,
        totalReceived,
        netFlow: totalReceived - totalSent,
        sentSettlementsCount: sentSettlements.length,
        receivedSettlementsCount: receivedSettlements.length,
        sentByUser: Array.from(sentByUser.values()),
        receivedByUser: Array.from(receivedByUser.values()),
        recentSettlements: {
            sent: sentSettlements.slice(0, 5),
            received: receivedSettlements.slice(0, 5)
        }
    };

    res.status(200).json(summary);
});

// @desc    Get settlements between two users
// @route   GET /api/v1/settlements/with/:userId
export const getSettlementsWith = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { userId } = req.params;

    if (!userId) {
        throw new AppError("User ID is required", 400);
    }

    // Verify the other user exists
    const otherUser = await db.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true
        }
    });

    if (!otherUser) {
        throw new AppError("User not found", 404);
    }

    // Get all settlements between the two users
    const settlements = await db.settlement.findMany({
        where: {
            OR: [
                { fromUserId: req.userId, toUserId: userId },
                { fromUserId: userId, toUserId: req.userId }
            ]
        },
        include: {
            fromUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            toUser: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        },
        orderBy: { settledAt: 'desc' }
    });

    // Calculate net balance
    let netBalance = 0;
    settlements.forEach(settlement => {
        if (settlement.fromUserId === req.userId) {
            netBalance -= settlement.amount; // I paid them
        } else {
            netBalance += settlement.amount; // They paid me
        }
    });

    const summary = {
        otherUser,
        netBalance, // Positive means they owe me, negative means I owe them
        totalSettlements: settlements.length,
        settlements
    };

    res.status(200).json(summary);
});
