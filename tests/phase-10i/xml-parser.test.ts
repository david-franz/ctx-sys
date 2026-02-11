/**
 * Tests for XML parser.
 */

import { parseXml, detectXmlType } from '../../src/documents/xml-parser';

describe('XML Parser', () => {
  it('should parse basic XML', () => {
    const xml = parseXml('<root><child>text</child></root>');
    expect(xml.rootTag).toBe('root');
    expect(xml.elements.length).toBeGreaterThanOrEqual(2);
    expect(xml.elements[0].tag).toBe('root');
  });

  it('should extract attributes', () => {
    const xml = parseXml('<root id="1" name="test"><child/></root>');
    expect(xml.elements[0].attributes).toEqual({ id: '1', name: 'test' });
  });

  it('should extract XML declaration', () => {
    const xml = parseXml('<?xml version="1.0" encoding="UTF-8"?><root/>');
    expect(xml.declaration).toEqual({ version: '1.0', encoding: 'UTF-8' });
  });

  it('should extract namespaces', () => {
    const xml = parseXml('<project xmlns="http://maven.apache.org/POM/4.0.0"><name>test</name></project>');
    expect(xml.namespaces['']).toBe('http://maven.apache.org/POM/4.0.0');
  });

  it('should extract prefixed namespaces', () => {
    const xml = parseXml('<root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>');
    expect(xml.namespaces['xsi']).toBe('http://www.w3.org/2001/XMLSchema-instance');
  });

  it('should handle nested elements', () => {
    const xml = parseXml(`
      <root>
        <parent>
          <child>nested</child>
        </parent>
      </root>
    `);
    const child = xml.elements.find(e => e.tag === 'child');
    expect(child).toBeDefined();
    expect(child!.path).toBe('/root/parent/child');
    expect(child!.textContent).toBe('nested');
  });

  it('should handle self-closing tags', () => {
    const xml = parseXml('<root><empty/><other>text</other></root>');
    const empty = xml.elements.find(e => e.tag === 'empty');
    expect(empty).toBeDefined();
    expect(empty!.textContent).toBe('');
  });

  it('should strip comments', () => {
    const xml = parseXml('<root><!-- comment --><child>text</child></root>');
    const child = xml.elements.find(e => e.tag === 'child');
    expect(child).toBeDefined();
    expect(child!.textContent).toBe('text');
  });

  it('should handle CDATA sections', () => {
    const xml = parseXml('<root><code><![CDATA[x < y && a > b]]></code></root>');
    const code = xml.elements.find(e => e.tag === 'code');
    expect(code).toBeDefined();
    expect(code!.textContent).toContain('x < y');
  });

  it('should populate children array', () => {
    const xml = parseXml('<root><a/><b/><c/></root>');
    const root = xml.elements[0];
    expect(root.children).toHaveLength(3);
    expect(root.children.map(c => c.tag)).toEqual(['a', 'b', 'c']);
  });

  it('should handle empty XML gracefully', () => {
    const xml = parseXml('');
    expect(xml.rootTag).toBe('unknown');
    expect(xml.elements).toEqual([]);
  });
});

describe('detectXmlType', () => {
  it('should detect Maven POM', () => {
    expect(detectXmlType('pom.xml', 'project', { '': 'http://maven.apache.org/POM/4.0.0' })).toBe('maven-pom');
  });

  it('should detect .csproj', () => {
    expect(detectXmlType('MyApp.csproj', 'Project', { '': 'http://schemas.microsoft.com/foo' })).toBe('csproj');
  });

  it('should detect web.xml', () => {
    expect(detectXmlType('web.xml', 'web-app', {})).toBe('web-xml');
  });

  it('should detect XSD', () => {
    expect(detectXmlType('types.xsd', 'schema', {})).toBe('xsd');
  });

  it('should detect SVG', () => {
    expect(detectXmlType('icon.svg', 'svg', {})).toBe('svg');
  });

  it('should return undefined for unknown XML', () => {
    expect(detectXmlType('data.xml', 'data', {})).toBeUndefined();
  });
});
