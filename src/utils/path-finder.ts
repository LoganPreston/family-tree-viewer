import type { FamilyTree, Person } from '../types/family-tree';

function buildPersonMap(familyTree: FamilyTree): Map<string, Person> {
  return new Map(familyTree.persons.map(p => [p.id, p]));
}

function bfsRelatives(
  familyTree: FamilyTree,
  personId: string,
  follow: (relType: string) => boolean
): Set<string> {
  const personMap = buildPersonMap(familyTree);
  const visited = new Set<string>();
  const queue = [personId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const rel of personMap.get(current)?.relationships ?? []) {
      if (follow(rel.type) && !visited.has(rel.personId)) queue.push(rel.personId);
    }
  }
  visited.delete(personId);
  return visited;
}

/**
 * Finds the shortest path between two people in a family tree using BFS.
 * Traverses relationships bidirectionally (parent-child and spouse).
 */
export function findShortestPath(
  familyTree: FamilyTree,
  person1Id: string,
  person2Id: string
): string[] | null {
  if (person1Id === person2Id) return [person1Id];

  const personMap = buildPersonMap(familyTree);
  if (!personMap.has(person1Id) || !personMap.has(person2Id)) return null;

  const queue: Array<{ personId: string; path: string[] }> = [
    { personId: person1Id, path: [person1Id] }
  ];
  const visited = new Set<string>([person1Id]);

  while (queue.length > 0) {
    const { personId, path } = queue.shift()!;
    for (const rel of personMap.get(personId)?.relationships ?? []) {
      if (visited.has(rel.personId)) continue;
      if (rel.personId === person2Id) return [...path, rel.personId];
      visited.add(rel.personId);
      queue.push({ personId: rel.personId, path: [...path, rel.personId] });
    }
  }
  return null;
}

/** Returns all blood relatives (ancestors + descendants + shared-ancestor kin), excluding spouses. */
export function findBloodRelatives(familyTree: FamilyTree, personId: string): Set<string> {
  return bfsRelatives(familyTree, personId, t => t === 'parent' || t === 'child');
}

/** Returns all direct ancestors by following parent links only. */
export function findAncestors(familyTree: FamilyTree, personId: string): Set<string> {
  return bfsRelatives(familyTree, personId, t => t === 'parent');
}

/** Returns all direct descendants by following child links only. */
export function findDescendants(familyTree: FamilyTree, personId: string): Set<string> {
  return bfsRelatives(familyTree, personId, t => t === 'child');
}

/** Returns true if potentialDescendantId is reachable from ancestorId via child links. */
export function isDescendant(
  familyTree: FamilyTree,
  ancestorId: string,
  potentialDescendantId: string
): boolean {
  if (ancestorId === potentialDescendantId) return true;
  return findDescendants(familyTree, ancestorId).has(potentialDescendantId);
}
