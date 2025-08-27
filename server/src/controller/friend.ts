import { Request, Response } from "express";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { SendFriendRequestSchema } from "../types";


// @desc    Get all friends
// @route   GET /api/v1/friends

export const getAllFriends = async (req: Request, res: Response) => {
    if (!req.userId) { 
        throw new AppError("Unauthorized", 401);
    }

    const friends = await db.friendship.findMany({
        where: {
            OR: [
                { initiatorId: req.userId },
                { receiverId: req.userId  }
            ]
        }
    })

    res.json({friends})
}


// @desc    Get friend detail with userId
// @route   GET /api/v1/friends/:friendId

export const getFriendInfo = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const friendId = req.params.friendId; 

    if (!friendId) {
        throw new AppError("Friend id missing", 400);
    }

    if (req.userId === friendId) {
        throw new AppError("Cannot get your own info as a friend", 400);
    }
    
    const friend = await db.user.findUnique({
        where: {
            id: friendId
        },
        omit : {
            password: true,
            role: true
        }
    })

    if (!friend) {
        throw new AppError("Friend not found", 404);
    }

    res.json({friend});
}

// @desc    Get all friends requests
// @route   GET /api/v1/friends/requests

export const getAllFriendRequests = async (req:Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const receivedRequests = await db.friendRequest.findMany({
        where: {
            receiverId: req.userId,
        }
    })

    const sentRequests = await db.friendRequest.findMany({
        where: {
            senderId: req.userId
        }
    })


    return res.json({
        sentRequests,
        receivedRequests
    })
};

// @desc    Send a friend request
// @route   POST /api/v1/friends/requests

export const sendFriendRequest = async (req: Request, res: Response) => {
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
    })

    if (!user) {
        throw new AppError("User not found", 404);
    }

    if (req.userId === user.id) {
        throw new AppError("You cannot send a friend request to yourself", 400);
    }


    const existingFriendship = await db.friendship.findFirst({
        where: {
            OR: [
                {initiatorId: req.userId, receiverId: user.id},
                {initiatorId: user.id, receiverId: req.userId}
            ]
        }
    })

    if (existingFriendship) {
        throw new AppError("Friendship already exists", 400);
    }

    const request = await db.friendRequest.create({
        data: {
            senderId: req.userId,
            receiverId: user.id,
            message: parsedData.data.message
        }
    })

    return res.json({request});
}

// @desc    Remove friend request
// @route   DELETE  /api/v1/friends/requests/:requestId

export const removeFriendRequest = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const requestId = req.params.requestId;

    if (!requestId) {
        throw new AppError("Missing requestId", 400);
    }

    const request = await db.friendRequest.findUnique({
        where: {
            id: requestId,
            senderId: req.userId
        }
    })

    if (!request) {
        throw new AppError("No such friend request exist", 404);
    } 

    await db.friendRequest.delete({
        where: {
            id: requestId
        }
    })

    res.status(200).json({message: "Request deleted successfully"});
}


// @desc    Accept friend request
// @route   PUT /api/v1/friends/requests/:requestId/accept

export const acceptFriendRequest = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const requestId = req.params.requestId

    if (!requestId) {
        throw new AppError("RequestId missing", 400);
    }

    const request = await db.friendRequest.findUnique({
        where: {
            id: requestId,
            receiverId: req.userId
        }
    })

    if (!request) {
        throw new AppError("Request not found", 404);
    }

    await db.friendRequest.update({
        where: {
            id: requestId
        },
        data: {
            status: "Accepted"
        }
    })

    await db.friendship.create({
        data: {
            initiatorId: request.senderId,
            receiverId: request.receiverId
        }
    })

    res.status(200).json({ message: "Accepted request"});
}


// @desc    Reject friend request
// @route   PUT /api/v1/friends/requests/:requestId/reject

export const rejectFriendRequest = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const requestId = req.params.requestId

    if (!requestId) {
        throw new AppError("RequestId missing", 400);
    }

    const request = await db.friendRequest.findUnique({
        where: {
            id: requestId,
            receiverId: req.userId
        }
    })

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
    })

    res.status(200).json({ message: "Rejected request"});
}

// @desc    Remove friend
// @route   DELETE /api/v1/friends/:friendId

export const removeFriend = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Unauthorized", 401);
    }

    const friendId = req.params.friendId;

    if (!friendId) {
        throw new AppError("FriendId missing", 400);
    }

    const friendship = await db.friendship.findFirst({
        where: {
            OR: [
                {initiatorId: req.userId, receiverId: friendId},
                {initiatorId: friendId, receiverId: req.userId},
            ]
        }
    })

    if (!friendship) {
        throw new AppError("Friendship didn't exist", 404);
    }

    // Remove friendship using compound unique key
    if (friendship.initiatorId === req.userId && friendship.receiverId === friendId) {
        await db.friendship.delete({
            where: {
                initiatorId_receiverId: {
                    initiatorId: req.userId,
                    receiverId: friendId
                }
            }
        });
    } else if (friendship.initiatorId === friendId && friendship.receiverId === req.userId) {
        await db.friendship.delete({
            where: {
                initiatorId_receiverId: {
                    initiatorId: friendId,
                    receiverId: req.userId
                }
            }
        });
    }

    res.json({ message: "Successfully remove friendship" });
}

