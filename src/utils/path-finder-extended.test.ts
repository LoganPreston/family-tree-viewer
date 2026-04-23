import { describe, it, expect } from 'vitest';
import { findAncestors, findDescendants, findBloodRelatives, isDescendant } from './path-finder';
import type { FamilyTree } from '../types/family-tree';

// Grandparent -> Parent -> Child -> Grandchild
// Parent also has an unrelated Spouse (married in, not blood)
const tree: FamilyTree = {
  rootPersonId: 'grandparent',
  persons: [
    {
      id: 'grandparent',
      name: 'Grandparent',
      relationships: [{ type: 'child', personId: 'parent' }],
      events: []
    },
    {
      id: 'parent',
      name: 'Parent',
      relationships: [
        { type: 'parent', personId: 'grandparent' },
        { type: 'spouse', personId: 'spouse' },
        { type: 'child', personId: 'child' }
      ],
      events: []
    },
    {
      id: 'spouse',
      name: 'Spouse (married in)',
      relationships: [{ type: 'spouse', personId: 'parent' }],
      events: []
    },
    {
      id: 'child',
      name: 'Child',
      relationships: [
        { type: 'parent', personId: 'parent' },
        { type: 'child', personId: 'grandchild' }
      ],
      events: []
    },
    {
      id: 'grandchild',
      name: 'Grandchild',
      relationships: [{ type: 'parent', personId: 'child' }],
      events: []
    },
    {
      id: 'unrelated',
      name: 'Unrelated',
      relationships: [],
      events: []
    }
  ]
};

describe('path-finder extended', () => {
  describe('findAncestors', () => {
    it('returns direct ancestors following parent links only', () => {
      const ancestors = findAncestors(tree, 'grandchild');
      expect(ancestors.has('child')).toBe(true);
      expect(ancestors.has('parent')).toBe(true);
      expect(ancestors.has('grandparent')).toBe(true);
    });

    it('does not include the seed person', () => {
      const ancestors = findAncestors(tree, 'child');
      expect(ancestors.has('child')).toBe(false);
    });

    it('does not include descendants', () => {
      const ancestors = findAncestors(tree, 'parent');
      expect(ancestors.has('child')).toBe(false);
      expect(ancestors.has('grandchild')).toBe(false);
    });

    it('does not cross spouse links', () => {
      const ancestors = findAncestors(tree, 'child');
      expect(ancestors.has('spouse')).toBe(false);
    });

    it('returns empty set for a person with no parents', () => {
      const ancestors = findAncestors(tree, 'grandparent');
      expect(ancestors.size).toBe(0);
    });

    it('returns empty set for a person not in the tree', () => {
      const ancestors = findAncestors(tree, 'nobody');
      expect(ancestors.size).toBe(0);
    });
  });

  describe('findDescendants', () => {
    it('returns all descendants following child links only', () => {
      const descendants = findDescendants(tree, 'grandparent');
      expect(descendants.has('parent')).toBe(true);
      expect(descendants.has('child')).toBe(true);
      expect(descendants.has('grandchild')).toBe(true);
    });

    it('does not include the seed person', () => {
      const descendants = findDescendants(tree, 'parent');
      expect(descendants.has('parent')).toBe(false);
    });

    it('does not include ancestors', () => {
      const descendants = findDescendants(tree, 'parent');
      expect(descendants.has('grandparent')).toBe(false);
    });

    it('does not cross spouse links', () => {
      const descendants = findDescendants(tree, 'grandparent');
      expect(descendants.has('spouse')).toBe(false);
    });

    it('returns empty set for a leaf node', () => {
      const descendants = findDescendants(tree, 'grandchild');
      expect(descendants.size).toBe(0);
    });

    it('returns empty set for a person not in the tree', () => {
      const descendants = findDescendants(tree, 'nobody');
      expect(descendants.size).toBe(0);
    });
  });

  describe('findBloodRelatives', () => {
    it('includes ancestors and descendants', () => {
      const relatives = findBloodRelatives(tree, 'parent');
      expect(relatives.has('grandparent')).toBe(true);
      expect(relatives.has('child')).toBe(true);
      expect(relatives.has('grandchild')).toBe(true);
    });

    it('does not include the seed person', () => {
      const relatives = findBloodRelatives(tree, 'parent');
      expect(relatives.has('parent')).toBe(false);
    });

    it('does not include married-in spouses', () => {
      const relatives = findBloodRelatives(tree, 'parent');
      expect(relatives.has('spouse')).toBe(false);
    });

    it('does not include unrelated people', () => {
      const relatives = findBloodRelatives(tree, 'parent');
      expect(relatives.has('unrelated')).toBe(false);
    });
  });

  describe('isDescendant', () => {
    it('returns true for a direct child', () => {
      expect(isDescendant(tree, 'parent', 'child')).toBe(true);
    });

    it('returns true for a grandchild', () => {
      expect(isDescendant(tree, 'grandparent', 'grandchild')).toBe(true);
    });

    it('returns true when ancestor equals descendant (same person)', () => {
      expect(isDescendant(tree, 'child', 'child')).toBe(true);
    });

    it('returns false for an ancestor', () => {
      expect(isDescendant(tree, 'child', 'parent')).toBe(false);
    });

    it('returns false for an unrelated person', () => {
      expect(isDescendant(tree, 'grandparent', 'unrelated')).toBe(false);
    });

    it('returns false for a spouse (not a blood descendant)', () => {
      expect(isDescendant(tree, 'grandparent', 'spouse')).toBe(false);
    });
  });
});
