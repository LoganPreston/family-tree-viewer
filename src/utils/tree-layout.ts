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
  isInvisibleLink?: boolean; // True if link from parent to this node should be invisible (e.g., spouse links)
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
          // Spouse has no parent in the data - need to add them to tree structure
          // If their partner has a parent, add spouse as sibling (child of partner's parent)
          // This ensures they're in the tree and can be positioned next to each other
          // Mark the link as invisible since the spouse isn't actually a child of this parent
          const nodeParent = node.parent;
          if (nodeParent && !nodeParent.isNavigationNode) {
            // Partner has a parent - add spouse as sibling
            spouseNode.parent = nodeParent;
            spouseNode.isInvisibleLink = true; // Mark link as invisible
            if (!nodeParent.children) {
              nodeParent.children = [];
            }
            // Check if already added
            if (!nodeParent.children.some((child: TreeNode) => child.id === spouseId)) {
              nodeParent.children.push(spouseNode);
            }
          }
          // If partner also has no parent (both at root level), this will be handled
          // by the wrapper root logic later
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
  
  // Sort children arrays to group spouses together
  function sortChildrenToGroupSpouses(node: TreeNode): void {
    if (!node.children || node.children.length === 0) return;
    
    // Build a map of all spouse relationships within this children array
    // This handles multiple marriages - a person can have multiple spouses
    const spouseGroups = new Map<string, Set<string>>(); // personId -> Set of spouseIds
    
    for (const child of node.children) {
      const childPerson = personMap.get(child.id);
      if (!childPerson) continue;
      
      // Initialize spouse group for this person
      if (!spouseGroups.has(child.id)) {
        spouseGroups.set(child.id, new Set<string>());
      }
      
      // Find all spouses in this children array
      for (const rel of childPerson.relationships) {
        if (rel.type === 'spouse') {
          const spouseInChildren = node.children.find(c => c.id === rel.personId);
          if (spouseInChildren) {
            // Add to this person's spouse group
            spouseGroups.get(child.id)!.add(rel.personId);
            
            // Also add to spouse's group (reciprocal)
            if (!spouseGroups.has(rel.personId)) {
              spouseGroups.set(rel.personId, new Set<string>());
            }
            spouseGroups.get(rel.personId)!.add(child.id);
          }
        }
      }
    }
    
    // Build connected components of spouses (groups of people who are all spouses of each other)
    const visited = new Set<string>();
    const spouseClusters: Set<string>[] = [];
    
    for (const child of node.children) {
      if (visited.has(child.id)) continue;
      
      const spouseSet = spouseGroups.get(child.id);
      if (spouseSet && spouseSet.size > 0) {
        // This person has spouses - build a cluster
        const cluster = new Set<string>([child.id]);
        visited.add(child.id);
        
        // Add all spouses and their spouses (transitive closure)
        const toProcess = Array.from(spouseSet);
        while (toProcess.length > 0) {
          const spouseId = toProcess.pop()!;
          if (visited.has(spouseId)) continue;
          
          cluster.add(spouseId);
          visited.add(spouseId);
          
          // Add this spouse's spouses to the cluster
          const spouseSpouses = spouseGroups.get(spouseId);
          if (spouseSpouses) {
            for (const spouseSpouseId of spouseSpouses) {
              if (!visited.has(spouseSpouseId) && !cluster.has(spouseSpouseId)) {
                toProcess.push(spouseSpouseId);
              }
            }
          }
        }
        
        spouseClusters.push(cluster);
      }
    }
    
    // Sort children so all spouses in a cluster are grouped together
    const sorted: TreeNode[] = [];
    const used = new Set<string>();
    
    // First, add all spouse clusters
    for (const cluster of spouseClusters) {
      const clusterArray = Array.from(cluster)
        .map(id => node.children!.find(c => c.id === id))
        .filter((c): c is TreeNode => c !== undefined);
      
      // Sort cluster by ID for consistent ordering
      clusterArray.sort((a, b) => a.id.localeCompare(b.id));
      
      for (const child of clusterArray) {
        sorted.push(child);
        used.add(child.id);
      }
    }
    
    // Then add any remaining children (those without spouses in this array)
    for (const child of node.children) {
      if (!used.has(child.id)) {
        sorted.push(child);
      }
    }
    
    node.children = sorted;
    
    // Recursively sort children
    node.children.forEach(child => sortChildrenToGroupSpouses(child));
  }
  
  // Sort all children arrays to group spouses
  sortChildrenToGroupSpouses(rootNode);
  
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

