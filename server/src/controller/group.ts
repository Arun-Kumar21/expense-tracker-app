import { Request, Response } from "express";
import { CreateGroupSchema, UpdateGroupSchema, AddGroupMemberSchema } from "../types";
import db from "../db";
import { asyncHandler, AppError } from "../middleware/errorHandler";

// @desc    Get all groups for user
// @route   GET /api/v1/groups
export const getGroups = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const groups = await db.splitGroup.findMany({
        where: {
            OR: [
                { creatorId: req.userId },
                {
                    members: {
                        some: {
                            userId: req.userId,
                            isActive: true
                        }
                    }
                }
            ],
            isActive: true
        },
        include: {
            creator: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            members: {
                where: { isActive: true },
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
            },
            _count: {
                select: {
                    splitExpenses: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(groups);
});

// @desc    Get group by ID
// @route   GET /api/v1/groups/:groupId
export const getGroupById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId } = req.params;

    if (!groupId) {
        throw new AppError("Group ID is required", 400);
    }

    const group = await db.splitGroup.findFirst({
        where: {
            id: groupId,
            isActive: true,
            OR: [
                { creatorId: req.userId },
                {
                    members: {
                        some: {
                            userId: req.userId,
                            isActive: true
                        }
                    }
                }
            ]
        },
        include: {
            creator: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            members: {
                where: { isActive: true },
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
                orderBy: { joinedAt: 'asc' }
            },
            splitExpenses: {
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
                                    displayName: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!group) {
        throw new AppError("Group not found or you don't have access", 404);
    }

    res.status(200).json(group);
});

// @desc    Create a new group
// @route   POST /api/v1/groups
export const createGroup = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const parsedData = CreateGroupSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const { name, description, image, memberUsernames } = parsedData.data;

    // Check if all member usernames exist and are friends with the creator
    const users = await db.user.findMany({
        where: {
            username: { in: memberUsernames }
        },
        select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true
        }
    });

    if (users.length !== memberUsernames.length) {
        const foundUsernames = users.map(u => u.username);
        const notFound = memberUsernames.filter(username => !foundUsernames.includes(username));
        throw new AppError(`Users not found: ${notFound.join(", ")}`, 400);
    }

    // Check if creator is friends with all members
    for (const user of users) {
        const friendship = await db.friendship.findFirst({
            where: {
                OR: [
                    { initiatorId: req.userId, receiverId: user.id },
                    { initiatorId: user.id, receiverId: req.userId }
                ]
            }
        });

        if (!friendship) {
            throw new AppError(`You must be friends with ${user.username} to add them to a group`, 400);
        }
    }

    // Create the group with members in a transaction
    const group = await db.$transaction(async (tx) => {
        const newGroup = await tx.splitGroup.create({
            data: {
                name,
                description,
                image,
                creatorId: req.userId!
            }
        });

        // Add all members including the creator
        const memberData = [
            ...users.map(user => ({
                groupId: newGroup.id,
                userId: user.id
            })),
            // Add creator as member if not already included
            ...(users.find(u => u.id === req.userId) ? [] : [{
                groupId: newGroup.id,
                userId: req.userId!
            }])
        ];

        await tx.groupMember.createMany({
            data: memberData
        });

        return newGroup;
    });

    // Fetch the created group with all details
    const createdGroup = await db.splitGroup.findUnique({
        where: { id: group.id },
        include: {
            creator: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            members: {
                where: { isActive: true },
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

    res.status(201).json(createdGroup);
});

// @desc    Update group details
// @route   PUT /api/v1/groups/:groupId
export const updateGroup = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId } = req.params;

    if (!groupId) {
        throw new AppError("Group ID is required", 400);
    }

    const parsedData = UpdateGroupSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    // Check if user is the creator of the group
    const group = await db.splitGroup.findFirst({
        where: {
            id: groupId,
            creatorId: req.userId,
            isActive: true
        }
    });

    if (!group) {
        throw new AppError("Group not found or you don't have permission to update it", 404);
    }

    const updatedGroup = await db.splitGroup.update({
        where: { id: groupId },
        data: parsedData.data,
        include: {
            creator: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            members: {
                where: { isActive: true },
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

    res.status(200).json(updatedGroup);
});

// @desc    Delete group (only creator can delete)
// @route   DELETE /api/v1/groups/:groupId
export const deleteGroup = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId } = req.params;

    if (!groupId) {
        throw new AppError("Group ID is required", 400);
    }

    // Check if user is the creator of the group
    const group = await db.splitGroup.findFirst({
        where: {
            id: groupId,
            creatorId: req.userId,
            isActive: true
        }
    });

    if (!group) {
        throw new AppError("Group not found or you don't have permission to delete it", 404);
    }

    // Check if there are any unsettled expenses
    const unsettledExpenses = await db.expenseSplit.findMany({
        where: {
            splitExpense: {
                groupId: groupId
            },
            isPaid: false
        }
    });

    if (unsettledExpenses.length > 0) {
        throw new AppError("Cannot delete group with unsettled expenses. Please settle all expenses first.", 400);
    }

    // Soft delete the group
    await db.splitGroup.update({
        where: { id: groupId },
        data: { isActive: false }
    });

    res.status(200).json({ message: "Group deleted successfully" });
});

// @desc    Add member to group
// @route   POST /api/v1/groups/:groupId/members
export const addGroupMember = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId } = req.params;

    if (!groupId) {
        throw new AppError("Group ID is required", 400);
    }

    const parsedData = AddGroupMemberSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const { username } = parsedData.data;

    // Check if user is a member of the group
    const userMembership = await db.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: req.userId,
            isActive: true
        },
        include: {
            group: {
                include: {
                    creator: true
                }
            }
        }
    });

    if (!userMembership) {
        throw new AppError("Group not found or you're not a member", 404);
    }

    // Find the user to add
    const userToAdd = await db.user.findUnique({
        where: { username },
        select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true
        }
    });

    if (!userToAdd) {
        throw new AppError("User not found", 404);
    }

    // Check if the adding user is friends with the user to be added
    const friendship = await db.friendship.findFirst({
        where: {
            OR: [
                { initiatorId: req.userId, receiverId: userToAdd.id },
                { initiatorId: userToAdd.id, receiverId: req.userId }
            ]
        }
    });

    if (!friendship) {
        throw new AppError(`You must be friends with ${username} to add them to the group`, 400);
    }

    // Check if user is already a member
    const existingMembership = await db.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: userToAdd.id
        }
    });

    if (existingMembership) {
        if (existingMembership.isActive) {
            throw new AppError("User is already a member of this group", 400);
        } else {
            // Reactivate membership
            await db.groupMember.update({
                where: { id: existingMembership.id },
                data: { isActive: true, joinedAt: new Date() }
            });
        }
    } else {
        // Create new membership
        await db.groupMember.create({
            data: {
                groupId: groupId,
                userId: userToAdd.id
            }
        });
    }

    res.status(200).json({ message: `${username} added to group successfully` });
});

