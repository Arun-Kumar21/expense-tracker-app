import * as z from 'zod';

export const SignupSchema = z.object({
    displayName: z.string().min(3),
    username: z.string().min(3),
    password: z.string().min(8),
})


export const SigninSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(8)
})

export const UpdateMetadataSchema = z.object({
    avatar: z.string()
})


export const AddCategorySchema = z.object({
    name: z.string().min(3).max(30),
    icon: z.string().optional(),
    color: z.string().optional(),
})

export const UpdateCategorySchema = z.object({
    name: z.string().min(3).max(30).optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
})

export const AddExpenseSchema = z.object({
    amount: z.number().min(0.01),
    description: z.string().min(3).max(100),
    categoryId: z.string(),
    date: z.date().optional()
})


declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}