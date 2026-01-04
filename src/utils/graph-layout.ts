import type { Person, FamilyTree } from '../types/family-tree';

export interface GraphNode {
  id: string;
  name: string;
  birthDate?: string;
  deathDate?: string;
  gender?: string;
  x?: number;
  y?: number;
  vx?: number; // velocity x (for force simulation)
  vy?: number; // velocity y
  fx?: number; // fixed x position (optional)
  fy?: number; // fixed y position (optional)
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'parent-child' | 'spouse';
  // For parent-child links where parents are spouses, track the family unit
  familyUnitId?: string; // ID of the spouse pair for connecting children
}

export interface FamilyGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function buildGraphData(familyTree: FamilyTree): FamilyGraph {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  
  const personMap = new Map<string, Person>();
  for (const person of familyTree.persons) {
    personMap.set(person.id, person);
  }
  
  // Create nodes for all persons
  for (const person of familyTree.persons) {
    const node: GraphNode = {
      id: person.id,
      name: person.name,
      birthDate: person.birthDate,
      deathDate: person.deathDate,
      gender: person.gender
    };
    nodes.push(node);
  }
  
  // Track spouse pairs for family unit connections
  const spousePairs = new Map<string, string[]>(); // pairKey -> [personId1, personId2]
  
  // Create spouse links
  const processedSpousePairs = new Set<string>();
  for (const person of familyTree.persons) {
    for (const rel of person.relationships) {
      if (rel.type === 'spouse') {
        const pairKey = [person.id, rel.personId].sort().join('|');
        if (!processedSpousePairs.has(pairKey)) {
          processedSpousePairs.add(pairKey);
          
          // Verify reciprocal relationship
          const spousePerson = personMap.get(rel.personId);
          if (spousePerson) {
            const isReciprocal = spousePerson.relationships.some(r => 
              r.type === 'spouse' && r.personId === person.id
            );
            
            if (isReciprocal) {
              links.push({
                source: person.id,
                target: rel.personId,
                type: 'spouse'
              });
              
              // Track spouse pair
              spousePairs.set(pairKey, [person.id, rel.personId]);
            }
          }
        }
      }
    }
  }
  
  // Track which children belong to which couples to avoid duplicates
  const childToParents = new Map<string, string[]>(); // childId -> array of parentIds
  
  // First pass: collect all parent-child relationships
  for (const person of familyTree.persons) {
    for (const rel of person.relationships) {
      if (rel.type === 'child') {
        if (!childToParents.has(rel.personId)) {
          childToParents.set(rel.personId, []);
        }
        childToParents.get(rel.personId)!.push(person.id);
      }
    }
  }
  
  // Second pass: create parent-child links
  // If child's parents are spouses, we'll connect to family unit (handled in visualization)
  const childrenConnected = new Set<string>();
  
  for (const person of familyTree.persons) {
    for (const rel of person.relationships) {
      if (rel.type === 'child') {
        const childId = rel.personId;
        if (childrenConnected.has(childId)) continue;
        
        const parents = childToParents.get(childId) || [];
        
        if (parents.length > 1) {
          // Check if parents are spouses
          let areSpouses = false;
          if (parents.length === 2) {
            const [parent1, parent2] = parents;
            const parent1Person = personMap.get(parent1);
            const parent2Person = personMap.get(parent2);
            if (parent1Person && parent2Person) {
              const parent1IsSpouseOf2 = parent1Person.relationships.some(r => 
                r.type === 'spouse' && r.personId === parent2
              );
              const parent2IsSpouseOf1 = parent2Person.relationships.some(r => 
                r.type === 'spouse' && r.personId === parent1
              );
              areSpouses = parent1IsSpouseOf2 || parent2IsSpouseOf1;
            }
          }
          
          if (areSpouses) {
            // Parents are spouses - create link to first parent, mark family unit
            const pairKey = [parents[0], parents[1]].sort().join('|');
            links.push({
              source: parents[0],
              target: childId,
              type: 'parent-child',
              familyUnitId: pairKey
            });
            childrenConnected.add(childId);
          } else {
            // Not all parents are spouses - create links to all parents
            for (const parentId of parents) {
              links.push({
                source: parentId,
                target: childId,
                type: 'parent-child'
              });
            }
            childrenConnected.add(childId);
          }
        } else if (parents.length === 1) {
          // Single parent
          links.push({
            source: parents[0],
            target: childId,
            type: 'parent-child'
          });
          childrenConnected.add(childId);
        }
      }
    }
  }
  
  return { nodes, links };
}

