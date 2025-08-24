import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler";

export const adminMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const header = req.headers["authorization"];
	const token = header && header.split(" ")[1];

	if (!token) {
		return next(new AppError("Unauthorized", 401));
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
			role: string;
			userId: string;
		};
		if (decoded.role !== "Admin") {
			return next(new AppError("Forbidden", 403));
		}
		req.userId = decoded.userId;
		next();
	} catch (error) {
		return next(new AppError("Unauthorized", 401));
	}
};
