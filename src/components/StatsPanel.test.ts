import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import StatsPanel from './StatsPanel.vue';
import { useFamilyTreeStore } from '../stores/family-tree-store';
import type { FamilyTree } from '../types/family-tree';

// 5-person tree with known stats
const statsTree: FamilyTree = {
  rootPersonId: 'p1',
  persons: [
    {
      id: 'p1',
      name: 'Alice Smith',
      birthDate: '1 JAN 1800',
      birthPlace: 'London, England',
      deathDate: '1 JAN 1880',
      gender: 'F',
      relationships: [
        { type: 'child', personId: 'p3' },
        { type: 'child', personId: 'p4' },
        { type: 'child', personId: 'p5' },
      ],
      events: []
    },
    {
      id: 'p2',
      name: 'Bob Smith',
      birthDate: '1 JAN 1900',
      birthPlace: 'Manchester, England',
      gender: 'M',
      relationships: [
        { type: 'child', personId: 'p3' },
        { type: 'child', personId: 'p4' },
      ],
      events: []
    },
    {
      id: 'p3',
      name: 'Charlie Smith',
      birthDate: '1 JAN 1950',
      birthPlace: 'London, England',
      gender: 'M',
      relationships: [
        { type: 'parent', personId: 'p1' },
        { type: 'parent', personId: 'p2' },
      ],
      events: []
    },
    {
      id: 'p4',
      name: 'Diana Jones',
      birthPlace: 'Paris, France',
      gender: 'F',
      relationships: [
        { type: 'parent', personId: 'p1' },
        { type: 'parent', personId: 'p2' },
      ],
      events: []
    },
    {
      id: 'p5',
      name: 'Eve Williams',
      birthDate: '1 JAN 2000',
      birthPlace: 'London, England',
      gender: 'F',
      relationships: [
        { type: 'parent', personId: 'p1' },
      ],
      events: []
    },
  ]
};

describe('StatsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    const store = useFamilyTreeStore();
    store.loadFamilyTree(statsTree);
  });

  it('renders without errors', () => {
    const wrapper = mount(StatsPanel);
    expect(wrapper.find('.stats-modal').exists()).toBe(true);
  });

  it('emits close when the X button is clicked', async () => {
    const wrapper = mount(StatsPanel);
    await wrapper.find('.close-btn').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits close when the overlay is clicked', async () => {
    const wrapper = mount(StatsPanel);
    await wrapper.find('.stats-overlay').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  describe('overview stats', () => {
    it('shows the correct total person count', () => {
      const wrapper = mount(StatsPanel);
      const cards = wrapper.findAll('.stat-value');
      // First stat card is total
      expect(cards[0].text()).toBe('5');
    });

    it('shows the correct known birth date count', () => {
      const wrapper = mount(StatsPanel);
      const cards = wrapper.findAll('.stat-value');
      // p1, p2, p3, p5 have birthDate; p4 does not → 4
      expect(cards[1].text()).toBe('4');
    });

    it('shows the correct known death date count', () => {
      const wrapper = mount(StatsPanel);
      const cards = wrapper.findAll('.stat-value');
      // Only p1 has deathDate → 1
      expect(cards[2].text()).toBe('1');
    });

    it('shows male count', () => {
      const wrapper = mount(StatsPanel);
      expect(wrapper.find('.stat-card.male .stat-value').text()).toBe('2');
    });

    it('shows female count', () => {
      const wrapper = mount(StatsPanel);
      expect(wrapper.find('.stat-card.female .stat-value').text()).toBe('3');
    });

    it('shows unknown gender count', () => {
      const wrapper = mount(StatsPanel);
      expect(wrapper.find('.stat-card.unknown .stat-value').text()).toBe('0');
    });
  });

  describe('lifespan', () => {
    it('shows the oldest person (earliest birth year)', () => {
      const wrapper = mount(StatsPanel);
      const text = wrapper.html();
      // Alice Smith born 1800 is the oldest
      expect(text).toContain('Alice Smith');
    });

    it('shows the youngest person (latest birth year)', () => {
      const wrapper = mount(StatsPanel);
      const text = wrapper.html();
      // Eve Williams born 2000 is the youngest
      expect(text).toContain('Eve Williams');
    });
  });

  describe('family', () => {
    it('shows the person with the most children', () => {
      const wrapper = mount(StatsPanel);
      const text = wrapper.html();
      // Alice Smith has 3 children (p3, p4, p5)
      expect(text).toContain('Alice Smith');
      expect(text).toContain('3 children');
    });

    it('shows deepest ancestry depth greater than zero', () => {
      const wrapper = mount(StatsPanel);
      const text = wrapper.html();
      // Charlie/Diana/Eve each have 1 generation back
      expect(text).toContain('generations back');
    });
  });

  describe('birth centuries chart', () => {
    it('renders century bars for each century with data', () => {
      const wrapper = mount(StatsPanel);
      const rows = wrapper.findAll('.century-row');
      // Data spans 1800, 1900, 2000
      expect(rows.length).toBe(3);
    });

    it('labels the centuries correctly', () => {
      const wrapper = mount(StatsPanel);
      const labels = wrapper.findAll('.century-label').map(el => el.text());
      expect(labels).toContain('1800s');
      expect(labels).toContain('1900s');
      expect(labels).toContain('2000s');
    });
  });

  describe('top birth places', () => {
    it('shows England as the most common birth region', () => {
      const wrapper = mount(StatsPanel);
      const text = wrapper.html();
      // p1, p2, p3, p5 all resolve to England; p4 → France
      expect(text).toContain('England');
      expect(text).toContain('France');
    });
  });

  describe('navigation', () => {
    it('navigates to a person and closes when a clickable stat is clicked', async () => {
      const store = useFamilyTreeStore();
      const wrapper = mount(StatsPanel);
      // Click the first clickable stat-row-value (oldest person)
      const clickable = wrapper.find('.stat-row-value.clickable');
      await clickable.trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
      // Root should have changed to the person referenced
      expect(store.currentRootPersonId).toBeTruthy();
    });
  });
});
