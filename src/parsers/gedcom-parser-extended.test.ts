import { describe, it, expect } from 'vitest';
import { parseGedcom } from './gedcom-parser';

describe('gedcom-parser extended', () => {
  describe('SOURCE resolution', () => {
    it('resolves a source xref to its title', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @S1@ SOURCE
1 TITLE Platt Family Genealogy 1976
0 @I1@ INDI
1 NAME Test /Person/
1 BIRT
2 DATE 1 JAN 1800
2 SOUR @S1@
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].birthSource).toBe('Platt Family Genealogy 1976');
    });

    it('resolves a death source xref', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @S2@ SOURCE
1 TITLE Church Records 1850
0 @I1@ INDI
1 NAME Test /Person/
1 DEAT
2 DATE 1 DEC 1890
2 SOUR @S2@
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].deathSource).toBe('Church Records 1850');
    });

    it('keeps the raw xref if no matching SOURCE record exists', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 BIRT
2 DATE 1 JAN 1800
2 SOUR @S99@
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].birthSource).toBe('@S99@');
    });

    it('stores inline source text as-is', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 BIRT
2 DATE 1 JAN 1800
2 SOURCE Platt Family Genealogy by Robert M.Platt-1976
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].birthSource).toBe('Platt Family Genealogy by Robert M.Platt-1976');
    });
  });

  describe('NOTE resolution', () => {
    it('resolves a NOTE xref to assembled text', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @N1@ NOTE
1 CONC This is a note
1 CONT with a second line
0 @I1@ INDI
1 NAME Test /Person/
1 NOTE @N1@
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].notes).toBeDefined();
      expect(result.persons[0].notes![0]).toContain('This is a note');
      expect(result.persons[0].notes![0]).toContain('second line');
    });

    it('handles an inline NOTE on the person', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 NOTE Some inline note text
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].notes).toBeDefined();
      expect(result.persons[0].notes![0]).toBe('Some inline note text');
    });

    it('does not add a note when xref is missing from noteMap', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 NOTE @N99@
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].notes ?? []).toHaveLength(0);
    });
  });

  describe('underscore custom tags', () => {
    it('parses _MEDICAL as an event with note', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 _MEDICAL Diabetes diagnosed 1952
0 TRLR`;

      const result = parseGedcom(gedcom);
      const medical = result.persons[0].events?.find(e => e.type === 'MEDICAL');
      expect(medical).toBeDefined();
      expect(medical!.note).toBe('Diabetes diagnosed 1952');
    });

    it('parses any underscore tag as event type without the leading underscore', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 _MILT Served in WWII
0 TRLR`;

      const result = parseGedcom(gedcom);
      const milt = result.persons[0].events?.find(e => e.type === 'MILT');
      expect(milt).toBeDefined();
      expect(milt!.note).toBe('Served in WWII');
    });
  });

  describe('OCCUPATION and RELIGION with sub-tags', () => {
    it('parses occupation from PLACE sub-tag when DATE also present', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 OCCUPATION
2 DATE ABT. 1987
2 PLACE Salesman(Plastics)
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].occupation).toBe('Salesman(Plastics)');
    });

    it('parses religion from inline value when no PLACE sub-tag', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 RELIGION Catholic
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].religion).toBe('Catholic');
    });
  });

  describe('FAMS / FAMC relationship links', () => {
    it('links spouses and children via FAMS/FAMC and FAM record', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME John /Doe/
1 FAMS @F1@
0 @I2@ INDI
1 NAME Jane /Doe/
1 FAMS @F1@
0 @I3@ INDI
1 NAME Child /Doe/
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR`;

      const result = parseGedcom(gedcom);
      const john = result.persons.find(p => p.name === 'John Doe');
      const child = result.persons.find(p => p.name === 'Child Doe');

      expect(john?.relationships.some(r => r.type === 'spouse')).toBe(true);
      expect(child?.relationships.some(r => r.type === 'parent')).toBe(true);
    });
  });

  describe('death place', () => {
    it('parses death place', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME Test /Person/
1 DEAT
2 DATE 1 SEP 1693
2 PLACE Huntington,Long Island,New York
0 TRLR`;

      const result = parseGedcom(gedcom);
      expect(result.persons[0].deathPlace).toBe('Huntington,Long Island,New York');
    });
  });

  describe('events with source', () => {
    it('parses event source', () => {
      const gedcom = `0 HEAD
1 SOUR Test
0 @S1@ SOURCE
1 TITLE Marriage Registry
0 @I1@ INDI
1 NAME Test /Person/
1 EVEN
2 TYPE Marriage
2 DATE 1 JAN 1920
2 PLACE New York
2 SOUR @S1@
0 TRLR`;

      const result = parseGedcom(gedcom);
      const event = result.persons[0].events?.[0];
      expect(event?.source).toBe('Marriage Registry');
    });
  });
});
