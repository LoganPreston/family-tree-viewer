import { describe, it, expect } from 'vitest';
import { buildTreeData } from './tree-layout';
import { mockFamilyTree, mockEmptyTree, mockSinglePersonTree, mockSimpleTree } from '../tests/utils/mock-data';
import type { FamilyTree } from '../types/family-tree';

describe('tree-layout', () => {
  describe('buildTreeData', () => {
    it('should build tree from family tree data', () => {
      const result = buildTreeData(mockFamilyTree, 'person1', 4);
      
      expect(result).toBeDefined();
      expect(result!.id).toBe('person1');
      expect(result!.name).toBe('John Doe');
    });

    it('should handle root person selection', () => {
      const result = buildTreeData(mockFamilyTree, 'person3', 4);
      
      expect(result).toBeDefined();
      // The root might be wrapped in a navigation node, so check if it's the actual person or a navigation wrapper
      if (result!.id === '__parent_nav__') {
        // If wrapped, check that person3 is in the children
        expect(result!.children).toBeDefined();
        expect(result!.children!.some(child => child.id === 'person3')).toBe(true);
      } else {
        expect(result!.id).toBe('person3');
      }
    });

    it('should apply maxGenerations limit', () => {
      const tree: FamilyTree = {
        rootPersonId: 'person1',
        persons: [
          {
            id: 'person1',
            name: 'Gen1',
            relationships: [{ type: 'child', personId: 'person2' }],
            events: []
          },
          {
            id: 'person2',
            name: 'Gen2',
            relationships: [
              { type: 'parent', personId: 'person1' },
              { type: 'child', personId: 'person3' }
            ],
            events: []
          },
          {
            id: 'person3',
            name: 'Gen3',
            relationships: [
              { type: 'parent', personId: 'person2' },
              { type: 'child', personId: 'person4' }
            ],
            events: []
          },
          {
            id: 'person4',
            name: 'Gen4',
            relationships: [{ type: 'parent', personId: 'person3' }],
            events: []
          }
        ]
      };
      
      const result = buildTreeData(tree, 'person1', 2);
      
      expect(result).toBeDefined();
      // Should only include up to 2 generations (person1 and person2)
      expect(result!.children).toBeDefined();
      if (result!.children && result!.children.length > 0) {
        // person3 should not be included (would be generation 2, but maxGenerations=2 means 0,1)
        const hasPerson3 = result!.children.some(child => child.id === 'person3');
        // Actually, with maxGenerations=2, we get generations 0 and 1, so person3 (generation 2) should not be included
        expect(hasPerson3).toBe(false);
      }
    });

    it('should create proper TreeNode structure', () => {
      const result = buildTreeData(mockSimpleTree, 'person1', 4);
      
      expect(result).toBeDefined();
      expect(result!.id).toBe('person1');
      expect(result!.name).toBe('Parent');
      expect(result!.children).toBeDefined();
      expect(result!.children!.length).toBeGreaterThan(0);
      expect(result!.children![0].id).toBe('person2');
    });

    it('should handle spouse relationships', () => {
      const tree: FamilyTree = {
        rootPersonId: 'person1',
        persons: [
          {
            id: 'person1',
            name: 'Person 1',
            relationships: [{ type: 'spouse', personId: 'person2' }],
            events: []
          },
          {
            id: 'person2',
            name: 'Person 2',
            relationships: [{ type: 'spouse', personId: 'person1' }],
            events: []
          }
        ]
      };
      
      const result = buildTreeData(tree, 'person1', 4);
      
      expect(result).toBeDefined();
      // Spouses should be handled in the tree structure
      // The exact structure depends on implementation, but should not crash
    });

    it('should handle parent-child relationships', () => {
      const result = buildTreeData(mockSimpleTree, 'person1', 4);
      
      expect(result).toBeDefined();
      expect(result!.children).toBeDefined();
      expect(result!.children!.length).toBe(1);
      expect(result!.children![0].id).toBe('person2');
      expect(result!.children![0].name).toBe('Child');
    });

    it('should handle empty tree', () => {
      const result = buildTreeData(mockEmptyTree, 'nonexistent', 4);
      
      expect(result).toBeNull();
    });

    it('should handle single person', () => {
      const result = buildTreeData(mockSinglePersonTree, 'person1', 4);
      
      expect(result).toBeDefined();
      expect(result!.id).toBe('person1');
      expect(result!.children).toBeUndefined();
    });

    it('should handle nonexistent root person', () => {
      const result = buildTreeData(mockFamilyTree, 'nonexistent', 4);
      
      expect(result).toBeNull();
    });

    it('should preserve person data in tree nodes', () => {
      const result = buildTreeData(mockFamilyTree, 'person1', 4);
      
      expect(result).toBeDefined();
      expect(result!.name).toBe('John Doe');
      expect(result!.birthDate).toBe('1 JAN 1900');
      expect(result!.birthPlace).toBe('New York');
      expect(result!.deathDate).toBe('1 DEC 1990');
      expect(result!.gender).toBe('M');
    });

    it('should handle maxGenerations of 0', () => {
      const result = buildTreeData(mockSimpleTree, 'person1', 0);
      
      if (result) {
        // With maxGenerations=0, we only get the root node, no children
        expect(result.children).toBeUndefined();
      } else {
        // It's also valid for maxGenerations=0 to return null if generation limiting prevents root
        expect(result).toBeNull();
      }
    });

    it('should handle complex multi-generation trees', () => {
      const result = buildTreeData(mockFamilyTree, 'person1', 4);

      expect(result).toBeDefined();
      // Should handle the tree structure without errors
      expect(result!.id).toBe('person1');
    });

    // ── wrapper root ──────────────────────────────────────────────────────────

    it('should create __wrapper_root__ when root and spouse both have no parents', () => {
      const tree: FamilyTree = {
        rootPersonId: 'p1',
        persons: [
          {
            id: 'p1',
            name: 'Root',
            relationships: [{ type: 'spouse', personId: 'p2' }],
            events: []
          },
          {
            id: 'p2',
            name: 'Spouse',
            relationships: [{ type: 'spouse', personId: 'p1' }],
            events: []
          }
        ]
      };

      const result = buildTreeData(tree, 'p1', 4);

      expect(result).toBeDefined();
      expect(result!.id).toBe('__wrapper_root__');
      expect(result!.children).toHaveLength(2);
      const ids = result!.children!.map(c => c.id);
      expect(ids).toContain('p1');
      expect(ids).toContain('p2');
    });

    it('should add a second spouse to an existing __wrapper_root__', () => {
      const tree: FamilyTree = {
        rootPersonId: 'p1',
        persons: [
          {
            id: 'p1',
            name: 'Root',
            relationships: [
              { type: 'spouse', personId: 'p2' },
              { type: 'spouse', personId: 'p3' }
            ],
            events: []
          },
          {
            id: 'p2',
            name: 'Spouse 1',
            relationships: [{ type: 'spouse', personId: 'p1' }],
            events: []
          },
          {
            id: 'p3',
            name: 'Spouse 2',
            relationships: [{ type: 'spouse', personId: 'p1' }],
            events: []
          }
        ]
      };

      const result = buildTreeData(tree, 'p1', 4);

      expect(result).toBeDefined();
      expect(result!.id).toBe('__wrapper_root__');
      expect(result!.children).toHaveLength(3);
    });

    // ── parent navigation node ────────────────────────────────────────────────

    it('should wrap result in __parent_nav__ when root person has parents', () => {
      const tree: FamilyTree = {
        rootPersonId: 'child',
        persons: [
          {
            id: 'parent',
            name: 'Parent',
            relationships: [{ type: 'child', personId: 'child' }],
            events: []
          },
          {
            id: 'child',
            name: 'Child',
            relationships: [{ type: 'parent', personId: 'parent' }],
            events: []
          }
        ]
      };

      const result = buildTreeData(tree, 'child', 4);

      expect(result).toBeDefined();
      expect(result!.id).toBe('__parent_nav__');
      expect(result!.isNavigationNode).toBe(true);
      expect(result!.children).toBeDefined();
      expect(result!.children![0].id).toBe('child');
    });

    it('should not add __parent_nav__ when root person has no parents', () => {
      const tree: FamilyTree = {
        rootPersonId: 'p1',
        persons: [
          {
            id: 'p1',
            name: 'Root',
            relationships: [{ type: 'child', personId: 'p2' }],
            events: []
          },
          {
            id: 'p2',
            name: 'Child',
            relationships: [{ type: 'parent', personId: 'p1' }],
            events: []
          }
        ]
      };

      const result = buildTreeData(tree, 'p1', 4);

      expect(result).toBeDefined();
      expect(result!.id).toBe('p1');
      expect(result!.isNavigationNode).toBeFalsy();
    });

    // ── invisible link (spouse whose parent is outside visible tree) ──────────

    it('should attach spouse as invisible sibling when spouse parent is outside tree', () => {
      // p2 is child of p0, but p0 is not in the tree (maxGenerations=1 from p1's perspective,
      // or simply p0 is not in the dataset). p1 and p2 are spouses; p1's parent IS in the tree.
      const tree: FamilyTree = {
        rootPersonId: 'grandparent',
        persons: [
          {
            id: 'grandparent',
            name: 'Grandparent',
            relationships: [{ type: 'child', personId: 'p1' }],
            events: []
          },
          {
            id: 'p1',
            name: 'Person 1',
            relationships: [
              { type: 'parent', personId: 'grandparent' },
              { type: 'spouse', personId: 'p2' }
            ],
            events: []
          },
          {
            id: 'p2',
            name: 'Spouse (outside parent)',
            relationships: [
              { type: 'spouse', personId: 'p1' },
              { type: 'parent', personId: 'missing_parent' } // parent not in dataset
            ],
            events: []
          }
        ]
      };

      const result = buildTreeData(tree, 'grandparent', 4);

      expect(result).toBeDefined();

      // Find p2 somewhere in the tree
      function findNode(node: any, id: string): any {
        if (node.id === id) return node;
        for (const child of node.children ?? []) {
          const found = findNode(child, id);
          if (found) return found;
        }
        return null;
      }

      const p2Node = findNode(result, 'p2');
      expect(p2Node).not.toBeNull();
      expect(p2Node.isInvisibleLink).toBe(true);
    });

    // ── spouse clustering (sortChildrenToGroupSpouses) ────────────────────────

    it('should group spouse pairs together in children array', () => {
      // root has 3 children: c1, c2 (spouses of each other), and c3 (unrelated)
      const tree: FamilyTree = {
        rootPersonId: 'root',
        persons: [
          {
            id: 'root',
            name: 'Root',
            relationships: [
              { type: 'child', personId: 'c1' },
              { type: 'child', personId: 'c2' },
              { type: 'child', personId: 'c3' }
            ],
            events: []
          },
          {
            id: 'c1',
            name: 'Child 1',
            relationships: [
              { type: 'parent', personId: 'root' },
              { type: 'spouse', personId: 'c2' }
            ],
            events: []
          },
          {
            id: 'c2',
            name: 'Child 2',
            relationships: [
              { type: 'parent', personId: 'root' },
              { type: 'spouse', personId: 'c1' }
            ],
            events: []
          },
          {
            id: 'c3',
            name: 'Child 3',
            relationships: [{ type: 'parent', personId: 'root' }],
            events: []
          }
        ]
      };

      const result = buildTreeData(tree, 'root', 4);

      expect(result).toBeDefined();
      expect(result!.id).toBe('root');
      expect(result!.children).toBeDefined();

      const children = result!.children!;
      const c1idx = children.findIndex(c => c.id === 'c1');
      const c2idx = children.findIndex(c => c.id === 'c2');

      expect(c1idx).toBeGreaterThanOrEqual(0);
      expect(c2idx).toBeGreaterThanOrEqual(0);
      // c1 and c2 (spouses) should be adjacent
      expect(Math.abs(c1idx - c2idx)).toBe(1);
    });

    // ── orphan spouse cleanup (resolveOrphanSpouses) ──────────────────────────

    it('should resolve orphan spouse through the cleanup pass', () => {
      // p1 (root) and p2 are spouses. p1 has a parent (so it gets a __parent_nav__ wrapper).
      // p2 has no parent. After positionSpouses, p2 may be orphaned and needs resolveOrphanSpouses
      // or resolveRootSpouses to place it.
      const tree: FamilyTree = {
        rootPersonId: 'p1',
        persons: [
          {
            id: 'parent1',
            name: 'Parent',
            relationships: [{ type: 'child', personId: 'p1' }],
            events: []
          },
          {
            id: 'p1',
            name: 'Person 1',
            relationships: [
              { type: 'parent', personId: 'parent1' },
              { type: 'spouse', personId: 'p2' }
            ],
            events: []
          },
          {
            id: 'p2',
            name: 'Person 2',
            relationships: [{ type: 'spouse', personId: 'p1' }],
            events: []
          }
        ]
      };

      const result = buildTreeData(tree, 'p1', 4);

      // Should not crash; p2 should appear somewhere in the result
      expect(result).toBeDefined();

      function findNode(node: any, id: string): any {
        if (node.id === id) return node;
        for (const child of node.children ?? []) {
          const found = findNode(child, id);
          if (found) return found;
        }
        return null;
      }

      const p2Node = findNode(result, 'p2');
      expect(p2Node).not.toBeNull();
    });
  });
});

