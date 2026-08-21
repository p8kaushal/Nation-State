export type AchievementCategory = 'economy' | 'governance' | 'survival' | 'diplomacy';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  category: AchievementCategory;
  isSecret: boolean;
}
