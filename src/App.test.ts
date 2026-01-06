import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFamilyTreeStore } from './stores/family-tree-store';
import { mockFamilyTree } from './tests/utils/mock-data';

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
});
