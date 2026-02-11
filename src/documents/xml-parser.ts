/**
 * Lightweight XML parser for document indexing.
 * Extracts element tree, attributes, and namespaces without a full DOM.
 */

export interface XmlElement {
  tag: string;
  attributes: Record<string, string>;
  textContent: string;
  children: XmlElement[];
  path: string;
  line: number;
}

export interface XmlDocument {
  rootTag: string;
  declaration?: Record<string, string>;
  namespaces: Record<string, string>;
  elements: XmlElement[];
  fullText: string;
}

/**
 * Parse XML content into a structured document.
 */
export function parseXml(content: string): XmlDocument {
  // Extract XML declaration
  const declMatch = content.match(/<\?xml\s+([^?]*)\?>/);
  const declaration = declMatch ? parseAttributes(declMatch[1]) : undefined;

  // Strip comments and processing instructions
  const cleaned = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '');

  // Parse element tree
  const elements: XmlElement[] = [];
  const root = parseElementTree(cleaned, elements);
  const namespaces = extractNamespaces(elements);

  return {
    rootTag: root?.tag ?? 'unknown',
    declaration,
    namespaces,
    elements,
    fullText: content,
  };
}

/**
 * Parse the element tree from cleaned XML, populating the flat elements array.
 */
function parseElementTree(xml: string, flatList: XmlElement[]): XmlElement | null {
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;

  // Match opening tags, closing tags, and self-closing tags
  const tagRegex = /<\/?([a-zA-Z_][\w:.-]*)((?:\s+[a-zA-Z_][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = tagRegex.exec(xml)) !== null) {
    const [fullMatch, tagName, attrStr, selfClose] = match;
    const isClosing = fullMatch.startsWith('</');
    const line = xml.slice(0, match.index).split('\n').length;

    // Capture text content between tags
    if (stack.length > 0 && match.index > lastIndex) {
      const textBetween = xml.slice(lastIndex, match.index).trim();
      // Strip CDATA wrappers
      const text = textBetween.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      if (text) {
        stack[stack.length - 1].textContent += (stack[stack.length - 1].textContent ? ' ' : '') + text;
      }
    }
    lastIndex = match.index + fullMatch.length;

    if (isClosing) {
      // Pop from stack
      if (stack.length > 0 && stack[stack.length - 1].tag === tagName) {
        stack.pop();
      }
    } else {
      // Opening or self-closing tag
      const parent = stack.length > 0 ? stack[stack.length - 1] : null;
      const parentPath = parent?.path ?? '';

      const element: XmlElement = {
        tag: tagName,
        attributes: parseAttributes(attrStr),
        textContent: '',
        children: [],
        path: parentPath ? `${parentPath}/${tagName}` : `/${tagName}`,
        line,
      };

      if (parent) {
        parent.children.push(element);
      }
      flatList.push(element);

      if (!root) root = element;

      if (!selfClose) {
        stack.push(element);
      }
    }
  }

  return root;
}

/**
 * Parse attribute string into key-value pairs.
 */
function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrStr)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? '';
  }

  return attrs;
}

/**
 * Extract namespace declarations from elements.
 */
function extractNamespaces(elements: XmlElement[]): Record<string, string> {
  const namespaces: Record<string, string> = {};

  for (const elem of elements) {
    for (const [key, value] of Object.entries(elem.attributes)) {
      if (key === 'xmlns') {
        namespaces[''] = value;
      } else if (key.startsWith('xmlns:')) {
        namespaces[key.slice(6)] = value;
      }
    }
  }

  return namespaces;
}

/**
 * Detect the XML document subtype based on filename and root element.
 */
export function detectXmlType(
  filePath: string,
  rootTag: string,
  namespaces: Record<string, string>
): string | undefined {
  const basename = filePath.toLowerCase().split('/').pop() ?? '';

  if (basename === 'pom.xml' || (rootTag === 'project' && (namespaces[''] ?? '').includes('maven'))) return 'maven-pom';
  if (basename.endsWith('.csproj') || (rootTag === 'Project' && (namespaces[''] ?? '').includes('microsoft'))) return 'csproj';
  if (basename === 'web.xml') return 'web-xml';
  if (basename.endsWith('.xsd') || rootTag === 'schema') return 'xsd';
  if (basename.endsWith('.wsdl') || rootTag === 'definitions') return 'wsdl';
  if (basename.endsWith('.svg') || rootTag === 'svg') return 'svg';

  return undefined;
}
