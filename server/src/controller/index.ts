import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import db from "../db";
import { SigninSchema, SignupSchema } from "../types";
import { asyncHandler, AppError } from "../middleware/errorHandler";

export const signup = asyncHandler(
	async (req: Request, res: Response): Promise<void> => {
		const parsedData = SignupSchema.safeParse(req.body);
		if (!parsedData.success) {
			throw new AppError("Validation failed", 400);
		}

		const hashedPassword = await bcrypt.hash(parsedData.data.password, 10);

		const existingUser = await db.user.findUnique({
			where: {
				username: parsedData.data.username,
			},
		});

		if (existingUser) {
			throw new AppError("User already exists", 400);
		}

		const user = await db.user.create({
			data: {
				displayName: parsedData.data.displayName,
				username: parsedData.data.username,
				password: hashedPassword,
			},
		});

		res.json({
			userId: user.id,
		});
	}
);

export const signin = asyncHandler(async (req: Request, res: Response) => {
	const parsedData = SigninSchema.safeParse(req.body);
	if (!parsedData.success) {
		throw new AppError("Validation failed", 400);
	}

	const user = await db.user.findUnique({
		where: {
			username: parsedData.data.username,
		},
	});

	if (!user) {
		throw new AppError("User not found", 404);
	}

	const isPasswordValid = await bcrypt.compare(
		parsedData.data.password,
		user.password
	);

	if (!isPasswordValid) {
		throw new AppError("Invalid Password", 400);
	}

	const token = jwt.sign(
		{ userId: user.id, role: user.role },
		process.env.JWT_SECRET as string,
		{
			expiresIn: "7d",
		}
	);

	res.json({
		token: token,
		user: {
			id: user.id,
			username: user.username,
		},
	});
});
