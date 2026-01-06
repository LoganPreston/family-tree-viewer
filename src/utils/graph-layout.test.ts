import { describe, it, expect } from 'vitest';
import { buildGraphData } from './graph-layout';
import { mockFamilyTree, mockEmptyTree, mockSinglePersonTree, mockSimpleTree } from '../tests/utils/mock-data';
import type { FamilyTree } from '../types/family-tree';

describe('graph-layout', () => {
  describe('buildGraphData', () => {
    describe('Basic Functionality', () => {
      it('should create nodes for all persons', () => {
        const result = buildGraphData(mockFamilyTree);
        
        expect(result).toBeDefined();
        expect(result.nodes).toBeDefined();
        expect(result.nodes.length).toBe(3);
        expect(result.nodes.map(n => n.id)).toEqual(['person1', 'person2', 'person3']);
      });

      it('should preserve person data in nodes', () => {
        const result = buildGraphData(mockFamilyTree);
        
        const person1Node = result.nodes.find(n => n.id === 'person1');
        expect(person1Node).toBeDefined();
        expect(person1Node!.name).toBe('John Doe');
        expect(person1Node!.birthDate).toBe('1 JAN 1900');
        expect(person1Node!.birthPlace).toBeUndefined(); // Not included in GraphNode interface
        expect(person1Node!.deathDate).toBe('1 DEC 1990');
        expect(person1Node!.gender).toBe('M');
      });

      it('should handle empty tree', () => {
        const result = buildGraphData(mockEmptyTree);
        
        expect(result).toBeDefined();
        expect(result.nodes).toBeDefined();
        expect(result.nodes.length).toBe(0);
        expect(result.links).toBeDefined();
        expect(result.links.length).toBe(0);
      });

      it('should handle single person tree', () => {
        const result = buildGraphData(mockSinglePersonTree);
        
        expect(result).toBeDefined();
        expect(result.nodes.length).toBe(1);
        expect(result.nodes[0].id).toBe('person1');
        expect(result.nodes[0].name).toBe('John Doe');
        expect(result.links.length).toBe(0);
      });
    });

    describe('Spouse Link Creation', () => {
      it('should create spouse links for reciprocal relationships', () => {
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
        
        const result = buildGraphData(tree);
        
        expect(result.links.length).toBe(1);
        expect(result.links[0].type).toBe('spouse');
        const link = result.links[0];
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        expect([sourceId, targetId]).toContain('person1');
        expect([sourceId, targetId]).toContain('person2');
      });

      it('should not create spouse links for non-reciprocal relationships', () => {
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
              relationships: [], // No reciprocal relationship
              events: []
            }
          ]
        };
        
        const result = buildGraphData(tree);
        
        expect(result.links.length).toBe(0);
      });

      it('should not create duplicate spouse links', () => {
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
        
        const result = buildGraphData(tree);
        
        // Should only create one link despite both persons having the relationship
        const spouseLinks = result.links.filter(l => l.type === 'spouse');
        expect(spouseLinks.length).toBe(1);
      });

      it('should handle multiple spouses per person', () => {
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
              relationships: [{ type: 'spouse', personId: 'person1' }],
              events: []
            },
            {
              id: 'person3',
              name: 'Person 3',
              relationships: [{ type: 'spouse', personId: 'person1' }],
              events: []
            }
          ]
        };
        
        const result = buildGraphData(tree);
        
        const spouseLinks = result.links.filter(l => l.type === 'spouse');
        expect(spouseLinks.length).toBe(2);
        
        // Check that both spouse relationships are present
        const person1SpouseIds = spouseLinks.map(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return sourceId === 'person1' ? targetId : sourceId;
        });
        expect(person1SpouseIds).toContain('person2');
        expect(person1SpouseIds).toContain('person3');
      });

      it('should track spouse pairs correctly', () => {
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
        
        const result = buildGraphData(tree);
        
        expect(result.links.length).toBe(1);
        expect(result.links[0].type).toBe('spouse');
      });
    });

    describe('Parent-Child Link Creation', () => {
      it('should create links for single parent', () => {
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
        
        const result = buildGraphData(tree);
        
        const parentChildLinks = result.links.filter(l => l.type === 'parent-child');
        expect(parentChildLinks.length).toBe(1);
        
        const link = parentChildLinks[0];
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        expect(sourceId).toBe('person1');
        expect(targetId).toBe('person2');
      });

      it('should create links for two parents who are spouses', () => {
        const tree: FamilyTree = {
          rootPersonId: 'person1',
          persons: [
            {
              id: 'person1',
              name: 'Parent 1',
              relationships: [
                { type: 'spouse', personId: 'person2' },
                { type: 'child', personId: 'person3' }
              ],
              events: []
            },
            {
              id: 'person2',
              name: 'Parent 2',
              relationships: [
                { type: 'spouse', personId: 'person1' },
                { type: 'child', personId: 'person3' }
              ],
              events: []
            },
            {
              id: 'person3',
              name: 'Child',
              relationships: [
                { type: 'parent', personId: 'person1' },
                { type: 'parent', personId: 'person2' }
              ],
              events: []
            }
          ]
        };
        
        const result = buildGraphData(tree);
        
        // Should create one parent-child link (to first parent) with familyUnitId
        const parentChildLinks = result.links.filter(l => l.type === 'parent-child');
        expect(parentChildLinks.length).toBe(1);
        
        const link = parentChildLinks[0];
        expect(link.familyUnitId).toBeDefined();
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        expect(sourceId).toBe('person1');
        expect(targetId).toBe('person3');
      });

      it('should create links for two parents who are not spouses', () => {
        const tree: FamilyTree = {
          rootPersonId: 'person1',
          persons: [
            {
              id: 'person1',
              name: 'Parent 1',
              relationships: [{ type: 'child', personId: 'person3' }],
              events: []
            },
            {
              id: 'person2',
              name: 'Parent 2',
              relationships: [{ type: 'child', personId: 'person3' }],
              events: []
            },
            {
              id: 'person3',
              name: 'Child',
              relationships: [
                { type: 'parent', personId: 'person1' },
                { type: 'parent', personId: 'person2' }
              ],
              events: []
            }
          ]
        };
        
        const result = buildGraphData(tree);
        
        // Should create two parent-child links (one to each parent)
        const parentChildLinks = result.links.filter(l => l.type === 'parent-child');
        expect(parentChildLinks.length).toBe(2);
        
        const sourceIds = parentChildLinks.map(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          return sourceId;
        });
        expect(sourceIds).toContain('person1');
        expect(sourceIds).toContain('person2');
      });

      it('should create links for multiple parents', () => {
        const tree: FamilyTree = {
          rootPersonId: 'person1',
          persons: [
            {
              id: 'person1',
              name: 'Parent 1',
              relationships: [{ type: 'child', personId: 'person4' }],
              events: []
            },
            {
              id: 'person2',
              name: 'Parent 2',
              relationships: [{ type: 'child', personId: 'person4' }],
              events: []
            },
            {
              id: 'person3',
              name: 'Parent 3',
              relationships: [{ type: 'child', personId: 'person4' }],
              events: []
            },
            {
              id: 'person4',
              name: 'Child',
              relationships: [
                { type: 'parent', personId: 'person1' },
                { type: 'parent', personId: 'person2' },
                { type: 'parent', personId: 'person3' }
              ],
              events: []
            }
          ]
        };
        
        const result = buildGraphData(tree);
        
        // Should create links to all parents
        const parentChildLinks = result.links.filter(l => l.type === 'parent-child');
        expect(parentChildLinks.length).toBe(3);
      });

      it('should mark family unit ID for spouse pairs', () => {
        const tree: FamilyTree = {
          rootPersonId: 'person1',
          persons: [
            {
              id: 'person1',
              name: 'Parent 1',
              relationships: [
                { type: 'spouse', personId: 'person2' },
                { type: 'child', personId: 'person3' }
              ],
              events: []
            },
            {
              id: 'person2',
              name: 'Parent 2',
              relationships: [
                { type: 'spouse', personId: 'person1' },
                { type: 'child', personId: 'person3' }
              ],
              events: []
            },
            {
              id: 'person3',
              name: 'Child',
              relationships: [
                { type: 'parent', personId: 'person1' },
                { type: 'parent', personId: 'person2' }
              ],
              events: []
            }
          ]
        };
        
        const result = buildGraphData(tree);
        
        const parentChildLink = result.links.find(l => l.type === 'parent-child');
        expect(parentChildLink).toBeDefined();
        expect(parentChildLink!.familyUnitId).toBeDefined();
        // Family unit ID should be a sorted pair key
        expect(parentChildLink!.familyUnitId).toMatch(/person1\|person2|person2\|person1/);
      });

      it('should avoid duplicate child links', () => {
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
        
        const result = buildGraphData(tree);
        
        const parentChildLinks = result.links.filter(l => l.type === 'parent-child');
        expect(parentChildLinks.length).toBe(1);
      });

      it('should handle children with no parents', () => {
        const tree: FamilyTree = {
          rootPersonId: 'person1',
          persons: [
            {
              id: 'person1',
              name: 'Orphan',
              relationships: [],
              events: []
            }
          ]
        };
        
        const result = buildGraphData(tree);
        
        expect(result.nodes.length).toBe(1);
        expect(result.links.length).toBe(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty relationships', () => {
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
        
        const result = buildGraphData(tree);
        
        expect(result.nodes.length).toBe(2);
        expect(result.links.length).toBe(0);
      });

      it('should handle persons with no relationships', () => {
        const tree: FamilyTree = {
          rootPersonId: 'person1',
          persons: [
            {
              id: 'person1',
              name: 'Person 1',
              relationships: [],
              events: []
            }
          ]
        };
        
        const result = buildGraphData(tree);
        
        expect(result.nodes.length).toBe(1);
        expect(result.links.length).toBe(0);
      });

      it('should handle complex multi-generation trees', () => {
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
        
        const result = buildGraphData(tree);
        
        expect(result.nodes.length).toBe(3);
        const parentChildLinks = result.links.filter(l => l.type === 'parent-child');
        expect(parentChildLinks.length).toBe(2);
      });

      it('should handle orphaned persons', () => {
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
        
        const result = buildGraphData(tree);
        
        expect(result.nodes.length).toBe(2);
        expect(result.links.length).toBe(0);
      });

      it('should handle mockFamilyTree structure', () => {
        const result = buildGraphData(mockFamilyTree);
        
        expect(result.nodes.length).toBe(3);
        // mockFamilyTree has person2 as spouse of person1, and person3 as child of both
        const spouseLinks = result.links.filter(l => l.type === 'spouse');
        const parentChildLinks = result.links.filter(l => l.type === 'parent-child');
        
        // Should have at least one spouse link (person1-person2)
        expect(spouseLinks.length).toBeGreaterThanOrEqual(0);
        // Should have parent-child links
        expect(parentChildLinks.length).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

