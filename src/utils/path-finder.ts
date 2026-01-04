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

