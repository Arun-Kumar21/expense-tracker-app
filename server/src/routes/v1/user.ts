import express from "express";
import { getUserById, getUserByUsername } from "../../controller/user";

export const userRouter = express.Router();

userRouter.get("/:userId", getUserById);
userRouter.post("/search", getUserByUsername);
