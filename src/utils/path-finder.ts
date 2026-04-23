import type { FamilyTree, Person } from '../types/family-tree';

/**
 * Finds the shortest path between two people in a family tree using BFS.
 * Traverses relationships bidirectionally (parent-child and spouse).
 * 
 * @param familyTree The family tree data
 * @param person1Id The ID of the starting person
 * @param person2Id The ID of the target person
 * @returns Array of person IDs representing the path, or null if no path exists
 */
export function findShortestPath(
  familyTree: FamilyTree,
  person1Id: string,
  person2Id: string
): string[] | null {
  if (person1Id === person2Id) {
    return [person1Id]; // Same person
  }

  // Build person map for quick lookup
  const personMap = new Map<string, Person>();
  for (const person of familyTree.persons) {
    personMap.set(person.id, person);
  }

  // Check if both people exist
  if (!personMap.has(person1Id) || !personMap.has(person2Id)) {
    return null;
  }

  // BFS queue: [currentPersonId, pathToCurrentPerson]
  const queue: Array<{ personId: string; path: string[] }> = [
    { personId: person1Id, path: [person1Id] }
  ];
  
  const visited = new Set<string>();
  visited.add(person1Id);

  while (queue.length > 0) {
    const { personId, path } = queue.shift()!;
    const person = personMap.get(personId);
    
    if (!person) continue;

    // Explore all relationships
    for (const rel of person.relationships) {
      const relatedPersonId = rel.personId;
      
      // Skip if already visited
      if (visited.has(relatedPersonId)) continue;

      // Check if we've reached the target
      if (relatedPersonId === person2Id) {
        return [...path, relatedPersonId];
      }

      // Add to queue and mark as visited
      visited.add(relatedPersonId);
      queue.push({
        personId: relatedPersonId,
        path: [...path, relatedPersonId]
      });
    }
  }

  // No path found
  return null;
}

/**
 * Returns the set of all people blood-related to personId (direct ancestors,
 * descendants, and anyone sharing a common ancestor) by traversing only
 * parent/child edges — spouse links are excluded. The seed person is not
 * included in the result.
 */
export function findBloodRelatives(familyTree: FamilyTree, personId: string): Set<string> {
  const personMap = new Map<string, Person>();
  for (const person of familyTree.persons) personMap.set(person.id, person);

  const reachable = new Set<string>();
  const queue = [personId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const person = personMap.get(current);
    if (!person) continue;
    for (const rel of person.relationships) {
      if ((rel.type === 'parent' || rel.type === 'child') && !reachable.has(rel.personId)) {
        queue.push(rel.personId);
      }
    }
  }

  reachable.delete(personId);
  return reachable;
}

/**
 * Returns the set of all direct ancestors of personId by following only
 * 'parent' edges. The seed person is not included in the result.
 */
export function findAncestors(familyTree: FamilyTree, personId: string): Set<string> {
  const personMap = new Map<string, Person>();
  for (const person of familyTree.persons) personMap.set(person.id, person);

  const ancestors = new Set<string>();
  const queue = [personId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const person = personMap.get(current);
    if (!person) continue;
    for (const rel of person.relationships) {
      if (rel.type === 'parent' && !ancestors.has(rel.personId)) {
        ancestors.add(rel.personId);
        queue.push(rel.personId);
      }
    }
  }

  return ancestors;
}

/**
 * Returns the set of all direct descendants of personId by following only
 * 'child' edges. The seed person is not included in the result.
 */
export function findDescendants(familyTree: FamilyTree, personId: string): Set<string> {
  const personMap = new Map<string, Person>();
  for (const person of familyTree.persons) personMap.set(person.id, person);

  const descendants = new Set<string>();
  const queue = [personId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const person = personMap.get(current);
    if (!person) continue;
    for (const rel of person.relationships) {
      if (rel.type === 'child' && !descendants.has(rel.personId)) {
        descendants.add(rel.personId);
        queue.push(rel.personId);
      }
    }
  }

  return descendants;
}

/**
 * Returns true if potentialDescendantId is reachable from ancestorId
 * by following only 'child' relationship edges.
 */
export function isDescendant(
  familyTree: FamilyTree,
  ancestorId: string,
  potentialDescendantId: string
): boolean {
  if (ancestorId === potentialDescendantId) return true;
  const personMap = new Map<string, { relationships: { type: string; personId: string }[] }>();
  for (const p of familyTree.persons) personMap.set(p.id, p);

  const visited = new Set<string>();
  const queue = [ancestorId];
  visited.add(ancestorId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const person = personMap.get(current);
    if (!person) continue;
    for (const rel of person.relationships) {
      if (rel.type !== 'child') continue;
      if (rel.personId === potentialDescendantId) return true;
      if (!visited.has(rel.personId)) {
        visited.add(rel.personId);
        queue.push(rel.personId);
      }
    }
  }
  return false;
}

