import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import App from './App.vue';
import { useFamilyTreeStore } from './stores/family-tree-store';
import type { FamilyTree } from './types/family-tree';

const populated: FamilyTree = {
  rootPersonId: 'p1',
  persons: [
    {
      id: 'p1',
      name: 'Alice Smith',
      birthDate: '1 JAN 1850',
      birthPlace: 'London, England',
      deathDate: '1 JAN 1920',
      gender: 'F',
      relationships: [{ type: 'child', personId: 'p3' }],
      events: []
    },
    {
      id: 'p2',
      name: 'Bob Jones',
      birthDate: '15 MAR 1900',
      birthPlace: 'Paris, France',
      deathDate: '10 APR 1970',
      gender: 'M',
      relationships: [{ type: 'child', personId: 'p3' }],
      events: []
    },
    {
      id: 'p3',
      name: 'Carol Smith',
      birthDate: '10 JUN 1950',
      birthPlace: 'New York, USA',
      gender: 'F',
      relationships: [
        { type: 'parent', personId: 'p1' },
        { type: 'parent', personId: 'p2' },
      ],
      events: []
    },
  ]
};

async function openSearch(wrapper: ReturnType<typeof shallowMount>) {
  await wrapper.find('.search-btn').trigger('click');
  await wrapper.vm.$nextTick();
}

