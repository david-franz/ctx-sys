import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique identifier using UUID v4
 */
export function generateId(): string {
  return uuidv4();
}
