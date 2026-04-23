import { describe, it, expect } from 'vitest';
import { extractYearFromBirthdate } from './date-utils';

describe('date-utils', () => {
  describe('extractYearFromBirthdate', () => {
    it('returns null for undefined', () => {
      expect(extractYearFromBirthdate(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractYearFromBirthdate('')).toBeNull();
    });

    it('parses a standard GEDCOM date', () => {
      expect(extractYearFromBirthdate('1 JAN 1900')).toBe(1900);
    });

    it('parses a 20xx year', () => {
      expect(extractYearFromBirthdate('15 MAR 2005')).toBe(2005);
    });

    it('parses an approximate date (ABT.)', () => {
      expect(extractYearFromBirthdate('ABT. 1850')).toBe(1850);
    });

    it('parses a year-only string', () => {
      expect(extractYearFromBirthdate('1776')).toBe(1776);
    });

    it('parses a date with BEF prefix', () => {
      expect(extractYearFromBirthdate('BEF 1700')).toBe(1700);
    });

    it('parses a date with AFT prefix', () => {
      expect(extractYearFromBirthdate('AFT 1800')).toBe(1800);
    });

    it('returns null for text with no year', () => {
      expect(extractYearFromBirthdate('Unknown')).toBeNull();
    });

    it('returns null for a number outside the valid range', () => {
      expect(extractYearFromBirthdate('999')).toBeNull();
    });

    it('returns null for a year above 2100', () => {
      expect(extractYearFromBirthdate('2200')).toBeNull();
    });

    it('prefers a 19xx/20xx year when multiple 4-digit numbers appear', () => {
      expect(extractYearFromBirthdate('FROM 1850 TO 1900')).toBe(1900);
    });

    it('parses a year at the boundary (1000)', () => {
      expect(extractYearFromBirthdate('1000')).toBe(1000);
    });

    it('parses a year at the boundary (2100)', () => {
      expect(extractYearFromBirthdate('2100')).toBe(2100);
    });
  });
});
