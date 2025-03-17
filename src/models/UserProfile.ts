export type UserRole = 'admin' | 'super' | 'regular';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
    paymentUnitId?: string;
}