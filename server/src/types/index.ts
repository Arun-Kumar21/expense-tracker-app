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

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}