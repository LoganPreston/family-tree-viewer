import { describe, it, expect } from 'vitest';
import { findRootPersonId } from './find-root-person';
import type { Person } from '../types/family-tree';

function person(id: string, rels: { type: string; personId: string }[] = []): Person {
  return { id, name: id, relationships: rels as Person['relationships'], events: [] };
}

describe('findRootPersonId', () => {
  it('returns undefined for empty array', () => {
    expect(findRootPersonId([])).toBeUndefined();
  });

  it('returns the only person for a single-person array', () => {
    expect(findRootPersonId([person('p1')])).toBe('p1');
  });

  it('prefers person with no parents who has children', () => {
    const persons = [
      person('child', [{ type: 'parent', personId: 'root' }]),
      person('root', [{ type: 'child', personId: 'child' }]),
    ];
    expect(findRootPersonId(persons)).toBe('root');
  });

  it('falls back to person with no parents when no one has children', () => {
    const persons = [
      person('a', [{ type: 'parent', personId: 'b' }]),
      person('b'),
    ];
    expect(findRootPersonId(persons)).toBe('b');
  });

  it('falls back to first person when everyone has parents', () => {
    const persons = [
      person('a', [{ type: 'parent', personId: 'b' }]),
      person('b', [{ type: 'parent', personId: 'a' }]),
    ];
    expect(findRootPersonId(persons)).toBe('a');
  });
});
