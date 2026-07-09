/**
 * Generates a collision-resistant ID: "<prefix>-<timestamp>-<4 random digits>".
 * Timestamp-only IDs can collide when two requests land in the same millisecond;
 * the random suffix makes that practically impossible while keeping the ID
 * fully numeric after the prefix (safe for existing parseInt/split('-') usages).
 */
export function generateId(prefix) {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${Date.now()}-${randomSuffix}`;
}
