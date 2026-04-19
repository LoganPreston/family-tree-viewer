import type { Person, FamilyTree } from '../types/family-tree';

export interface TreeNode {
  id: string;
  name: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  gender?: string;
  x?: number;
  y?: number;
  children?: TreeNode[];
  parent?: TreeNode | null;
  isNavigationNode?: boolean;
  generation?: number;
  isInvisibleLink?: boolean;
}

// ── Pass 1: build parent→children hierarchy ───────────────────────────────────

function buildNode(
  personId: string,
  generation: number,
  parentNode: TreeNode | null,
  personMap: Map<string, Person>,
  nodeMap: Map<string, TreeNode>,
  visited: Set<string>,
  maxGenerations: number
): TreeNode | null {
  if (generation >= maxGenerations) return null;
  if (visited.has(personId)) return null;

  visited.add(personId);

  const person = personMap.get(personId);
  if (!person) return null;

  let node = nodeMap.get(personId);
  if (!node) {
    node = {
      id: person.id,
      name: person.name,
      birthDate: person.birthDate,
      birthPlace: person.birthPlace,
      deathDate: person.deathDate,
      gender: person.gender,
      generation,
      children: undefined,
      parent: parentNode
    };
    nodeMap.set(personId, node);
  } else {
    node.generation = Math.min(node.generation ?? generation, generation);
    if (parentNode && !node.parent) {
      node.parent = parentNode;
    }
  }

  const children: TreeNode[] = [];
  const childToParents = new Map<string, string[]>();

  for (const rel of person.relationships) {
    if (rel.type === 'child') {
      if (!childToParents.has(rel.personId)) {
        childToParents.set(rel.personId, []);
      }
      childToParents.get(rel.personId)!.push(person.id);
    }
  }

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

  for (const rel of person.relationships) {
    if (rel.type === 'child') {
      const childId = rel.personId;
      if (childrenAssigned.has(childId)) continue;

      const parents = childToParents.get(childId) || [];

      let areSpouses = false;
      if (parents.length === 2) {
        const [p1, p2] = parents;
        const p1Person = personMap.get(p1);
        const p2Person = personMap.get(p2);
        if (p1Person && p2Person) {
          areSpouses =
            p1Person.relationships.some(r => r.type === 'spouse' && r.personId === p2) ||
            p2Person.relationships.some(r => r.type === 'spouse' && r.personId === p1);
        }
      }

      if (areSpouses && parents.length === 2) {
        if (parents.includes(person.id)) {
          const childNode = buildNode(childId, generation + 1, node, personMap, nodeMap, visited, maxGenerations);
          if (childNode) {
            children.push(childNode);
            childrenAssigned.add(childId);
          }
        }
      } else {
        const childNode = buildNode(childId, generation + 1, node, personMap, nodeMap, visited, maxGenerations);
        if (childNode) {
          children.push(childNode);
          childrenAssigned.add(childId);
        }
      }
    }
  }

  node.children = children.length > 0 ? children : undefined;
  return node;
}

// ── Pass 2: inject spouse nodes ───────────────────────────────────────────────

// Attach spouseNode as a structural sibling under partnerNode's parent with an
// invisible link (the dashed spouse line is drawn separately by TreeViewer).
// Returns true if successfully attached; false if the partner has no parent in
// the tree (deferred to resolveOrphanSpouses / resolveRootSpouses).
function attachSpouseAsInvisibleSibling(
  spouseNode: TreeNode,
  partnerNode: TreeNode,
  nodeMap: Map<string, TreeNode>
): boolean {
  const partnerParent = partnerNode.parent;
  if (!partnerParent || partnerParent.isNavigationNode || !nodeMap.has(partnerParent.id)) {
    return false;
  }
  spouseNode.parent = partnerParent;
  spouseNode.isInvisibleLink = true;
  if (!partnerParent.children) partnerParent.children = [];
  if (!partnerParent.children.some(c => c.id === spouseNode.id)) {
    partnerParent.children.push(spouseNode);
  }
  return true;
}

