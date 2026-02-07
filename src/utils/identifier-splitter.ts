/**
 * Split compound identifiers into searchable tokens.
 *
 * Examples:
 *   "EntityStore" → "EntityStore Entity Store entitystore"
 *   "getByName" → "getByName get By Name getbyname"
 *   "file_path" → "file_path file path"
 *   "XMLParser" → "XMLParser XML Parser xmlparser"
 */
export function splitIdentifier(name: string): string {
  const parts: string[] = [name];

  // PascalCase / camelCase splitting
  const camelParts = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')       // camelCase → camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // XMLParser → XML Parser
    .split(/\s+/);

  if (camelParts.length > 1) {
    parts.push(...camelParts);
  }

  // snake_case splitting
  if (name.includes('_')) {
    parts.push(...name.split('_').filter(Boolean));
  }

  // kebab-case splitting
  if (name.includes('-')) {
    parts.push(...name.split('-').filter(Boolean));
  }

  // Add lowercase version for case-insensitive matching
  parts.push(name.toLowerCase());

  return [...new Set(parts)].join(' ');
}
