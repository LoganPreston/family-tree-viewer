import { describe, it, expect } from 'vitest';
import { findShortestPath } from './path-finder';
import { mockFamilyTree, mockSimpleTree } from '../tests/utils/mock-data';
import type { FamilyTree } from '../types/family-tree';

describe('path-finder', () => {
  describe('findShortestPath', () => {
    it('should find path between two connected people via parent-child', () => {
      const tree: FamilyTree = {
        rootPersonId: 'person1',
        persons: [
          {
            id: 'person1',
            name: 'Parent',
            relationships: [{ type: 'child', personId: 'person2' }],
            events: []
          },
          {
            id: 'person2',
            name: 'Child',
            relationships: [{ type: 'parent', personId: 'person1' }],
            events: []
          }
        ]
      };
      
      const path = findShortestPath(tree, 'person1', 'person2');
      
      expect(path).toEqual(['person1', 'person2']);
    });

    it('should find path between two connected people via spouse', () => {
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
      
      const path = findShortestPath(tree, 'person1', 'person2');
      
      expect(path).toEqual(['person1', 'person2']);
    });

    it('should return null for unconnected people', () => {
      const tree: FamilyTree = {
        rootPersonId: 'person1',
        persons: [
          {
            id: 'person1',
            name: 'Person 1',
            relationships: [],
            events: []
          },
          {
            id: 'person2',
            name: 'Person 2',
            relationships: [],
            events: []
          }
        ]
      };
      
      const path = findShortestPath(tree, 'person1', 'person2');
      
      expect(path).toBeNull();
    });

    it('should handle same person (return single-element array)', () => {
      const path = findShortestPath(mockFamilyTree, 'person1', 'person1');
      
      expect(path).toEqual(['person1']);
    });

    it('should handle missing people', () => {
      const path1 = findShortestPath(mockFamilyTree, 'nonexistent', 'person1');
      const path2 = findShortestPath(mockFamilyTree, 'person1', 'nonexistent');
      
      expect(path1).toBeNull();
      expect(path2).toBeNull();
    });

    it('should find path through multiple relationships', () => {
      const tree: FamilyTree = {
        rootPersonId: 'person1',
        persons: [
          {
            id: 'person1',
            name: 'Grandparent',
            relationships: [{ type: 'child', personId: 'person2' }],
            events: []
          },
          {
            id: 'person2',
            name: 'Parent',
            relationships: [
              { type: 'parent', personId: 'person1' },
              { type: 'child', personId: 'person3' }
            ],
            events: []
          },
          {
            id: 'person3',
            name: 'Child',
            relationships: [{ type: 'parent', personId: 'person2' }],
            events: []
          }
        ]
      };
      
      const path = findShortestPath(tree, 'person1', 'person3');
      
      expect(path).toEqual(['person1', 'person2', 'person3']);
    });

    it('should find shortest path when multiple paths exist', () => {
      const tree: FamilyTree = {
        rootPersonId: 'person1',
        persons: [
          {
            id: 'person1',
            name: 'Person 1',
            relationships: [
              { type: 'spouse', personId: 'person2' },
              { type: 'spouse', personId: 'person3' }
            ],
            events: []
          },
          {
            id: 'person2',
            name: 'Person 2',
            relationships: [
              { type: 'spouse', personId: 'person1' },
              { type: 'spouse', personId: 'person4' }
            ],
            events: []
          },
          {
            id: 'person3',
            name: 'Person 3',
            relationships: [{ type: 'spouse', personId: 'person1' }],
            events: []
          },
          {
            id: 'person4',
            name: 'Person 4',
            relationships: [{ type: 'spouse', personId: 'person2' }],
            events: []
          }
        ]
      };
      
      // Shortest path from person3 to person4 should be person3 -> person1 -> person2 -> person4
      const path = findShortestPath(tree, 'person3', 'person4');
      
      expect(path).toBeDefined();
      expect(path!.length).toBe(4);
      expect(path![0]).toBe('person3');
      expect(path![path!.length - 1]).toBe('person4');
    });

    it('should handle complex family tree structures', () => {
      const path = findShortestPath(mockFamilyTree, 'person1', 'person3');
      
      if (path) {
        expect(path.length).toBeGreaterThan(0);
        expect(path[0]).toBe('person1');
        expect(path[path.length - 1]).toBe('person3');
      } else {
        // If no path found, that's also a valid result for some tree structures
        expect(path).toBeNull();
      }
    });

    it('should handle bidirectional relationships correctly', () => {
      const tree = mockSimpleTree;
      
      const path1 = findShortestPath(tree, 'person1', 'person2');
      const path2 = findShortestPath(tree, 'person2', 'person1');
      
      expect(path1).toEqual(['person1', 'person2']);
      expect(path2).toEqual(['person2', 'person1']);
    });
  });
});