function positionSpouses(
  node: TreeNode,
  personMap: Map<string, Person>,
  nodeMap: Map<string, TreeNode>
): void {
  if (!node || node.isNavigationNode) return;

  const person = personMap.get(node.id);
  if (!person) return;

  const spouseIds = person.relationships
    .filter(rel => rel.type === 'spouse')
    .map(rel => rel.personId);

  for (const spouseId of spouseIds) {
    let spouseNode = nodeMap.get(spouseId);

    if (!spouseNode) {
      // Spouse not yet in tree — create and place them
      const spousePerson = personMap.get(spouseId);
      if (!spousePerson) continue;

      const isReciprocal = spousePerson.relationships.some(
        r => r.type === 'spouse' && r.personId === node.id
      );
      if (!isReciprocal) continue;

      const spouseParentRel = spousePerson.relationships.find(r => r.type === 'parent');
      let spouseGeneration = node.generation ?? 0;

      if (spouseParentRel) {
        const spouseParentNode = nodeMap.get(spouseParentRel.personId);
        if (spouseParentNode?.generation !== undefined) {
          spouseGeneration = spouseParentNode.generation + 1;
        }
      }

      spouseNode = {
        id: spousePerson.id,
        name: spousePerson.name,
        birthDate: spousePerson.birthDate,
        birthPlace: spousePerson.birthPlace,
        deathDate: spousePerson.deathDate,
        gender: spousePerson.gender,
        generation: spouseGeneration,
        children: undefined,
        parent: null
      };
      nodeMap.set(spouseId, spouseNode);

      if (spouseParentRel) {
        const spouseParentNode = nodeMap.get(spouseParentRel.personId);
        if (spouseParentNode) {
          // Spouse's own parent is in the tree — attach normally
          spouseNode.parent = spouseParentNode;
          if (!spouseParentNode.children) spouseParentNode.children = [];
          if (!spouseParentNode.children.some(c => c.id === spouseId)) {
            spouseParentNode.children.push(spouseNode);
          }
        } else {
          // Spouse has a parent but it's outside the visible tree — attach as
          // invisible sibling under the partner's parent (if available)
          attachSpouseAsInvisibleSibling(spouseNode, node, nodeMap);
        }
      } else {
        // Spouse has no parent data at all — attach as invisible sibling if
        // the partner has a parent; otherwise wrapper root logic handles it
        attachSpouseAsInvisibleSibling(spouseNode, node, nodeMap);
      }
    } else {
      // Spouse already in tree — ensure they share a structural parent when
      // the underlying data says they should
      const spousePerson = personMap.get(spouseId);
      if (!spousePerson) continue;

      const nodeParent = node.parent;
      const spouseParent = spouseNode.parent;
      const alreadyShared = nodeParent && spouseParent && nodeParent.id === spouseParent.id;

      if (!alreadyShared) {
        const nodeParentId = person.relationships.find(r => r.type === 'parent')?.personId;
        const spouseParentId = spousePerson.relationships.find(r => r.type === 'parent')?.personId;

        if (nodeParentId && spouseParentId && nodeParentId === spouseParentId) {
          const sharedParentNode = nodeMap.get(nodeParentId);
          if (sharedParentNode) {
            node.parent = sharedParentNode;
            spouseNode.parent = sharedParentNode;
            if (!sharedParentNode.children) sharedParentNode.children = [];
            if (!sharedParentNode.children.some(c => c.id === node.id)) {
              sharedParentNode.children.push(node);
            }
            if (!sharedParentNode.children.some(c => c.id === spouseId)) {
              sharedParentNode.children.push(spouseNode);
            }
          }
        }
      }
    }
  }

  if (node.children) {
    node.children.forEach(child => positionSpouses(child, personMap, nodeMap));
  }
}

// ── Pass 3: cluster spouse pairs together in each children array ──────────────

function sortChildrenToGroupSpouses(
  node: TreeNode,
  personMap: Map<string, Person>
): void {
  if (!node.children || node.children.length === 0) return;

  const spouseGroups = new Map<string, Set<string>>();

  for (const child of node.children) {
    const childPerson = personMap.get(child.id);
    if (!childPerson) continue;

    if (!spouseGroups.has(child.id)) spouseGroups.set(child.id, new Set());

    for (const rel of childPerson.relationships) {
      if (rel.type === 'spouse') {
        const spouseInChildren = node.children.find(c => c.id === rel.personId);
        if (spouseInChildren) {
          spouseGroups.get(child.id)!.add(rel.personId);
          if (!spouseGroups.has(rel.personId)) spouseGroups.set(rel.personId, new Set());
          spouseGroups.get(rel.personId)!.add(child.id);
        }
      }
    }
  }

  // Build connected components of spouse pairs
  const visited = new Set<string>();
  const spouseClusters: Set<string>[] = [];

  for (const child of node.children) {
    if (visited.has(child.id)) continue;

    const spouseSet = spouseGroups.get(child.id);
    if (!spouseSet || spouseSet.size === 0) continue;

    const cluster = new Set<string>([child.id]);
    visited.add(child.id);

    const toProcess = Array.from(spouseSet);
    while (toProcess.length > 0) {
      const spouseId = toProcess.pop()!;
      if (visited.has(spouseId)) continue;
      cluster.add(spouseId);
      visited.add(spouseId);
      const spouseSpouses = spouseGroups.get(spouseId);
      if (spouseSpouses) {
        for (const id of spouseSpouses) {
          if (!visited.has(id)) toProcess.push(id);
        }
      }
    }

    spouseClusters.push(cluster);
  }

  const sorted: TreeNode[] = [];
  const used = new Set<string>();

  for (const cluster of spouseClusters) {
    const clusterArray = Array.from(cluster)
      .map(id => node.children!.find(c => c.id === id))
      .filter((c): c is TreeNode => c !== undefined);

    clusterArray.sort((a, b) => a.id.localeCompare(b.id));

    for (const child of clusterArray) {
      sorted.push(child);
      used.add(child.id);
    }
  }

  for (const child of node.children) {
    if (!used.has(child.id)) sorted.push(child);
  }

  node.children = sorted;
  node.children.forEach(child => sortChildrenToGroupSpouses(child, personMap));
}

