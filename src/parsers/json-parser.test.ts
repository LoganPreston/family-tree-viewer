import { describe, it, expect } from 'vitest';
import { parseJson } from './json-parser';
import { mockFamilyTree, mockPerson1 } from '../tests/utils/mock-data';

describe('json-parser', () => {
  describe('parseJson', () => {
    it('should parse valid JSON family tree', () => {
      const json = JSON.stringify(mockFamilyTree);
      const result = parseJson(json);
      
      expect(result).toBeDefined();
      expect(result.persons).toHaveLength(3);
      expect(result.rootPersonId).toBe('person1');
    });

    it('should validate person data structure', () => {
      const validData = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      const json = JSON.stringify(validData);
      const result = parseJson(json);
      
      expect(result.persons[0].id).toBe('person1');
      expect(result.persons[0].name).toBe('John Doe');
      expect(result.persons[0].birthDate).toBe('1 JAN 1900');
    });

    it('should validate relationships array', () => {
      const data = {
        persons: [
          {
            id: 'person1',
            name: 'Test',
            relationships: [
              { type: 'parent', personId: 'person2' },
              { type: 'child', personId: 'person3' },
              { type: 'spouse', personId: 'person4' }
            ],
            events: []
          }
        ]
      };
      const json = JSON.stringify(data);
      const result = parseJson(json);
      
      expect(result.persons[0].relationships).toHaveLength(3);
      expect(result.persons[0].relationships[0].type).toBe('parent');
    });

    it('should validate events array', () => {
      const data = {
        persons: [
          {
            id: 'person1',
            name: 'Test',
            relationships: [],
            events: [
              {
                type: 'Marriage',
                date: '1 JAN 1920',
                place: 'New York'
              }
            ]
          }
        ]
      };
      const json = JSON.stringify(data);
      const result = parseJson(json);
      
      expect(result.persons[0].events).toHaveLength(1);
      expect(result.persons[0].events![0].type).toBe('Marriage');
    });

    it('should handle invalid JSON', () => {
      expect(() => parseJson('invalid json')).toThrow();
    });

    it('should handle missing required fields', () => {
      const invalidData = {
        persons: [
          {
            name: 'Test' // missing id
          }
        ]
      };
      const json = JSON.stringify(invalidData);
      
      expect(() => parseJson(json)).toThrow();
    });

    it('should handle invalid field types', () => {
      const invalidData = {
        persons: [
          {
            id: 123, // should be string
            name: 'Test',
            relationships: [],
            events: []
          }
        ]
      };
      const json = JSON.stringify(invalidData);
      
      expect(() => parseJson(json)).toThrow();
    });

    it('should handle empty persons array', () => {
      const data = {
        persons: []
      };
      const json = JSON.stringify(data);
      const result = parseJson(json);
      
      expect(result.persons).toHaveLength(0);
      expect(result.rootPersonId).toBeUndefined();
    });

    it('should handle optional fields', () => {
      const data = {
        persons: [
          {
            id: 'person1',
            name: 'Test',
            relationships: []
            // no events, birthDate, etc.
          }
        ]
      };
      const json = JSON.stringify(data);
      const result = parseJson(json);
      
      expect(result.persons[0].events).toBeUndefined();
      expect(result.persons[0].birthDate).toBeUndefined();
    });

    it('should validate rootPersonId exists in persons', () => {
      const data = {
        rootPersonId: 'nonexistent',
        persons: [
          {
            id: 'person1',
            name: 'Test',
            relationships: [],
            events: []
          }
        ]
      };
      const json = JSON.stringify(data);
      
      expect(() => parseJson(json)).toThrow('rootPersonId');
    });

    it('should handle invalid relationship types', () => {
      const data = {
        persons: [
          {
            id: 'person1',
            name: 'Test',
            relationships: [
              { type: 'invalid', personId: 'person2' }
            ],
            events: []
          }
        ]
      };
      const json = JSON.stringify(data);
      
      expect(() => parseJson(json)).toThrow();
    });

    it('should handle missing relationship personId', () => {
      const data = {
        persons: [
          {
            id: 'person1',
            name: 'Test',
            relationships: [
              { type: 'parent' } // missing personId
            ],
            events: []
          }
        ]
      };
      const json = JSON.stringify(data);
      
      expect(() => parseJson(json)).toThrow();
    });
  });
});

