import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFamilyTreeStore } from './family-tree-store';
import { mockFamilyTree, mockSinglePersonTree } from '../tests/utils/mock-data';

describe('family-tree-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('removeRelationship', () => {
    it('removes a parent relationship and its reciprocal child', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree({
        rootPersonId: 'p1',
        persons: [
          { id: 'p1', name: 'Parent', gender: 'M', relationships: [{ type: 'child', personId: 'p2' }], events: [] },
          { id: 'p2', name: 'Child', gender: 'M', relationships: [{ type: 'parent', personId: 'p1' }], events: [] }
        ]
      });

      // p1 has one relationship at index 0: child -> p2
      store.removeRelationship('p1', 0);

      const p1 = store.familyTree.persons.find(p => p.id === 'p1')!;
      const p2 = store.familyTree.persons.find(p => p.id === 'p2')!;
      expect(p1.relationships).toHaveLength(0);
      expect(p2.relationships).toHaveLength(0);
    });

    it('removes a child relationship and its reciprocal parent', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree({
        rootPersonId: 'p2',
        persons: [
          { id: 'p1', name: 'Parent', gender: 'M', relationships: [{ type: 'child', personId: 'p2' }], events: [] },
          { id: 'p2', name: 'Child', gender: 'M', relationships: [{ type: 'parent', personId: 'p1' }], events: [] }
        ]
      });

      // p2 has one relationship at index 0: parent -> p1
      store.removeRelationship('p2', 0);

      const p1 = store.familyTree.persons.find(p => p.id === 'p1')!;
      const p2 = store.familyTree.persons.find(p => p.id === 'p2')!;
      expect(p2.relationships).toHaveLength(0);
      expect(p1.relationships).toHaveLength(0);
    });

    it('removes a spouse relationship and its reciprocal spouse', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree({
        rootPersonId: 'p1',
        persons: [
          { id: 'p1', name: 'Alice', gender: 'F', relationships: [{ type: 'spouse', personId: 'p2' }], events: [] },
          { id: 'p2', name: 'Bob', gender: 'M', relationships: [{ type: 'spouse', personId: 'p1' }], events: [] }
        ]
      });

      store.removeRelationship('p1', 0);

      const p1 = store.familyTree.persons.find(p => p.id === 'p1')!;
      const p2 = store.familyTree.persons.find(p => p.id === 'p2')!;
      expect(p1.relationships).toHaveLength(0);
      expect(p2.relationships).toHaveLength(0);
    });

    it('is a no-op when personId does not exist', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      const beforeCount = store.familyTree.persons.reduce((n, p) => n + p.relationships.length, 0);

      store.removeRelationship('nonexistent', 0);

      const afterCount = store.familyTree.persons.reduce((n, p) => n + p.relationships.length, 0);
      expect(afterCount).toBe(beforeCount);
    });

    it('is a no-op when relationshipIndex is out of bounds', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      const beforeCount = store.familyTree.persons.reduce((n, p) => n + p.relationships.length, 0);

      store.removeRelationship('person1', 999);

      const afterCount = store.familyTree.persons.reduce((n, p) => n + p.relationships.length, 0);
      expect(afterCount).toBe(beforeCount);
    });

    it('leaves unrelated relationships untouched', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree({
        rootPersonId: 'p1',
        persons: [
          {
            id: 'p1', name: 'Person 1', gender: 'M',
            relationships: [
              { type: 'spouse', personId: 'p2' },
              { type: 'child', personId: 'p3' }
            ],
            events: []
          },
          { id: 'p2', name: 'Person 2', gender: 'F', relationships: [{ type: 'spouse', personId: 'p1' }], events: [] },
          { id: 'p3', name: 'Person 3', gender: 'M', relationships: [{ type: 'parent', personId: 'p1' }], events: [] }
        ]
      });

      // Remove first relationship (spouse -> p2); child -> p3 should remain
      store.removeRelationship('p1', 0);

      const p1 = store.familyTree.persons.find(p => p.id === 'p1')!;
      expect(p1.relationships).toHaveLength(1);
      expect(p1.relationships[0]).toEqual({ type: 'child', personId: 'p3' });
    });
  });

  describe('goBack', () => {
    it('is a no-op when history is empty', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      const rootBefore = store.currentRootPersonId;

      expect(store.canGoBack).toBe(false);
      store.goBack();

      expect(store.currentRootPersonId).toBe(rootBefore);
    });

    it('navigates back one step, restoring the previous root', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree); // root = person1
      store.setCurrentRoot('person2');

      expect(store.currentRootPersonId).toBe('person2');
      store.goBack();

      expect(store.currentRootPersonId).toBe('person1');
    });

    it('navigates back multiple steps in LIFO order', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree); // root = person1
      store.setCurrentRoot('person2');
      store.setCurrentRoot('person3');

      store.goBack();
      expect(store.currentRootPersonId).toBe('person2');

      store.goBack();
      expect(store.currentRootPersonId).toBe('person1');
    });

    it('does not grow history when going back', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setCurrentRoot('person2'); // history: [person1]

      store.goBack(); // should pop, not push
      expect(store.canGoBack).toBe(false);
    });

    it('canGoBack becomes false once history is exhausted', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setCurrentRoot('person2');
      store.setCurrentRoot('person3');

      store.goBack();
      expect(store.canGoBack).toBe(true);

      store.goBack();
      expect(store.canGoBack).toBe(false);
    });
  });

  // ── setZoom / setPan ────────────────────────────────────────────────────────

  describe('setZoom', () => {
    it('sets zoom to the given value', () => {
      const store = useFamilyTreeStore();
      store.setZoom(2);
      expect(store.zoom).toBe(2);
    });

    it('clamps zoom to minimum 0.1', () => {
      const store = useFamilyTreeStore();
      store.setZoom(0);
      expect(store.zoom).toBe(0.1);
    });

    it('clamps zoom to maximum 5', () => {
      const store = useFamilyTreeStore();
      store.setZoom(10);
      expect(store.zoom).toBe(5);
    });
  });

  describe('setPan', () => {
    it('sets panX and panY', () => {
      const store = useFamilyTreeStore();
      store.setPan(150, -75);
      expect(store.panX).toBe(150);
      expect(store.panY).toBe(-75);
    });

    it('overwrites previous pan values', () => {
      const store = useFamilyTreeStore();
      store.setPan(100, 200);
      store.setPan(0, 0);
      expect(store.panX).toBe(0);
      expect(store.panY).toBe(0);
    });
  });

  // ── setMaxGenerations ───────────────────────────────────────────────────────

  describe('setMaxGenerations', () => {
    it('sets within valid range', () => {
      const store = useFamilyTreeStore();
      store.setMaxGenerations(6);
      expect(store.maxGenerations).toBe(6);
    });

    it('clamps to minimum 1', () => {
      const store = useFamilyTreeStore();
      store.setMaxGenerations(0);
      expect(store.maxGenerations).toBe(1);
    });

    it('clamps to maximum 10', () => {
      const store = useFamilyTreeStore();
      store.setMaxGenerations(99);
      expect(store.maxGenerations).toBe(10);
    });
  });

  // ── setSelectedPerson / selectedPerson computed ─────────────────────────────

  describe('setSelectedPerson', () => {
    it('sets the selected person id', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setSelectedPerson('person2');
      expect(store.selectedPersonId).toBe('person2');
    });

    it('clears selection when passed null', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setSelectedPerson('person1');
      store.setSelectedPerson(null);
      expect(store.selectedPersonId).toBeNull();
    });

    it('does not affect navigation history', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setSelectedPerson('person2');
      expect(store.canGoBack).toBe(false);
    });
  });

  describe('selectedPerson computed', () => {
    it('returns null when selectedPersonId is null', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setSelectedPerson(null);
      expect(store.selectedPerson).toBeNull();
    });

    it('returns the matching Person object when selected', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setSelectedPerson('person1');
      expect(store.selectedPerson).not.toBeNull();
      expect(store.selectedPerson!.name).toBe('John Doe');
    });

    it('returns null for an id not in the tree', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setSelectedPerson('nonexistent');
      expect(store.selectedPerson).toBeNull();
    });
  });

  // ── addRelationship duplicate guard ─────────────────────────────────────────

  describe('addRelationship', () => {
    it('does not add a duplicate relationship', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      const person2 = store.familyTree.persons.find(p => p.id === 'person2')!;
      const countBefore = person2.relationships.filter(
        r => r.type === 'spouse' && r.personId === 'person1'
      ).length;

      // person2 already has spouse -> person1 via mock data
      store.addRelationship('person2', { type: 'spouse', personId: 'person1' });

      const countAfter = person2.relationships.filter(
        r => r.type === 'spouse' && r.personId === 'person1'
      ).length;
      expect(countAfter).toBe(countBefore);
    });

    it('is a no-op when personId does not exist in the tree', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      const totalBefore = store.familyTree.persons.reduce((n, p) => n + p.relationships.length, 0);

      store.addRelationship('nonexistent', { type: 'spouse', personId: 'person1' });

      const totalAfter = store.familyTree.persons.reduce((n, p) => n + p.relationships.length, 0);
      expect(totalAfter).toBe(totalBefore);
    });
  });

  // ── removePerson edge cases ─────────────────────────────────────────────────

  describe('removePerson', () => {
    it('updates rootPersonId when root is deleted', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      store.removePerson('person1');

      expect(store.familyTree.rootPersonId).not.toBe('person1');
      expect(store.familyTree.persons.find(p => p.id === 'person1')).toBeUndefined();
    });

    it('clears selectedPersonId when the selected person is deleted', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setSelectedPerson('person2');

      store.removePerson('person2');

      expect(store.selectedPersonId).not.toBe('person2');
    });

    it('removes all relationships pointing to the deleted person', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      store.removePerson('person1');

      for (const person of store.familyTree.persons) {
        expect(person.relationships.some(r => r.personId === 'person1')).toBe(false);
      }
    });

    it('sets rootPersonId to undefined when the last person is deleted', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockSinglePersonTree);

      store.removePerson('person1');

      expect(store.familyTree.persons).toHaveLength(0);
      expect(store.familyTree.rootPersonId).toBeUndefined();
    });

    it('is a no-op for a nonexistent person', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      const before = store.familyTree.persons.length;

      store.removePerson('nonexistent');

      expect(store.familyTree.persons.length).toBe(before);
    });
  });

  // ── loadFamilyTree edge cases ───────────────────────────────────────────────

  describe('loadFamilyTree', () => {
    it('resets navigation history on load', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      store.setCurrentRoot('person2');
      expect(store.canGoBack).toBe(true);

      store.loadFamilyTree(mockFamilyTree);

      expect(store.canGoBack).toBe(false);
    });

    it('falls back to first person when tree has no rootPersonId', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree({
        rootPersonId: undefined,
        persons: [{ id: 'p1', name: 'Solo', relationships: [], events: [] }]
      });

      expect(store.currentRootPersonId).toBe('p1');
      expect(store.selectedPersonId).toBe('p1');
    });

    it('sets root and selection to undefined/null for an empty tree', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree({ rootPersonId: undefined, persons: [] });

      expect(store.currentRootPersonId).toBeUndefined();
      expect(store.selectedPersonId).toBeNull();
    });
  });

  // ── resetView ───────────────────────────────────────────────────────────────

  describe('resetView', () => {
    it('resets zoom to 1', () => {
      const store = useFamilyTreeStore();
      store.setZoom(3.5);
      expect(store.zoom).toBe(3.5);

      store.resetView();
      expect(store.zoom).toBe(1);
    });

    it('resets panX to 0', () => {
      const store = useFamilyTreeStore();
      store.setPan(250, 0);

      store.resetView();
      expect(store.panX).toBe(0);
    });

    it('resets panY to 0', () => {
      const store = useFamilyTreeStore();
      store.setPan(0, 400);

      store.resetView();
      expect(store.panY).toBe(0);
    });

    it('resets zoom, panX, and panY together', () => {
      const store = useFamilyTreeStore();
      store.setZoom(2);
      store.setPan(100, 200);

      store.resetView();

      expect(store.zoom).toBe(1);
      expect(store.panX).toBe(0);
      expect(store.panY).toBe(0);
    });
  });
});