// @desc    Remove member from group
// @route   DELETE /api/v1/groups/:groupId/members/:userId
export const removeGroupMember = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId, userId } = req.params;

    if (!groupId || !userId) {
        throw new AppError("Group ID and User ID are required", 400);
    }

    // Check if user is the creator of the group or removing themselves
    const group = await db.splitGroup.findFirst({
        where: {
            id: groupId,
            isActive: true
        }
    });

    if (!group) {
        throw new AppError("Group not found", 404);
    }

    const isCreator = group.creatorId === req.userId;
    const isRemovingSelf = userId === req.userId;

    if (!isCreator && !isRemovingSelf) {
        throw new AppError("You can only remove yourself or if you're the group creator", 403);
    }

    // Cannot remove creator from group
    if (userId === group.creatorId) {
        throw new AppError("Group creator cannot be removed from the group", 400);
    }

    // Check if user has unsettled expenses
    const unsettledExpenses = await db.expenseSplit.findMany({
        where: {
            userId: userId,
            splitExpense: {
                groupId: groupId
            },
            isPaid: false
        }
    });

    if (unsettledExpenses.length > 0) {
        throw new AppError("Cannot remove user with unsettled expenses. Please settle all expenses first.", 400);
    }

    // Remove the member (soft delete)
    await db.groupMember.updateMany({
        where: {
            groupId: groupId,
            userId: userId
        },
        data: { isActive: false }
    });

    res.status(200).json({ message: "Member removed from group successfully" });
});

