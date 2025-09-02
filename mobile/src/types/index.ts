// Basic types for the expense tracker app

export interface User {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Expense {
    id: string;
    amount: number;
    description: string;
    categoryId: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Category {
    id: string;
    name: string;
    userId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface SplitGroup {
    id: string;
    name: string;
    description?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Friend {
    id: string;
    name: string;
    email: string;
}

// API Response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
