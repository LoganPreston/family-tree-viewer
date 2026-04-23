import { ref } from 'vue';
import * as d3 from 'd3';
import type { Ref } from 'vue';
import { buildTreeData } from '../utils/tree-layout';
import type { TreeNode } from '../utils/tree-layout';
import type { useFamilyTreeStore } from '../stores/family-tree-store';
import { extractYearFromBirthdate } from '../utils/date-utils';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 120;
const NODE_SPACING = 20;
const LEVEL_SPACING = 100;
const COUPLE_DROP = 28; // px below node bottom for U-shaped spouse connector

function wrapText(text: string, maxWidth: number, fontSize = '11px', fontWeight = 'normal'): string[] {
  const size = parseFloat(fontSize) || 11;
  // Bold characters are ~0.65× font size wide; normal ~0.55×
  const charWidth = size * (fontWeight === 'bold' ? 0.65 : 0.55);
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [text];
}

type Store = ReturnType<typeof useFamilyTreeStore>;

export function useTreeRenderer(
  svgRef: Ref<SVGElement | null>,
  containerRef: Ref<HTMLElement | null>,
  store: Store
) {
  const isEditorOpen = ref(false);
  const editingPersonId = ref<string | null>(null);

  let svg: d3.Selection<SVGElement, unknown, null, undefined> | null = null;
  let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let zoom: d3.ZoomBehavior<SVGElement, unknown> | null = null;
  let root: d3.HierarchyPointNode<TreeNode> | null = null;

  function openEditor(personId: string) {
    editingPersonId.value = personId;
    isEditorOpen.value = true;
  }

  function closeEditor() {
    isEditorOpen.value = false;
    editingPersonId.value = null;
  }

  function isLinkInPath(sourceId: string, targetId: string): boolean {
    if (!store.connectionPath || store.connectionPath.length < 2) return false;
    for (let i = 0; i < store.connectionPath.length - 1; i++) {
      const s = store.connectionPath[i];
      const t = store.connectionPath[i + 1];
      if ((s === sourceId && t === targetId) || (s === targetId && t === sourceId)) return true;
    }
    return false;
  }

  function isNodeInPath(nodeId: string): boolean {
    return store.connectionPath ? store.connectionPath.includes(nodeId) : false;
  }

  // Returns a map of coupleId → dropY for every 2-parent couple visible in the tree.
  // When a person has multiple spouses, each couple gets a progressively deeper drop
  // (ranked left-to-right by midpoint x) so the U-shapes don't overlap.
  function buildCoupleDropMap(
    rootNode: d3.HierarchyPointNode<TreeNode>,
    nodeMap: Map<string, d3.HierarchyPointNode<TreeNode>>
  ): Map<string, number> {
    const coupleInfo = new Map<string, {
      p1: d3.HierarchyPointNode<TreeNode>;
      p2: d3.HierarchyPointNode<TreeNode>;
    }>();

    rootNode.each(child => {
      if (child.data.id === '__wrapper_root__' || child.data.isInvisibleLink ||
          child.data.isNavigationNode || !child.parent) return;
      if (isNaN(child.x) || isNaN(child.y)) return;
      const person = store.familyTree.persons.find(p => p.id === child.data.id);
      const vp = (person?.relationships ?? [])
        .filter(r => r.type === 'parent')
        .map(r => nodeMap.get(r.personId))
        .filter((n): n is d3.HierarchyPointNode<TreeNode> =>
          n !== undefined && !isNaN(n.x!) && !isNaN(n.y!));
      if (vp.length < 2) return;
      const cid = [vp[0].data.id, vp[1].data.id].sort().join('|');
      if (!coupleInfo.has(cid)) coupleInfo.set(cid, { p1: vp[0], p2: vp[1] });
    });

    // Also register childless spouse pairs so they get consistent rank/depth
    rootNode.each(d => {
      if (d.data.isNavigationNode || d.data.id === '__wrapper_root__') return;
      if (isNaN(d.x) || isNaN(d.y)) return;
      const person = store.familyTree.persons.find(p => p.id === d.data.id);
      for (const rel of person?.relationships ?? []) {
        if (rel.type !== 'spouse') continue;
        const spouseNode = nodeMap.get(rel.personId);
        if (!spouseNode || isNaN(spouseNode.x!) || isNaN(spouseNode.y!)) continue;
        const cid = [d.data.id, rel.personId].sort().join('|');
        if (!coupleInfo.has(cid)) coupleInfo.set(cid, { p1: d, p2: spouseNode });
      }
    });

    // Track which couples each person appears in
    const personCouples = new Map<string, string[]>();
    for (const [cid, info] of coupleInfo) {
      for (const pid of [info.p1.data.id, info.p2.data.id]) {
        if (!personCouples.has(pid)) personCouples.set(pid, []);
        personCouples.get(pid)!.push(cid);
      }
    }

    // For persons in multiple couples, sort by midpoint x and assign 1-based depth rank
    const rankMap = new Map<string, number>();
    for (const [, cids] of personCouples) {
      const unique = [...new Set(cids)];
      if (unique.length < 2) continue;
      unique.sort((a, b) => {
        const ca = coupleInfo.get(a)!;
        const cb = coupleInfo.get(b)!;
        return ((ca.p1.x! + ca.p2.x!) / 2) - ((cb.p1.x! + cb.p2.x!) / 2);
      });
      unique.forEach((cid, i) => {
        rankMap.set(cid, Math.max(rankMap.get(cid) ?? 1, i + 1));
      });
    }

    const dropMap = new Map<string, number>();
    for (const [cid, info] of coupleInfo) {
      const rank = rankMap.get(cid) ?? 1;
      const baseY = Math.max(info.p1.y!, info.p2.y!) + NODE_HEIGHT / 2;
      dropMap.set(cid, baseY + COUPLE_DROP * rank);
    }
    return dropMap;
  }

  function drawLinks(rootNode: d3.HierarchyPointNode<TreeNode>) {
    if (!g) return;

    // All real (non-virtual) visible nodes, keyed by person ID
    const nodeMap = new Map<string, d3.HierarchyPointNode<TreeNode>>();
    rootNode.each(d => {
      if (d.data.id !== '__wrapper_root__' && !d.data.isNavigationNode) {
        nodeMap.set(d.data.id, d);
      }
    });

    const coupleDropMap = buildCoupleDropMap(rootNode, nodeMap);

    interface LinkSpec {
      id: string;
      sx: number; sy: number;
      tx: number; ty: number;
      childId: string;
      parentIds: string[];
    }

    const linkSpecs: LinkSpec[] = [];

    rootNode.each(child => {
      if (child.data.id === '__wrapper_root__') return;
      if (child.data.isInvisibleLink) return;
      if (child.data.isNavigationNode) return;
      if (!child.parent) return; // D3 root — no link needed

      const tx = child.x, ty = child.y;
      if (tx === undefined || ty === undefined || isNaN(tx) || isNaN(ty)) return;

      // Biological parents visible in this render
      const person = store.familyTree.persons.find(p => p.id === child.data.id);
      const visibleParents = (person?.relationships ?? [])
        .filter(r => r.type === 'parent')
        .map(r => nodeMap.get(r.personId))
        .filter((n): n is d3.HierarchyPointNode<TreeNode> =>
          n !== undefined && !isNaN(n.x!) && !isNaN(n.y!));

      let sx: number, sy: number, parentIds: string[];

      if (visibleParents.length >= 2) {
        const [p1, p2] = visibleParents;
        sx = (p1.x! + p2.x!) / 2;
        const coupleId = [p1.data.id, p2.data.id].sort().join('|');
        sy = coupleDropMap.get(coupleId) ??
          (Math.max(p1.y!, p2.y!) + NODE_HEIGHT / 2 + COUPLE_DROP);
        parentIds = [p1.data.id, p2.data.id];

      } else if (visibleParents.length === 1) {
        sx = visibleParents[0].x!;
        sy = visibleParents[0].y! + NODE_HEIGHT / 2;
        parentIds = [visibleParents[0].data.id];
      } else {
        // No biological parents in view — fall back to D3 hierarchy parent (e.g. nav node above root)
        const p = child.parent;
        if (p.data.id === '__wrapper_root__' || isNaN(p.x!) || isNaN(p.y!)) return;
        sx = p.x!;
        sy = p.y! + NODE_HEIGHT / 2;
        parentIds = [p.data.id];
      }

      linkSpecs.push({
        id: `${[...parentIds].sort().join(',')}->${child.data.id}`,
        sx, sy,
        tx, ty: ty - NODE_HEIGHT / 2,
        childId: child.data.id,
        parentIds
      });
    });

    // Parent-child lines
    const linkEls = g.selectAll('.link')
      .data(linkSpecs, (d: unknown) => (d as LinkSpec).id);
    linkEls.exit().remove();
    const lEnter = linkEls.enter().append('path').attr('class', 'link')
      .attr('fill', 'none').attr('stroke', '#777').attr('stroke-width', 2);
    linkEls.merge(lEnter as any)
      .attr('d', d => {
        const midY = (d.sy + d.ty) / 2;
        return `M${d.sx},${d.sy} V${midY} H${d.tx} V${d.ty}`;
      })
      .attr('stroke', d => d.parentIds.some(pid => isLinkInPath(pid, d.childId)) ? '#ff9800' : '#777')
      .attr('stroke-width', d => d.parentIds.some(pid => isLinkInPath(pid, d.childId)) ? 4 : 2);

    // Remove any stale junction dots from previous renders
    g.selectAll('.couple-junction').remove();
  }

  function drawSpouseLinks(rootNode: d3.HierarchyPointNode<TreeNode>) {
    if (!g) return;
    const nodeMap = new Map<string, d3.HierarchyPointNode<TreeNode>>();
    rootNode.each((d) => { if (!d.data.isNavigationNode) nodeMap.set(d.data.id, d); });
    const coupleDropMap = buildCoupleDropMap(rootNode, nodeMap);

    const spousePairs: Array<{ node1: d3.HierarchyPointNode<TreeNode>; node2: d3.HierarchyPointNode<TreeNode> }> = [];
    rootNode.each((d) => {
      if (d.data.isNavigationNode) return;
      const person = store.familyTree.persons.find(p => p.id === d.data.id);
      if (!person) return;
      for (const rel of person.relationships) {
        if (rel.type !== 'spouse') continue;
        const spouseNode = nodeMap.get(rel.personId);
        if (!spouseNode || spouseNode === d) continue;
        const key = [d.data.id, rel.personId].sort().join('|');
        if (!spousePairs.some(p => [p.node1.data.id, p.node2.data.id].sort().join('|') === key)) {
          spousePairs.push({ node1: d, node2: spouseNode });
        }
      }
    });

    const spouseEls = g.selectAll('.spouse-link')
      .data(spousePairs, (d: unknown) => {
        const p = d as typeof spousePairs[0];
        return `spouse-${[p.node1.data.id, p.node2.data.id].sort().join('-')}`;
      });
    spouseEls.exit().remove();
    const entered = spouseEls.enter().append('path').attr('class', 'spouse-link').attr('fill', 'none')
      .attr('stroke', '#7a6e8a').attr('stroke-width', 1).attr('stroke-dasharray', '8,4')
      .attr('stroke-linecap', 'round').style('opacity', 1);
    spouseEls.merge(entered as any)
      .attr('d', (d) => {
        const { x: x1, y: y1 } = d.node1;
        const { x: x2, y: y2 } = d.node2;
        if ([x1, y1, x2, y2].some(v => v === undefined || isNaN(v as number))) {
          console.warn('Spouse link has invalid positions:', d.node1.data.id, '->', d.node2.data.id);
          return '';
        }
        const [left, right] = x1! <= x2! ? [d.node1, d.node2] : [d.node2, d.node1];
        const coupleId = [d.node1.data.id, d.node2.data.id].sort().join('|');
        const dropY = coupleDropMap.get(coupleId) ??
          (Math.max(left.y!, right.y!) + NODE_HEIGHT / 2 + COUPLE_DROP);
        return `M${left.x!},${left.y! + NODE_HEIGHT / 2} V${dropY} H${right.x!} V${right.y! + NODE_HEIGHT / 2}`;
      })
      .attr('stroke', (d) => isLinkInPath(d.node1.data.id, d.node2.data.id) ? '#ff9800' : '#7a6e8a')
      .attr('stroke-width', (d) => isLinkInPath(d.node1.data.id, d.node2.data.id) ? 4 : 2);
  }

  function drawNodes(rootNode: d3.HierarchyPointNode<TreeNode>) {
    if (!g) return;
    const nodes = rootNode.descendants().filter(d => d.data.id !== '__wrapper_root__');

    const nodeGroup = g.selectAll('.node-group')
      .data(nodes, (d: unknown) => (d as d3.HierarchyPointNode<TreeNode>).data.id);
    nodeGroup.exit().remove();

    const entered = nodeGroup.enter().append('g').attr('class', 'node-group').style('cursor', 'pointer');
    entered.append('rect').attr('class', 'node').attr('width', NODE_WIDTH).attr('height', NODE_HEIGHT)
      .attr('x', -NODE_WIDTH / 2).attr('y', -NODE_HEIGHT / 2);
    entered.append('text').attr('class', 'node-name').attr('x', 0).attr('y', -NODE_HEIGHT / 2 + 25)
      .attr('text-anchor', 'middle').attr('font-size', '14px').attr('font-weight', 'bold');
    entered.append('text').attr('class', 'node-birth').attr('x', 0).attr('text-anchor', 'middle')
      .attr('font-size', '11px').attr('fill', '#666');
    entered.append('text').attr('class', 'node-death').attr('x', 0).attr('text-anchor', 'middle')
      .attr('font-size', '11px').attr('fill', '#666');

    const merged = nodeGroup.merge(entered as any);

    merged.select('.node')
      .attr('fill', (d) => {
        if (d.data.isNavigationNode) return '#fff3cd';
        const inPath = isNodeInPath(d.data.id);
        const gender = d.data.gender;
        if (inPath) return gender === 'M' ? '#cfe2ff' : gender === 'F' ? '#f8d7e6' : '#fff4e6';
        return gender === 'M' ? '#e3f2fd' : gender === 'F' ? '#fce4ec' : '#f5f5f5';
      })
      .attr('stroke', (d) => {
        if (d.data.isNavigationNode) return '#ff9800';
        if (isNodeInPath(d.data.id)) return '#ff9800';
        return d.data.id === store.selectedPersonId ? '#2196f3' : '#777';
      })
      .attr('stroke-width', (d) => {
        if (d.data.isNavigationNode) return 2;
        if (isNodeInPath(d.data.id)) return 4;
        return d.data.id === store.selectedPersonId ? 3 : 1;
      })
      .attr('rx', (d) => {
        if (d.data.isNavigationNode) return 8;
        if (d.data.gender === 'M') return 4;
        if (d.data.gender === 'F') return NODE_HEIGHT / 2; // pill / oval
        return 12;
      })
      .on('click', (event: MouseEvent, d) => { event.stopPropagation(); handleNodeClick(d); })
      .on('dblclick', (event: MouseEvent, d) => {
        event.stopPropagation();
        if (!d.data.isNavigationNode) { store.setSelectedPerson(d.data.id); openEditor(d.data.id); }
      });

    merged.select('.node-name').each(function(d: any) {
      const el = d3.select(this);
      el.selectAll('tspan').remove();
      const lines = wrapText(d.data.name, NODE_WIDTH - 20, '14px', 'bold');
      lines.forEach((line, i) => el.append('tspan').attr('x', 0).attr('dy', i === 0 ? '0' : '1.2em').text(line));
      d.nameLineCount = lines.length;
    });

    merged.select('.node-birth').each(function(d: any) {
      const el = d3.select(this);
      el.selectAll('tspan').remove();
      if (d.data.isNavigationNode) { el.text(''); return; }
      const parts: string[] = [];
      if (d.data.birthDate) parts.push(`b. ${d.data.birthDate}`);
      if (d.data.birthPlace) parts.push(...wrapText(d.data.birthPlace, NODE_WIDTH - 20, '11px'));
      if (!parts.length) { el.text(''); return; }
      const nameHeight = (d.nameLineCount || 1) === 1 ? 14 : 14 + (d.nameLineCount - 1) * 14 * 1.2;
      el.attr('y', -NODE_HEIGHT / 2 + 25 + nameHeight + 8);
      d.birthLineCount = parts.length;
      parts.forEach((p, i) => el.append('tspan').attr('x', 0).attr('dy', i === 0 ? '0' : '1.2em').text(p));
    });

    merged.select('.node-death').each(function(d: any) {
      const el = d3.select(this);
      if (d.data.isNavigationNode || !d.data.deathDate) { el.text(''); return; }
      const nameHeight = (d.nameLineCount || 1) === 1 ? 14 : 14 + (d.nameLineCount - 1) * 14 * 1.2;
      const birthLineCount = d.birthLineCount || 0;
      const birthHeight = birthLineCount === 0 ? 0 : (birthLineCount === 1 ? 11 : 11 + (birthLineCount - 1) * 11 * 1.2);
      el.attr('y', -NODE_HEIGHT / 2 + 25 + nameHeight + 8 + birthHeight + 8);
      el.text(`d. ${d.data.deathDate}`);
    });

    merged.attr('transform', (d) => {
      const { x, y } = d;
      if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
        console.warn('Node has invalid position:', d.data.id, { x, y });
        return 'translate(0,0)';
      }
      return `translate(${x},${y})`;
    });
  }

  function handleNodeClick(d: d3.HierarchyPointNode<TreeNode>) {
    if (d.data.isNavigationNode) {
      const currentRoot = store.familyTree.persons.find(p => p.id === store.currentRootPersonId);
      const parentRel = currentRoot?.relationships.find(r => r.type === 'parent');
      if (parentRel) { store.setCurrentRoot(parentRel.personId); initializeTree(); }
    } else if (d.data.id !== store.currentRootPersonId) {
      store.setCurrentRoot(d.data.id);
      initializeTree();
    } else {
      store.setSelectedPerson(d.data.id);
    }
  }

  function initializeTree() {
    if (!svgRef.value || !containerRef.value) return;
    if (!store.familyTree.persons.length || !store.currentRootPersonId) return;

    d3.select(svgRef.value).selectAll('*').remove();
    svg = d3.select(svgRef.value);

    const width = containerRef.value.clientWidth || 800;
    const height = containerRef.value.clientHeight || 600;
    svg.attr('width', width).attr('height', height);
    g = svg.append('g');

    try {
      zoom = d3.zoom<SVGElement, unknown>().scaleExtent([0.1, 3]).on('zoom', (event) => {
        g?.attr('transform', event.transform);
        store.setZoom(event.transform.k);
        store.setPan(event.transform.x, event.transform.y);
      });
      svg.call(zoom);
    } catch (e) {
      console.warn('Failed to set up zoom behavior:', e);
      zoom = null;
    }

    if (zoom) {
      try {
        svg.call(zoom.transform, d3.zoomIdentity.translate(store.panX, store.panY).scale(store.zoom));
      } catch (e) {
        console.warn('Failed to apply initial zoom transform:', e);
      }
    }

    const treeData = buildTreeData(store.familyTree, store.currentRootPersonId, store.maxGenerations);
    if (!treeData) return;

    const allYears: number[] = [];
    const collectYears = (node: TreeNode) => {
      const year = extractYearFromBirthdate(node.birthDate);
      if (year !== null) allYears.push(year);
      node.children?.forEach(collectYears);
    };
    collectYears(treeData);

    const treeLayout = d3.tree<TreeNode>()
      .nodeSize([NODE_WIDTH + NODE_SPACING, NODE_HEIGHT + LEVEL_SPACING])
      .separation((a, b) => {
        if (a.parent !== b.parent) return 1.5;
        if (a.data.id === '__parent_nav__' || b.data.id === '__parent_nav__') return 0.1;
        // Extra gap between children from different couple origins
        if (a.data.coupleId && b.data.coupleId && a.data.coupleId !== b.data.coupleId) return 2.5;
        const ap = store.familyTree.persons.find(p => p.id === a.data.id);
        const bp = store.familyTree.persons.find(p => p.id === b.data.id);
        if (ap && bp) {
          const areSpouses = ap.relationships.some(r => r.type === 'spouse' && r.personId === b.data.id)
            || bp.relationships.some(r => r.type === 'spouse' && r.personId === a.data.id);
          if (areSpouses) return 1.5;
        }
        const aYear = extractYearFromBirthdate(a.data.birthDate);
        const bYear = extractYearFromBirthdate(b.data.birthDate);
        if (aYear !== null && bYear !== null && allYears.length) {
          const min = Math.min(...allYears);
          const max = Math.max(...allYears);
          if (max !== min) return 1.5 + (Math.abs(aYear - bYear) / (max - min));
        }
        return 1.5;
      });

    const hierarchyRoot = d3.hierarchy(treeData, (d: TreeNode) => d.children);
    root = treeLayout(hierarchyRoot);

    root.each((d) => {
      if (isNaN(d.x) || d.x === undefined) { console.warn('Node has invalid x position:', d.data.id); d.x = 0; }
      if (isNaN(d.y) || d.y === undefined) { console.warn('Node has invalid y position:', d.data.id); d.y = 0; }
    });

    root.each((d) => {
      if (d.data.isNavigationNode && d.children?.length) {
        const firstChild = d.children[0];
        if (!isNaN(firstChild.x) && !isNaN(firstChild.y) && !isNaN(d.x) && !isNaN(d.y)) {
          d.y = firstChild.y - (firstChild.y - d.y) * 0.3;
        }
      }
    });

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    root.each((d) => {
      if (!isNaN(d.x) && !isNaN(d.y)) {
        if (d.x < x0) x0 = d.x;
        if (d.x > x1) x1 = d.x;
        if (d.y < y0) y0 = d.y;
        if (d.y > y1) y1 = d.y;
      }
    });
    if (!isFinite(x0)) { x0 = 0; x1 = NODE_WIDTH; y0 = 0; y1 = NODE_HEIGHT; }

    let rootPersonNode: d3.HierarchyPointNode<TreeNode> | null = null;
    root.each((d) => { if (d.data.id === store.currentRootPersonId && !d.data.isNavigationNode) rootPersonNode = d; });
    if (!rootPersonNode && root.data.id === '__wrapper_root__' && root.children) {
      rootPersonNode = (root.children as d3.HierarchyPointNode<TreeNode>[]).find(c => c.data.id === store.currentRootPersonId) ?? null;
    }
    if (!rootPersonNode && root.data.id !== '__wrapper_root__') rootPersonNode = root;

    if (rootPersonNode && !isNaN(rootPersonNode.x) && !isNaN(rootPersonNode.y) && svg && zoom) {
      const scale = store.zoom;
      const tx = width / 2 - rootPersonNode.x * scale;
      const ty = height / 2 - rootPersonNode.y * scale;
      try {
        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        store.setPan(tx, ty);
      } catch (e) {
        console.warn('Failed to center root person:', e);
      }
    } else {
      const dx = x1 - x0 + NODE_WIDTH + NODE_SPACING * 2;
      const tx = (width - dx) / 2 - x0;
      if (svg && zoom) {
        try {
          svg.call(zoom.transform, d3.zoomIdentity.translate(tx, NODE_SPACING).scale(store.zoom));
          store.setPan(tx, NODE_SPACING);
        } catch (e) {
          g?.attr('transform', `translate(${tx},${NODE_SPACING})`);
        }
      } else if (g) {
        g.attr('transform', `translate(${tx},${NODE_SPACING})`);
      }
    }

    drawLinks(root);
    drawSpouseLinks(root);
    drawNodes(root);
  }

  function redrawHighlighting() {
    if (!root) return;
    drawLinks(root);
    drawSpouseLinks(root);
    drawNodes(root);
  }

  function updateSelectionHighlight() {
    if (!g || !root) return;
    g.selectAll('.node')
      .attr('stroke', (d: any) => {
        const node = d.data as TreeNode;
        if (node.isNavigationNode) return '#ff9800';
        return node.id === store.selectedPersonId ? '#2196f3' : '#777';
      })
      .attr('stroke-width', (d: any) => {
        const node = d.data as TreeNode;
        if (node.isNavigationNode) return 2;
        return node.id === store.selectedPersonId ? 3 : 1;
      });
  }

  return { initializeTree, redrawHighlighting, updateSelectionHighlight, isEditorOpen, editingPersonId, closeEditor };
}
