export type ToolCategory = 'all' | 'organize' | 'convert' | 'optimize' | 'security';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  categoryLabel: string;
  iconName: string;
  badgeBg: string;
  iconColor: string;
}
