import type { Person, FamilyTree } from '../types/family-tree';

export interface TreeNode {
  id: string;
  name: string;
  birthDate?: string;
  deathDate?: string;
  gender?: string;
  x?: number;
  y?: number;
  children?: TreeNode[];
  parent?: TreeNode | null;
  isNavigationNode?: boolean; // True for parent navigation node
  generation?: number; // Generation level (0 = root)
}

export function buildTreeData(
  familyTree: FamilyTree,
  rootPersonId: string,
  maxGenerations: number = 5
): TreeNode | null {
  if (!rootPersonId || familyTree.persons.length === 0) {
    return null;
  }
  
  const personMap = new Map<string, Person>();
  for (const person of familyTree.persons) {
    personMap.set(person.id, person);
  }
  
  const rootPerson = personMap.get(rootPersonId);
  if (!rootPerson) return null;
  
  const nodeMap = new Map<string, TreeNode>();
  const visited = new Set<string>(); // Prevent cycles
  
  // Recursive function to build tree with generation limiting
  function buildNode(personId: string, generation: number, parentNode: TreeNode | null = null): TreeNode | null {
    if (generation >= maxGenerations) return null;
    if (visited.has(personId)) return null; // Prevent cycles
    
    visited.add(personId);
    
    const person = personMap.get(personId);
    if (!person) return null;
    
    // Create or get node
    let node = nodeMap.get(personId);
    if (!node) {
      node = {
        id: person.id,
        name: person.name,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        gender: person.gender,
        generation,
        children: undefined,
        parent: parentNode
      };
      nodeMap.set(personId, node);
    } else {
      // Node already exists, just update generation and parent
      node.generation = Math.min(node.generation ?? generation, generation);
      if (parentNode && !node.parent) {
        node.parent = parentNode;
      }
    }
    
    // Build children (next generation)
    const children: TreeNode[] = [];
    const childToParents = new Map<string, string[]>();
    
    // Collect all children and their parents
    for (const rel of person.relationships) {
      if (rel.type === 'child') {
        if (!childToParents.has(rel.personId)) {
          childToParents.set(rel.personId, []);
        }
        childToParents.get(rel.personId)!.push(person.id);
      }
    }
    
    // Also collect from other parents of these children
    for (const [childId, parents] of childToParents.entries()) {
      const childPerson = personMap.get(childId);
      if (childPerson) {
        for (const rel of childPerson.relationships) {
          if (rel.type === 'parent' && !parents.includes(rel.personId)) {
            parents.push(rel.personId);
          }
        }
      }
    }
    
    const childrenAssigned = new Set<string>();
    
    // Add children
    for (const rel of person.relationships) {
      if (rel.type === 'child') {
        const childId = rel.personId;
        if (childrenAssigned.has(childId)) continue;
        
        const parents = childToParents.get(childId) || [];
        
        // Check if parents are spouses
        let areSpouses = false;
        if (parents.length >= 2) {
          if (parents.length === 2) {
            const [p1, p2] = parents;
            const p1Person = personMap.get(p1);
            const p2Person = personMap.get(p2);
            if (p1Person && p2Person) {
              areSpouses = p1Person.relationships.some(r => r.type === 'spouse' && r.personId === p2) ||
                          p2Person.relationships.some(r => r.type === 'spouse' && r.personId === p1);
            }
          }
        }
        
        if (areSpouses && parents.length === 2) {
          // Only add child once for spouse couples
          if (parents.includes(person.id)) {
            const childNode = buildNode(childId, generation + 1, node);
            if (childNode) {
              children.push(childNode);
              childrenAssigned.add(childId);
            }
          }
        } else {
          // Add child normally
          const childNode = buildNode(childId, generation + 1, node);
          if (childNode) {
            children.push(childNode);
            childrenAssigned.add(childId);
          }
        }
      }
    }
    
    // Note: Spouses will be added in a second pass after the tree is built
    // This ensures they appear as siblings at the same generation level
    
    node.children = children.length > 0 ? children : undefined;
    return node;
  }
  
  // Build tree starting from root
  const rootNode = buildNode(rootPersonId, 0, null);
  if (!rootNode) return null;
  
  // Second pass: Add spouses as siblings at the same generation level
  function addSpousesAsSiblings(node: TreeNode): TreeNode | null {
    if (!node || node.isNavigationNode) return null;
    
    const person = personMap.get(node.id);
    if (!person) return null;
    
    // Get all spouses
    const spouseIds = person.relationships
      .filter(rel => rel.type === 'spouse')
      .map(rel => rel.personId);
    
    let wrapperRoot: TreeNode | null = null;
    
    for (const spouseId of spouseIds) {
      // Check if spouse is already in the tree
      let spouseNode = nodeMap.get(spouseId);
      
      if (!spouseNode) {
        // Spouse not in tree yet, add them
        const spousePerson = personMap.get(spouseId);
        if (!spousePerson) continue;
        
        // Verify reciprocal relationship
        const isReciprocal = spousePerson.relationships.some(r => 
          r.type === 'spouse' && r.personId === node.id
        );
        if (!isReciprocal) continue;
        
        // Create spouse node at same generation
        spouseNode = {
          id: spousePerson.id,
          name: spousePerson.name,
          birthDate: spousePerson.birthDate,
          deathDate: spousePerson.deathDate,
          gender: spousePerson.gender,
          generation: node.generation ?? 0,
          children: undefined,
          parent: node.parent
        };
        nodeMap.set(spouseId, spouseNode);
      }
      
      // Ensure spouse is a sibling (same parent)
      if (node.parent) {
        // Add to parent's children array as a sibling
        if (!node.parent.children) {
          node.parent.children = [];
        }
        // Check if already added
        const alreadyAdded = node.parent.children.some((child: TreeNode) => child.id === spouseId);
        if (!alreadyAdded) {
          node.parent.children.push(spouseNode);
          spouseNode.parent = node.parent;
        }
      } else {
        // No parent (root level) - create a wrapper node to hold both as siblings
        if (!wrapperRoot) {
          wrapperRoot = {
            id: '__wrapper_root__',
            name: '',
            generation: -1,
            children: [node, spouseNode],
            parent: null
          };
          node.parent = wrapperRoot;
        } else {
          // Check if spouse already in wrapper
          const alreadyInWrapper = wrapperRoot.children!.some((child: TreeNode) => child.id === spouseId);
          if (!alreadyInWrapper) {
            wrapperRoot.children!.push(spouseNode);
          }
        }
        spouseNode.parent = wrapperRoot;
      }
    }
    
    // Recursively process children
    if (node.children) {
      node.children.forEach((child: TreeNode) => addSpousesAsSiblings(child));
    }
    
    return wrapperRoot;
  }
  
  // Add spouses as siblings
  let finalRoot = rootNode;
  const wrapper = addSpousesAsSiblings(rootNode);
  if (wrapper) {
    finalRoot = wrapper;
  }
  
  // Add parent navigation node if root has parents
  const rootPersonFinal = personMap.get(rootPersonId);
  if (rootPersonFinal) {
    const rootParents = rootPersonFinal.relationships
      .filter(rel => rel.type === 'parent')
      .map(rel => rel.personId);
    
    if (rootParents.length > 0) {
      // Create a virtual parent navigation node
      const parentNavNode: TreeNode = {
        id: '__parent_nav__',
        name: '↑ Parent',
        isNavigationNode: true,
        generation: -1, // One generation before root
        children: [finalRoot],
        parent: null
      };
      
      finalRoot.parent = parentNavNode;
      return parentNavNode;
    }
  }
  
  return finalRoot;
}