// ── Pass 4: attach any spouse nodes left without a parent ─────────────────────

function resolveOrphanSpouses(
  nodeMap: Map<string, TreeNode>,
  personMap: Map<string, Person>
): void {
  for (const [spouseId, spouseNode] of nodeMap.entries()) {
    if (spouseNode.parent) continue;

    const spousePerson = personMap.get(spouseId);
    if (!spousePerson) continue;

    const partnerIds = spousePerson.relationships
      .filter(rel => rel.type === 'spouse')
      .map(rel => rel.personId);

    for (const partnerId of partnerIds) {
      const partnerNode = nodeMap.get(partnerId);
      if (!partnerNode) continue;

      const partnerParent = partnerNode.parent;
      if (partnerParent && !partnerParent.isNavigationNode && nodeMap.has(partnerParent.id)) {
        spouseNode.parent = partnerParent;
        spouseNode.isInvisibleLink = true;
        if (!partnerParent.children) partnerParent.children = [];
        if (!partnerParent.children.some(c => c.id === spouseId)) {
          partnerParent.children.push(spouseNode);
        }
        break;
      } else if (!partnerParent || partnerParent.isNavigationNode) {
        // Partner has no tree-parent — root spouse logic will handle both
        spouseNode.parent = partnerNode.parent;
        spouseNode.isInvisibleLink = true;
        break;
      }
    }
  }
}

// ── Pass 5: wrap root + its parentless spouses under a virtual node ───────────

function resolveRootSpouses(
  rootNode: TreeNode,
  rootPerson: Person,
  personMap: Map<string, Person>,
  nodeMap: Map<string, TreeNode>,
  rootPersonId: string
): TreeNode {
  let finalRoot = rootNode;

  const rootSpouseIds = rootPerson.relationships
    .filter(rel => rel.type === 'spouse')
    .map(rel => rel.personId);

  for (const spouseId of rootSpouseIds) {
    const spousePerson = personMap.get(spouseId);
    if (!spousePerson) continue;

    const spouseParentRel = spousePerson.relationships.find(r => r.type === 'parent');
    const spouseParentInTree = spouseParentRel ? nodeMap.has(spouseParentRel.personId) : false;

    if (!spouseParentRel || !spouseParentInTree) {
      let spouseNode = nodeMap.get(spouseId);

      if (!spouseNode) {
        const isReciprocal = spousePerson.relationships.some(
          r => r.type === 'spouse' && r.personId === rootPersonId
        );
        if (!isReciprocal) continue;

        spouseNode = {
          id: spousePerson.id,
          name: spousePerson.name,
          birthDate: spousePerson.birthDate,
          birthPlace: spousePerson.birthPlace,
          deathDate: spousePerson.deathDate,
          gender: spousePerson.gender,
          generation: 0,
          children: undefined,
          parent: null
        };
        nodeMap.set(spouseId, spouseNode);
      }

      if (!spouseNode.parent) {
        if (!finalRoot.parent || finalRoot.parent.isNavigationNode) {
          if (finalRoot.id === '__wrapper_root__') {
            if (!finalRoot.children!.some(c => c.id === spouseId)) {
              finalRoot.children!.push(spouseNode);
              spouseNode.parent = finalRoot;
            }
          } else {
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
  }

  return finalRoot;
}

// ── Pass 6: add ↑ Parent navigation node above root when parents exist ────────

function addParentNavNode(
  finalRoot: TreeNode,
  personMap: Map<string, Person>
): TreeNode {
  const actualRootNode = finalRoot.id === '__wrapper_root__' ? finalRoot.children![0] : finalRoot;
  const actualRootPerson = personMap.get(actualRootNode.id);

  if (actualRootPerson) {
    const hasParents = actualRootPerson.relationships.some(rel => rel.type === 'parent');
    if (hasParents) {
      const parentNavNode: TreeNode = {
        id: '__parent_nav__',
        name: '↑ Parent',
        isNavigationNode: true,
        generation: -1,
        children: [finalRoot],
        parent: null
      };
      finalRoot.parent = parentNavNode;
      return parentNavNode;
    }
  }

  return finalRoot;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildTreeData(
  familyTree: FamilyTree,
  rootPersonId: string,
  maxGenerations: number = 4
): TreeNode | null {
  if (!rootPersonId || familyTree.persons.length === 0) return null;

  const personMap = new Map<string, Person>();
  for (const person of familyTree.persons) {
    personMap.set(person.id, person);
  }

  const rootPerson = personMap.get(rootPersonId);
  if (!rootPerson) return null;

  const nodeMap = new Map<string, TreeNode>();
  const visited = new Set<string>();

  const rootNode = buildNode(rootPersonId, 0, null, personMap, nodeMap, visited, maxGenerations);
  if (!rootNode) return null;

  positionSpouses(rootNode, personMap, nodeMap);
  sortChildrenToGroupSpouses(rootNode, personMap);
  resolveOrphanSpouses(nodeMap, personMap);
  const withSpouses = resolveRootSpouses(rootNode, rootPerson, personMap, nodeMap, rootPersonId);
  return addParentNavNode(withSpouses, personMap);
}
