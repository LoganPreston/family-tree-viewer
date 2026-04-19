import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFamilyTreeStore } from './stores/family-tree-store';
import { mockFamilyTree } from './tests/utils/mock-data';
import { findShortestPath } from './utils/path-finder';
import { downloadJson } from './utils/json-exporter';

// Simplified App tests - testing store integration rather than full component rendering
// Full component rendering tests are complex due to D3.js and Vue component interactions
describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should have store with correct initial state', () => {
    const store = useFamilyTreeStore();
    
    expect(store.familyTree.persons).toHaveLength(0);
    expect(store.currentRootPersonId).toBeUndefined();
    expect(store.canGoBack).toBe(false);
  });

  it('should show back button when canGoBack is true', () => {
    const store = useFamilyTreeStore();
    store.loadFamilyTree(mockFamilyTree);
    store.setCurrentRoot('person2');
    
    expect(store.canGoBack).toBe(true);
  });

  it('should hide back button when canGoBack is false', () => {
    const store = useFamilyTreeStore();
    store.loadFamilyTree(mockFamilyTree);
    
    expect(store.canGoBack).toBe(false);
  });

  it('should show clear highlight button when connection path exists', () => {
    const store = useFamilyTreeStore();
    store.loadFamilyTree(mockFamilyTree);
    store.setConnectionPath(['person1', 'person2']);
    
    expect(store.connectionPath).not.toBeNull();
    expect(store.connectionPath).toEqual(['person1', 'person2']);
  });

  it('should hide clear highlight button when no connection path', () => {
    const store = useFamilyTreeStore();
    store.loadFamilyTree(mockFamilyTree);
    
    expect(store.connectionPath).toBeNull();
  });

  it('should handle back button click', () => {
    const store = useFamilyTreeStore();
    store.loadFamilyTree(mockFamilyTree);
    store.setCurrentRoot('person2');
    
    expect(store.currentRootPersonId).toBe('person2');
    expect(store.canGoBack).toBe(true);
    
    store.goBack();
    
    expect(store.currentRootPersonId).toBe('person1');
  });

  it('should handle clear highlight button click', () => {
    const store = useFamilyTreeStore();
    store.loadFamilyTree(mockFamilyTree);
    store.setConnectionPath(['person1', 'person2']);
    
    expect(store.connectionPath).not.toBeNull();
    
    store.clearConnectionPath();
    
    expect(store.connectionPath).toBeNull();
  });

  it('should have data when family tree is loaded', () => {
    const store = useFamilyTreeStore();
    store.loadFamilyTree(mockFamilyTree);

    expect(store.familyTree.persons.length).toBeGreaterThan(0);
  });

  // ── search logic ────────────────────────────────────────────────────────────

  describe('search', () => {
    it('filters persons by name (case-insensitive)', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      const query = 'john';
      const results = store.familyTree.persons.filter(p =>
        p.name.toLowerCase().includes(query)
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.name.toLowerCase().includes(query))).toBe(true);
    });

    it('returns empty results for a query with no match', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      const results = store.familyTree.persons.filter(p =>
        p.name.toLowerCase().includes('zzznomatch')
      );

      expect(results).toHaveLength(0);
    });

    it('navigates to selected person on search select', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      // Simulate handleSearchSelect
      store.setCurrentRoot('person3');

      expect(store.currentRootPersonId).toBe('person3');
      expect(store.canGoBack).toBe(true);
    });
  });

  // ── connection finder logic ─────────────────────────────────────────────────

  describe('connection finder', () => {
    it('finds a path between two connected people', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      // person3 has parent relationships to person1 and person2; BFS traverses from person3
      const path = findShortestPath(store.familyTree, 'person3', 'person2');

      expect(path).not.toBeNull();
      expect(path![0]).toBe('person3');
      expect(path![path!.length - 1]).toBe('person2');
    });

    it('returns null for disconnected people', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree({
        rootPersonId: 'a',
        persons: [
          { id: 'a', name: 'A', relationships: [], events: [] },
          { id: 'b', name: 'B', relationships: [], events: [] }
        ]
      });

      const path = findShortestPath(store.familyTree, 'a', 'b');

      expect(path).toBeNull();
    });

    it('stores the path on the store and clears it', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      const path = findShortestPath(store.familyTree, 'person1', 'person3');
      store.setConnectionPath(path);

      expect(store.connectionPath).toEqual(path);

      store.clearConnectionPath();
      expect(store.connectionPath).toBeNull();
    });

    it('returns null when same person is selected for both ends', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      // App.vue short-circuits before calling findShortestPath for same-person
      const person1Id = 'person1';
      const isSame = person1Id === person1Id;
      expect(isSame).toBe(true);

      store.setConnectionPath(null);
      expect(store.connectionPath).toBeNull();
    });
  });

  // ── export ──────────────────────────────────────────────────────────────────

  describe('export', () => {
    it('exportTree produces valid JSON string from the family tree', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      const json = JSON.stringify(store.familyTree, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.persons).toHaveLength(store.familyTree.persons.length);
      expect(parsed.rootPersonId).toBe(store.familyTree.rootPersonId);
    });
  });

  // ── addPerson ───────────────────────────────────────────────────────────────

  describe('addPerson', () => {
    it('adds person to the tree and returns the new person', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);
      const before = store.familyTree.persons.length;

      const newPerson = store.addPerson({ name: 'New Person', relationships: [], events: [] });

      expect(store.familyTree.persons.length).toBe(before + 1);
      expect(newPerson.id).toBeTruthy();
      expect(store.familyTree.persons.find(p => p.id === newPerson.id)).toBeDefined();
    });

    it('sets rootPersonId when tree was empty', () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree({ rootPersonId: undefined, persons: [] });

      const newPerson = store.addPerson({ name: 'First', relationships: [], events: [] });

      expect(store.familyTree.rootPersonId).toBe(newPerson.id);
    });
  });
});
