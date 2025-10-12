export interface ChipsConfig {
    chips: number;
    amount: number;
}

export interface Group {
    id: string;
    name: string;
    currency: string;
    buyIn: ChipsConfig;
    rebuy: ChipsConfig;
    useRoundingRule: boolean;    // האם להשתמש בחוק עיגול (80% או אחר)
    roundingRulePercentage?: number; // האחוז לחישוב (למשל 80), חייב להיות גדול מ-0 אם useRoundingRule=true
    permanentPlayers: string[];
    guestPlayers: string[];
    recentGames?: string[];    // Added: מערך של מזהי המשחקים האחרונים בקבוצה
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
    createdBy: string;
}