describe('App (component)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('empty state', () => {
    it('shows empty state when tree has no data', () => {
      const wrapper = shallowMount(App);
      expect(wrapper.find('.empty-state-container').exists()).toBe(true);
      expect(wrapper.find('.tree-container').exists()).toBe(false);
    });

    it('hides header action buttons when no data', () => {
      const wrapper = shallowMount(App);
      expect(wrapper.find('.search-btn').exists()).toBe(false);
      expect(wrapper.find('.stats-btn').exists()).toBe(false);
      expect(wrapper.find('.export-btn').exists()).toBe(false);
    });
  });

  describe('with data loaded', () => {
    it('shows tree container when data is loaded', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.tree-container').exists()).toBe(true);
      expect(wrapper.find('.empty-state-container').exists()).toBe(false);
    });

    it('shows header action buttons when data is loaded', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.search-btn').exists()).toBe(true);
      expect(wrapper.find('.stats-btn').exists()).toBe(true);
      expect(wrapper.find('.export-btn').exists()).toBe(true);
    });

    it('shows back button only when canGoBack is true', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.back-btn').exists()).toBe(false);

      store.setCurrentRoot('p2');
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.back-btn').exists()).toBe(true);
    });

    it('shows clear highlight button only when connection path is set', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.clear-highlight-btn').exists()).toBe(false);

      store.setConnectionPath(['p1', 'p2']);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.clear-highlight-btn').exists()).toBe(true);
    });
  });

  describe('search modal', () => {
    it('opens when search button is clicked', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.search-modal').exists()).toBe(false);
      await openSearch(wrapper);
      expect(wrapper.find('.search-modal').exists()).toBe(true);
    });

    it('closes when close button is clicked', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();
      await openSearch(wrapper);
      await wrapper.find('.search-modal .close-btn').trigger('click');
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.search-modal').exists()).toBe(false);
    });

    it('shows no results when search modal first opens', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();
      await openSearch(wrapper);
      expect(wrapper.findAll('.search-result-item')).toHaveLength(0);
      expect(wrapper.find('.no-results').exists()).toBe(false);
    });

    describe('name filter', () => {
      it('filters results by name', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        const nameInput = wrapper.findAll('.search-input')[0];
        await nameInput.setValue('alice');
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(1);
        expect(results[0].text()).toContain('Alice Smith');
      });

      it('is case-insensitive', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        await wrapper.findAll('.search-input')[0].setValue('CAROL');
        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('.search-result-item')).toHaveLength(1);
      });

      it('shows no-results message when name matches nothing', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        await wrapper.findAll('.search-input')[0].setValue('zzznobody');
        await wrapper.vm.$nextTick();

        expect(wrapper.find('.no-results').exists()).toBe(true);
        expect(wrapper.findAll('.search-result-item')).toHaveLength(0);
      });
    });

    describe('birth year filters', () => {
      it('filters by born after year', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        // born after 1890 → p2 (1900) and p3 (1950); p1 (1850) excluded
        const yearInputs = wrapper.findAll('.year-input');
        await yearInputs[0].setValue('1890'); // born after
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(2);
        const names = results.map(r => r.text());
        expect(names.some(n => n.includes('Bob Jones'))).toBe(true);
        expect(names.some(n => n.includes('Carol Smith'))).toBe(true);
        expect(names.some(n => n.includes('Alice Smith'))).toBe(false);
      });

      it('filters by born before year', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        // born before 1890 → p1 (1850); p2 (1900) and p3 (1950) excluded
        const yearInputs = wrapper.findAll('.year-input');
        await yearInputs[1].setValue('1890'); // born before
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(1);
        expect(results[0].text()).toContain('Alice Smith');
      });

      it('excludes people with no birth date when year filter is active', async () => {
        const treeWithNoBirthDate: FamilyTree = {
          rootPersonId: 'x1',
          persons: [
            { id: 'x1', name: 'Known Birth', birthDate: '1 JAN 1900', relationships: [], events: [] },
            { id: 'x2', name: 'Unknown Birth', relationships: [], events: [] },
          ]
        };
        const store = useFamilyTreeStore();
        store.loadFamilyTree(treeWithNoBirthDate);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        await wrapper.findAll('.year-input')[0].setValue('1800');
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(1);
        expect(results[0].text()).toContain('Known Birth');
      });
    });

    describe('death year filters', () => {
      it('filters by died after year', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        // died after 1950 → p2 (1970); p1 (1920) excluded; p3 no death date excluded
        const yearInputs = wrapper.findAll('.year-input');
        await yearInputs[2].setValue('1950'); // died after
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(1);
        expect(results[0].text()).toContain('Bob Jones');
      });

      it('filters by died before year', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        // died before 1950 → p1 (1920); p2 (1970) and p3 (no death) excluded
        const yearInputs = wrapper.findAll('.year-input');
        await yearInputs[3].setValue('1950'); // died before
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(1);
        expect(results[0].text()).toContain('Alice Smith');
      });
    });

    describe('birth place filter', () => {
      it('filters by birth place substring', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        // "England" matches Alice (London, England); not Bob (Paris, France) or Carol (New York, USA)
        const inputs = wrapper.findAll('.search-input');
        await inputs[1].setValue('England'); // birth place input
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(1);
        expect(results[0].text()).toContain('Alice Smith');
      });

      it('is case-insensitive for birth place', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        const inputs = wrapper.findAll('.search-input');
        await inputs[1].setValue('france');
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(1);
        expect(results[0].text()).toContain('Bob Jones');
      });
    });

    describe('combined filters', () => {
      it('ANDs name and birth year filters', async () => {
        const store = useFamilyTreeStore();
        store.loadFamilyTree(populated);
        const wrapper = shallowMount(App);
        await wrapper.vm.$nextTick();
        await openSearch(wrapper);

        // Name "smith" matches Alice (1850) and Carol (1950)
        // + born after 1880 → only Carol (1950)
        await wrapper.findAll('.search-input')[0].setValue('smith');
        await wrapper.findAll('.year-input')[0].setValue('1880');
        await wrapper.vm.$nextTick();

        const results = wrapper.findAll('.search-result-item');
        expect(results).toHaveLength(1);
        expect(results[0].text()).toContain('Carol Smith');
      });
    });
  });

  describe('connection modal', () => {
    it('opens when Find Connection button is clicked', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.connection-modal').exists()).toBe(false);

      await wrapper.find('.connection-btn').trigger('click');
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.connection-modal').exists()).toBe(true);
    });

    it('closes when close button is clicked but keeps the highlight', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      store.setConnectionPath(['p1', 'p2']);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();

      await wrapper.find('.connection-btn').trigger('click');
      await wrapper.vm.$nextTick();
      await wrapper.find('.connection-modal .close-btn').trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.connection-modal').exists()).toBe(false);
      // Highlight is preserved after closing
      expect(store.connectionPath).toEqual(['p1', 'p2']);
    });
  });

  describe('clear data', () => {
    it('clears the tree when clear data button is clicked', async () => {
      const store = useFamilyTreeStore();
      store.loadFamilyTree(populated);
      const wrapper = shallowMount(App);
      await wrapper.vm.$nextTick();

      await wrapper.find('.clear-data-btn').trigger('click');
      await wrapper.vm.$nextTick();

      expect(store.familyTree.persons).toHaveLength(0);
      expect(wrapper.find('.empty-state-container').exists()).toBe(true);
    });
  });
});
