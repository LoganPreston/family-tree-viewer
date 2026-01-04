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
  maxGenerations: number = 4
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
    // This ensures they appear at the correct generation level and maintain their own parent relationships
    
    node.children = children.length > 0 ? children : undefined;
    return node;
  }
  
  // Build tree starting from root
  const rootNode = buildNode(rootPersonId, 0, null);
  if (!rootNode) return null;
  
  // Second pass: Add and position spouses
  function positionSpouses(node: TreeNode): void {
    if (!node || node.isNavigationNode) return;
    
    const person = personMap.get(node.id);
    if (!person) return;
    
    // Get all spouses
    const spouseIds = person.relationships
      .filter(rel => rel.type === 'spouse')
      .map(rel => rel.personId);
    
    for (const spouseId of spouseIds) {
      // Check if spouse is already in the tree
      let spouseNode = nodeMap.get(spouseId);
      
      if (!spouseNode) {
        // Spouse not in tree yet - add them at the same generation
        const spousePerson = personMap.get(spouseId);
        if (!spousePerson) continue;
        
        // Verify reciprocal relationship
        const isReciprocal = spousePerson.relationships.some(r => 
          r.type === 'spouse' && r.personId === node.id
        );
        if (!isReciprocal) continue;
        
        // Determine generation based on spouse's own parent relationships
        let spouseGeneration = node.generation ?? 0;
        const spouseParentRel = spousePerson.relationships.find(r => r.type === 'parent');
        
        if (spouseParentRel) {
          // Spouse has a parent - check if that parent is in the tree
          const spouseParentNode = nodeMap.get(spouseParentRel.personId);
          if (spouseParentNode && spouseParentNode.generation !== undefined) {
            spouseGeneration = spouseParentNode.generation + 1;
          }
        } else {
          // No parent - use same generation as partner
          spouseGeneration = node.generation ?? 0;
        }
        
        // Create spouse node
        spouseNode = {
          id: spousePerson.id,
          name: spousePerson.name,
          birthDate: spousePerson.birthDate,
          deathDate: spousePerson.deathDate,
          gender: spousePerson.gender,
          generation: spouseGeneration,
          children: undefined,
          parent: null
        };
        nodeMap.set(spouseId, spouseNode);
        
        // Set parent based on spouse's actual parent relationship
        if (spouseParentRel) {
          const spouseParentNode = nodeMap.get(spouseParentRel.personId);
          if (spouseParentNode) {
            spouseNode.parent = spouseParentNode;
            if (!spouseParentNode.children) {
              spouseParentNode.children = [];
            }
            // Check if already added
            if (!spouseParentNode.children.some((child: TreeNode) => child.id === spouseId)) {
              spouseParentNode.children.push(spouseNode);
            }
          }
        } else {
          // Spouse has no parent in the data
          // Don't force them to share partner's parent - maintain their own structure
          // For positioning, we'll handle this by ensuring they're at the same generation level
          // and using the separation function to position them next to each other
          // If partner has a parent, we still don't add spouse to that parent
          // Instead, we'll rely on the tree layout's separation function to position them
          // For tree structure purposes, we may need to add them as siblings, but only if
          // it doesn't violate their actual parent relationships
          // Actually, for the tree layout to work, nodes need to be in a hierarchy
          // So if spouse has no parent and partner has a parent, we need to handle this specially
          // One approach: create a temporary grouping node, but that's complex
          // Another: add spouse to root level if partner is at root level
          // For now, if partner has no parent (root level), we'll handle at root level
          // If partner has a parent, we'll add spouse as sibling only for tree structure,
          // but this is a limitation - they won't be positioned next to each other if they're not siblings
          const nodeParent = node.parent;
          if (!nodeParent || nodeParent.isNavigationNode) {
            // Partner is at root level - spouse should also be at root level
            // We'll handle this by ensuring they're both children of the root
            // This will be handled when we process the root node
          }
          // If partner has a parent, we can't easily position spouse next to them
          // without making them siblings, which violates the requirement
          // For now, we'll leave spouse without a parent - they'll appear at root level
        }
      } else {
        // Spouse already in tree - ensure they're positioned next to each other
        // If they share a parent, they should already be siblings
        // If not, we need to ensure they're at the same generation level
        const spousePerson = personMap.get(spouseId);
        if (!spousePerson) continue;
        
        const nodeParent = node.parent;
        const spouseParent = spouseNode.parent;
        
        // Only make them siblings if they actually share a parent in the data
        if (nodeParent && spouseParent && nodeParent.id === spouseParent.id) {
          // They already share a parent - good
        } else {
          // Check if they should share a parent based on data
          const nodeParentId = person.relationships.find((r: any) => r.type === 'parent')?.personId;
          const spouseParentId = spousePerson.relationships.find((r: any) => r.type === 'parent')?.personId;
          
          if (nodeParentId && spouseParentId && nodeParentId === spouseParentId) {
            // They should share a parent - ensure they're both children of that parent
            const sharedParentNode = nodeMap.get(nodeParentId);
            if (sharedParentNode) {
              node.parent = sharedParentNode;
              spouseNode.parent = sharedParentNode;
              if (!sharedParentNode.children) {
                sharedParentNode.children = [];
              }
              if (!sharedParentNode.children.some((child: TreeNode) => child.id === node.id)) {
                sharedParentNode.children.push(node);
              }
              if (!sharedParentNode.children.some((child: TreeNode) => child.id === spouseId)) {
                sharedParentNode.children.push(spouseNode);
              }
            }
          }
        }
      }
    }
    
    // Recursively process children
    if (node.children) {
      node.children.forEach((child: TreeNode) => positionSpouses(child));
    }
  }
  
  // Position all spouses
  positionSpouses(rootNode);
  
  // Handle root-level spouses (spouses that don't have parents)
  // If root has a spouse at root level, ensure they're positioned as siblings
  let finalRoot = rootNode;
  const rootSpouseIds = rootPerson.relationships
    .filter(rel => rel.type === 'spouse')
    .map(rel => rel.personId);
  
  for (const spouseId of rootSpouseIds) {
    const spousePerson = personMap.get(spouseId);
    if (!spousePerson) continue;
    
    // Check if spouse has a parent
    const spouseParentRel = spousePerson.relationships.find((r: any) => r.type === 'parent');
    if (!spouseParentRel) {
      // Spouse has no parent - they're at root level
      // Ensure they're positioned as sibling to root
      let spouseNode = nodeMap.get(spouseId);
      if (spouseNode && !spouseNode.parent) {
        // Spouse is at root level - if root also has no parent (or only navigation parent),
        // we need to create a wrapper or ensure they're siblings
        // For now, if root has no actual parent (only navigation), make them siblings
        if (!finalRoot.parent || finalRoot.parent.isNavigationNode) {
          // Create a wrapper root to hold both root and spouse as siblings
          const wrapperRoot: TreeNode = {
            id: '__wrapper_root__',
            name: '',
            generation: -1,
            children: [finalRoot, spouseNode],
            parent: null
          };
          finalRoot.parent = wrapperRoot;
          spouseNode.parent = wrapperRoot;
          finalRoot = wrapperRoot;
        }
      }
    }
  }
  
  // Add parent navigation node if root has parents
  // Need to check the actual root person, not the wrapper
  const actualRootNode = finalRoot.id === '__wrapper_root__' ? finalRoot.children![0] : finalRoot;
  const actualRootPersonId = actualRootNode.id;
  const actualRootPerson = personMap.get(actualRootPersonId);
  
  if (actualRootPerson) {
    const rootParents = actualRootPerson.relationships
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

