export type UserRole = 'admin' | 'super' | 'regular';

export interface UserProfile {
    id: string;
    authUid?: string;
    name: string;
    email?: string | null;
    phone: string;
    role: UserRole;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
    paymentUnitId?: string | null;
    mustChangePassword?: boolean;
    groups?: string[];
    gameStats?: any;
}