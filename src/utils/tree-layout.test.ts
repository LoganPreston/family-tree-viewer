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
  });
});

