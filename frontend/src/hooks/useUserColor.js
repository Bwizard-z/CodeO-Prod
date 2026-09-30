// hooks/useUserColor.js - Deterministic, Consistent User Color Generation
import { useMemo } from 'react';

export const USER_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#10B981', // Green
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
];

/**
 * Generates a consistent, deterministic hex color for a given user ID or name.
 * The same user will always receive the exact same color.
 *
 * @param {string} userIdOrName
 * @returns {string} Hex color code
 */
export function generateUserColor(userIdOrName = '') {
  const seed = String(userIdOrName || 'user').trim();
  if (!seed) return USER_COLORS[0];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
}

/**
 * React hook to memoize user color based on user ID or name.
 *
 * @param {string} userIdOrName
 * @returns {string} Hex color code
 */
export function useUserColor(userIdOrName) {
  return useMemo(() => generateUserColor(userIdOrName), [userIdOrName]);
}

export default useUserColor;
