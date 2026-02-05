import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique identifier using UUID v4
 */
export function generateId(prefix?: string): string {
  const id = uuidv4();
  return prefix ? `${prefix}_${id}` : id;
}
