import { v4 as uuidv4 } from 'uuid'

/**
 * Generate a v4 UUID string
 * @returns UUID in standard format (36-character string)
 */
export function generateUUID(): string {
  return uuidv4()
}
