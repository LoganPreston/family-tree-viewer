import { describe, it, expect } from 'vitest';
import { parseGedcom } from './gedcom-parser';
import {
  validGedcomSimple,
  validGedcomWithRelationships,
  validGedcomWithReligionAndOccupation,
  validGedcomWithEvents,
  validGedcomWithStructuredName,
  invalidGedcomEmpty,
  invalidGedcomMalformed
} from '../tests/utils/mock-gedcom';

describe('gedcom-parser', () => {
  describe('parseGedcom', () => {
    it('should parse valid GEDCOM with standard INDI records', () => {
      const result = parseGedcom(validGedcomSimple);
      
      expect(result).toBeDefined();
      expect(result.persons).toHaveLength(1);
      expect(result.persons[0].name).toBe('John Doe');
      expect(result.persons[0].gender).toBe('M');
    });

    it('should parse birth and death dates', () => {
      const result = parseGedcom(validGedcomSimple);
      
      expect(result.persons[0].birthDate).toBe('1 JAN 1900');
      expect(result.persons[0].deathDate).toBe('1 DEC 1990');
    });

    it('should parse birth place', () => {
      const result = parseGedcom(validGedcomSimple);
      
      expect(result.persons[0].birthPlace).toBe('New York');
    });

    it('should parse FAMILY_SPOUSE and FAMILY_CHILD relationships', () => {
      const result = parseGedcom(validGedcomWithRelationships);
      
      expect(result.persons).toHaveLength(3);
      
      const person1 = result.persons.find(p => p.name === 'John Doe');
      const person2 = result.persons.find(p => p.name === 'Jane Doe');
      const person3 = result.persons.find(p => p.name === 'Bob Doe');
      
      expect(person1).toBeDefined();
      expect(person2).toBeDefined();
      expect(person3).toBeDefined();
      
      // Check spouse relationship
      const person1Spouse = person1!.relationships.find(r => r.type === 'spouse');
      expect(person1Spouse).toBeDefined();
      expect(person1Spouse!.personId).toBe(person2!.id);
      
      // Check parent-child relationships
      const person3Parents = person3!.relationships.filter(r => r.type === 'parent');
      expect(person3Parents.length).toBeGreaterThan(0);
    });

    it('should parse gender (SEX)', () => {
      const result = parseGedcom(validGedcomSimple);
      
      expect(result.persons[0].gender).toBe('M');
    });

    it('should parse religion and occupation', () => {
      const result = parseGedcom(validGedcomWithReligionAndOccupation);
      
      expect(result.persons[0].religion).toBe('Protestant');
      expect(result.persons[0].occupation).toBe('Engineer');
    });

    it('should parse events with TYPE, DATE, PLACE', () => {
      const result = parseGedcom(validGedcomWithEvents);
      
      expect(result.persons[0].events).toBeDefined();
      expect(result.persons[0].events!.length).toBeGreaterThan(0);
      expect(result.persons[0].events![0].type).toBe('Marriage');
      expect(result.persons[0].events![0].date).toBe('1 JAN 1920');
      expect(result.persons[0].events![0].place).toBe('New York');
    });

    it('should parse structured names (GIVN, SURN)', () => {
      const result = parseGedcom(validGedcomWithStructuredName);
      
      expect(result.persons[0].name).toBe('John Doe');
    });

    it('should handle empty files', () => {
      const result = parseGedcom(invalidGedcomEmpty);
      
      expect(result.persons).toHaveLength(0);
    });

    it('should handle malformed GEDCOM data gracefully', () => {
      const result = parseGedcom(invalidGedcomMalformed);
      
      // Should not throw, but may have empty persons
      expect(result).toBeDefined();
      expect(Array.isArray(result.persons)).toBe(true);
    });

    it('should handle missing fields', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test Person
0 TRLR`;
      
      const result = parseGedcom(gedcom);
      
      expect(result.persons[0].name).toBe('Test Person');
      expect(result.persons[0].birthDate).toBeUndefined();
      expect(result.persons[0].gender).toBeUndefined();
    });

    it('should handle nested DATE structures', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test
1 BIRT
2 DATE
3 DATE 1 JAN 1900
0 TRLR`;
      
      const result = parseGedcom(gedcom);
      
      // Should handle nested DATE structures
      expect(result.persons[0].birthDate).toBeDefined();
    });

    it('should handle both BIRT and BIRTH tags', () => {
      const gedcomBirt = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test
1 BIRT
2 DATE 1 JAN 1900
0 TRLR`;
      
      const gedcomBirth = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test
1 BIRTH
2 DATE 1 JAN 1900
0 TRLR`;
      
      const result1 = parseGedcom(gedcomBirt);
      const result2 = parseGedcom(gedcomBirth);
      
      expect(result1.persons[0].birthDate).toBe('1 JAN 1900');
      expect(result2.persons[0].birthDate).toBe('1 JAN 1900');
    });

    it('should handle both DEAT and DEATH tags', () => {
      const gedcomDeat = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test
1 DEAT
2 DATE 1 DEC 1990
0 TRLR`;
      
      const gedcomDeath = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test
1 DEATH
2 DATE 1 DEC 1990
0 TRLR`;
      
      const result1 = parseGedcom(gedcomDeat);
      const result2 = parseGedcom(gedcomDeath);
      
      expect(result1.persons[0].deathDate).toBe('1 DEC 1990');
      expect(result2.persons[0].deathDate).toBe('1 DEC 1990');
    });

    it('should remove slashes from names', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME John /Doe/
0 TRLR`;
      
      const result = parseGedcom(gedcom);
      
      expect(result.persons[0].name).toBe('John Doe');
    });
  });
});

