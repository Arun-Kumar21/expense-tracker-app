import { Request, Response } from "express";
import db from "../db";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { SendFriendRequestSchema } from "../types";


// @desc    Get all friends
// @route   GET /api/v1/friends
export const getAllFriends = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const friends = await db.friendship.findMany({
        where: {
            OR: [
                { initiatorId: req.userId },
                { receiverId: req.userId }
            ]
        },
        include: {
            initiator: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            },
            receiver: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        }
    });

    // Map to get the friend (not self) from each friendship
    const friendsList = friends.map(friendship => {
        const friend = friendship.initiatorId === req.userId
            ? friendship.receiver
            : friendship.initiator;
        return friend;
    });

    res.status(200).json({ friends: friendsList });
});


// @desc    Get friend detail with userId
// @route   GET /api/v1/friends/:friendId
export const getFriendInfo = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { friendId } = req.params;

    if (!friendId) {
        throw new AppError("Friend ID missing", 400);
    }

    if (req.userId === friendId) {
        throw new AppError("Cannot get your own info as a friend", 400);
    }

    const isFriend = await db.friendship.findFirst({
        where: {
            OR: [
                { initiatorId: req.userId, receiverId: friendId },
                { receiverId: req.userId, initiatorId: friendId }
            ]
        }
    });

    if (!isFriend) {
        throw new AppError("User is not a friend", 400);
    }

    const friend = await db.user.findUnique({
        where: {
            id: friendId
        },
        omit: {
            password: true,
            role: true
        }
    });

    if (!friend) {
        throw new AppError("Friend not found", 404);
    }

    res.status(200).json({ friend });
});

// @desc    Get all friend requests
// @route   GET /api/v1/friends/requests
export const getAllFriendRequests = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const receivedRequests = await db.friendRequest.findMany({
        where: {
            receiverId: req.userId,
        },
        include: {
            sender: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    const sentRequests = await db.friendRequest.findMany({
        where: {
            senderId: req.userId
        },
        include: {
            receiver: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    res.status(200).json({
        sentRequests,
        receivedRequests
    });
});

// @desc    Send a friend request
// @route   POST /api/v1/friends/requests
export const sendFriendRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const parsedData = SendFriendRequestSchema.safeParse(req.body);
    if (!parsedData.success) {
        throw new AppError("Validation failed", 400);
    }

    const user = await db.user.findUnique({
        where: {
            username: parsedData.data.username
        }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    if (req.userId === user.id) {
        throw new AppError("You cannot send a friend request to yourself", 400);
    }

    const existingFriendship = await db.friendship.findFirst({
        where: {
            OR: [
                { initiatorId: req.userId, receiverId: user.id },
                { initiatorId: user.id, receiverId: req.userId }
            ]
        }
    });

    if (existingFriendship) {
        throw new AppError("Friendship already exists", 400);
    }

    // Check for existing friend request
    const existingRequest = await db.friendRequest.findFirst({
        where: {
            OR: [
                { senderId: req.userId, receiverId: user.id },
                { senderId: user.id, receiverId: req.userId }
            ]
        }
    });

    if (existingRequest) {
        throw new AppError("Friend request already exists", 400);
    }

    const request = await db.friendRequest.create({
        data: {
            senderId: req.userId,
            receiverId: user.id,
            message: parsedData.data.message
        },
        include: {
            receiver: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true
                }
            }
        }
    });

    res.status(201).json({ request });
});

// @desc    Remove friend request
// @route   DELETE /api/v1/friends/requests/:requestId
export const removeFriendRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { requestId } = req.params;

    if (!requestId) {
        throw new AppError("Missing requestId", 400);
    }

    const request = await db.friendRequest.findFirst({
        where: {
            id: requestId,
            senderId: req.userId
        }
    });

    if (!request) {
        throw new AppError("No such friend request exists", 404);
    }

    await db.friendRequest.delete({
        where: {
            id: requestId
        }
    });

    res.status(200).json({ message: "Request deleted successfully" });
});


// @desc    Accept friend request
// @route   PUT /api/v1/friends/requests/:requestId/accept
export const acceptFriendRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { requestId } = req.params;

    if (!requestId) {
        throw new AppError("RequestId missing", 400);
    }

    const request = await db.friendRequest.findFirst({
        where: {
            id: requestId,
            receiverId: req.userId
        }
    });

    if (!request) {
        throw new AppError("Request not found", 404);
    }

    await db.$transaction(async (tx) => {
        await tx.friendRequest.update({
            where: {
                id: requestId
            },
            data: {
                status: "Accepted"
            }
        });

        await tx.friendship.create({
            data: {
                initiatorId: request.senderId,
                receiverId: request.receiverId
            }
        });
    });

    res.status(200).json({ message: "Friend request accepted" });
});


// @desc    Reject friend request
// @route   PUT /api/v1/friends/requests/:requestId/reject
export const rejectFriendRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { requestId } = req.params;

    if (!requestId) {
        throw new AppError("RequestId missing", 400);
    }

    const request = await db.friendRequest.findFirst({
        where: {
            id: requestId,
            receiverId: req.userId
        }
    });

    if (!request) {
        throw new AppError("Request not found", 404);
    }

    await db.friendRequest.update({
        where: {
            id: requestId
        },
        data: {
            status: "Rejected"
        }
    });

    res.status(200).json({ message: "Friend request rejected" });
});

// @desc    Remove friend
// @route   DELETE /api/v1/friends/:friendId
export const removeFriend = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { friendId } = req.params;

    if (!friendId) {
        throw new AppError("FriendId missing", 400);
    }

    const friendship = await db.friendship.findFirst({
        where: {
            OR: [
                { initiatorId: req.userId, receiverId: friendId },
                { initiatorId: friendId, receiverId: req.userId },
            ]
        }
    });

    if (!friendship) {
        throw new AppError("Friendship doesn't exist", 404);
    }

    // Remove friendship using the found friendship ID
    await db.friendship.delete({
        where: {
            id: friendship.id
        }
    });

    res.status(200).json({ message: "Successfully removed friendship" });
});