// @desc    Get group expense summary
// @route   GET /api/v1/groups/:groupId/summary
export const getGroupSummary = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId } = req.params;

    if (!groupId) {
        throw new AppError("Group ID is required", 400);
    }

    // Check if user is a member of the group
    const userMembership = await db.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: req.userId,
            isActive: true
        }
    });

    if (!userMembership) {
        throw new AppError("Group not found or you're not a member", 404);
    }

    // Get all expenses for the group
    const expenses = await db.splitExpense.findMany({
        where: { groupId: groupId },
        include: {
            paidBy: {
                select: {
                    id: true,
                    username: true,
                    displayName: true
                }
            },
            category: true,
            expenseSplits: {
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
    });

    // Calculate totals
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalExpenseCount = expenses.length;

    // Calculate per member summary
    const memberSummary = new Map();

    expenses.forEach(expense => {
        expense.expenseSplits.forEach(split => {
            const userId = split.userId;
            if (!memberSummary.has(userId)) {
                memberSummary.set(userId, {
                    user: split.user,
                    totalOwed: 0,
                    totalPaid: 0,
                    netBalance: 0
                });
            }

            const summary = memberSummary.get(userId);
            summary.totalOwed += split.amount;

            if (expense.paidById === userId) {
                summary.totalPaid += expense.amount;
            }

            summary.netBalance = summary.totalPaid - summary.totalOwed;
        });
    });

    // Category-wise breakdown
    const categoryBreakdown = new Map();
    expenses.forEach(expense => {
        const categoryName = expense.category?.name || 'Uncategorized';
        if (!categoryBreakdown.has(categoryName)) {
            categoryBreakdown.set(categoryName, {
                category: expense.category || { name: 'Uncategorized' },
                totalAmount: 0,
                expenseCount: 0
            });
        }

        const breakdown = categoryBreakdown.get(categoryName);
        breakdown.totalAmount += expense.amount;
        breakdown.expenseCount += 1;
    });

    const summary = {
        groupId,
        totalExpenses,
        totalExpenseCount,
        memberSummary: Array.from(memberSummary.values()),
        categoryBreakdown: Array.from(categoryBreakdown.values()),
        recentExpenses: expenses.slice(0, 5).map(expense => ({
            id: expense.id,
            amount: expense.amount,
            description: expense.description,
            date: expense.date,
            paidBy: expense.paidBy,
            category: expense.category
        }))
    };

    res.status(200).json(summary);
});

// @desc    Get group balances (who owes whom)
// @route   GET /api/v1/groups/:groupId/balances
export const getGroupBalances = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { groupId } = req.params;

    if (!groupId) {
        throw new AppError("Group ID is required", 400);
    }

    // Check if user is a member of the group
    const userMembership = await db.groupMember.findFirst({
        where: {
            groupId: groupId,
            userId: req.userId,
            isActive: true
        }
    });

    if (!userMembership) {
        throw new AppError("Group not found or you're not a member", 404);
    }

    // Get all unsettled expense splits for the group
    const expenseSplits = await db.expenseSplit.findMany({
        where: {
            splitExpense: {
                groupId: groupId
            },
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
                    paidBy: {
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

    // Calculate balances between users
    const balances = new Map();

    expenseSplits.forEach(split => {
        const debtor = split.user;
        const creditor = split.splitExpense.paidBy;

        if (debtor.id === creditor.id) return; // Skip if same person

        const key = `${debtor.id}-${creditor.id}`;
        const reverseKey = `${creditor.id}-${debtor.id}`;

        if (balances.has(reverseKey)) {
            const existingBalance = balances.get(reverseKey);
            const newAmount = existingBalance.amount - split.amount;

            if (newAmount > 0) {
                existingBalance.amount = newAmount;
            } else if (newAmount < 0) {
                // Flip the direction
                balances.delete(reverseKey);
                balances.set(key, {
                    from: debtor,
                    to: creditor,  
                    amount: Math.abs(newAmount)
                });
            } else {
                // Exactly balanced out
                balances.delete(reverseKey);
            }
        } else if (balances.has(key)) {
            // Add to existing balance in same direction
            balances.get(key).amount += split.amount;
        } else {
            // New balance
            balances.set(key, {
                from: debtor,
                to: creditor,
                amount: split.amount
            });
        }
    });

    const balanceArray = Array.from(balances.values()).filter(balance => balance.amount > 0);

    // Calculate net balances for each user
    const userNetBalances = new Map();

    balanceArray.forEach(balance => {
        // Debtor (from) owes money
        if (!userNetBalances.has(balance.from.id)) {
            userNetBalances.set(balance.from.id, {
                user: balance.from,
                netBalance: 0
            });
        }
        userNetBalances.get(balance.from.id).netBalance -= balance.amount;

        // Creditor (to) is owed money
        if (!userNetBalances.has(balance.to.id)) {
            userNetBalances.set(balance.to.id, {
                user: balance.to,
                netBalance: 0
            });
        }
        userNetBalances.get(balance.to.id).netBalance += balance.amount;
    });

    const result = {
        groupId,
        balances: balanceArray,
        userNetBalances: Array.from(userNetBalances.values()),
        totalUnsettledAmount: balanceArray.reduce((sum, balance) => sum + balance.amount, 0)
    };

    res.status(200).json(result);
});
