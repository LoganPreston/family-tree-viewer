import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import TreeViewer from './TreeViewer.vue';
import { useFamilyTreeStore } from '../stores/family-tree-store';
import { mockFamilyTree } from '../tests/utils/mock-data';

describe('TreeViewer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Suppress console warnings from D3 errors in test environment
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render SVG element', () => {
    const wrapper = shallowMount(TreeViewer, {
      global: {
        stubs: {
          PersonEditor: true
        }
      }
    });
    
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('should display empty state when no data', () => {
    const wrapper = shallowMount(TreeViewer, {
      global: {
        stubs: {
          PersonEditor: true
        }
      }
    });
    
    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.find('.empty-state').text()).toContain('No family tree data loaded');
  });

  it('should include PersonEditor component', () => {
    const wrapper = shallowMount(TreeViewer, {
      global: {
        stubs: {
          PersonEditor: true
        }
      }
    });
    
    // Test that the component includes PersonEditor
    expect(wrapper.findComponent({ name: 'PersonEditor' }).exists()).toBe(true);
  });

  describe('Helper Functions', () => {
    // Note: Helper functions are internal to the component, so we test them through component behavior
    // For extractYearFromBirthdate and wrapText, we test through rendering behavior
    // For isLinkInPath, isNodeInPath, openEditor, closeEditor - we test through component state/behavior

    describe('Connection Path Helpers', () => {
      it('should handle connection path state in store', () => {
        const store = useFamilyTreeStore();
        store.setConnectionPath(['person1', 'person2', 'person3']);
        expect(store.connectionPath).toEqual(['person1', 'person2', 'person3']);
      });

      it('should handle null connection path in store', () => {
        const store = useFamilyTreeStore();
        store.clearConnectionPath();
        expect(store.connectionPath).toBeNull();
      });
    });

    describe('Editor State Management', () => {
      it('should include PersonEditor component', () => {
        const wrapper = shallowMount(TreeViewer, {
          global: {
            stubs: {
              PersonEditor: true
            }
          }
        });
        
        const personEditor = wrapper.findComponent({ name: 'PersonEditor' });
        expect(personEditor.exists()).toBe(true);
        expect(personEditor.props('isOpen')).toBe(false);
        expect(personEditor.props('personId')).toBeNull();
      });
    });

  });

  describe('Interactions', () => {
    it('should handle zoom and pan updates in store', () => {
      const store = useFamilyTreeStore();
      
      // Update zoom and pan
      store.setZoom(1.5);
      store.setPan(100, 200);
      
      expect(store.zoom).toBe(1.5);
      expect(store.panX).toBe(100);
      expect(store.panY).toBe(200);
    });
  });

  describe('Watchers', () => {
    it('should react to connectionPath changes in store', () => {
      const store = useFamilyTreeStore();
      
      // Set connection path
      store.setConnectionPath(['person1', 'person2']);
      expect(store.connectionPath).toEqual(['person1', 'person2']);
      
      // Clear connection path
      store.clearConnectionPath();
      expect(store.connectionPath).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tree', async () => {
      const store = useFamilyTreeStore();
      const emptyTree = {
        rootPersonId: undefined,
        persons: []
      };
      store.loadFamilyTree(emptyTree);

      const wrapper = shallowMount(TreeViewer, {
        global: {
          stubs: {
            PersonEditor: true
          }
        }
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find('.empty-state').exists()).toBe(true);
    });
  });

  describe('With data loaded', () => {
    it('should not show empty state when family tree is loaded', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(mockFamilyTree);

      const wrapper = shallowMount(TreeViewer, {
        global: {
          stubs: {
            PersonEditor: true
          }
        }
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find('.empty-state').exists()).toBe(false);
    });
  });

  describe('resetView store integration', () => {
    it('should reset zoom and pan to defaults via store', () => {
      const store = useFamilyTreeStore();
      store.setZoom(2.5);
      store.setPan(150, 300);

      store.resetView();

      expect(store.zoom).toBe(1);
      expect(store.panX).toBe(0);
      expect(store.panY).toBe(0);
    });
  });
});

