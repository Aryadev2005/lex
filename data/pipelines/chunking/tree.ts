import { randomUUID } from 'crypto';
import type { SectionBoundary } from './detector.js';

export interface SectionNode {
  id: string;
  title: string;
  type: string;
  level: number;
  startLine: number;
  endLine: number;
  text: string;
  children: SectionNode[];
  breadcrumb: string[]; // e.g. ["Chapter I", "Section 3", "Sub-section (a)"]
}

export function buildSectionTree(sections: SectionBoundary[]): SectionNode[] {
  const roots: SectionNode[] = [];
  // Stack tracks the current path from root to the most recently added node.
  // Each level occupies exactly one slot: when we see a level-N node we pop
  // everything at level >= N, making the top of the stack the new node's parent.
  const stack: SectionNode[] = [];

  for (const section of sections) {
    const node: SectionNode = {
      id: randomUUID(),
      title: section.title,
      type: section.type,
      level: section.level,
      startLine: section.startLine,
      endLine: section.endLine,
      text: section.text,
      children: [],
      breadcrumb: [],
    };

    while (stack.length > 0 && stack[stack.length - 1]!.level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
      node.breadcrumb = [node.title];
    } else {
      const parent = stack[stack.length - 1]!;
      parent.children.push(node);
      node.breadcrumb = [...parent.breadcrumb, node.title];
    }

    stack.push(node);
  }

  return roots;
}

// Depth-first inorder: parent before children, preserving document order.
export function flattenTree(tree: SectionNode[]): SectionNode[] {
  const result: SectionNode[] = [];
  for (const node of tree) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}
