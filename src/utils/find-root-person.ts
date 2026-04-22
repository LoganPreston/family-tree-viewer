import type { Person } from '../types/family-tree';

/**
 * Picks the best root person from a list using a 3-tier heuristic:
 * 1. A person with no parents who has children (true genealogical root)
 * 2. Any person with no parents
 * 3. The first person in the array
 */
export function findRootPersonId(persons: Person[]): string | undefined {
  if (!persons.length) return undefined;

  const noParentsWithChildren = persons.find(p =>
    !p.relationships.some(r => r.type === 'parent') &&
    p.relationships.some(r => r.type === 'child')
  );
  if (noParentsWithChildren) return noParentsWithChildren.id;

  const noParents = persons.find(p => !p.relationships.some(r => r.type === 'parent'));
  if (noParents) return noParents.id;

  return persons[0].id;
}
