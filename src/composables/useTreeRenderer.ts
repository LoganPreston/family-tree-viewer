import { ref } from 'vue';
import * as d3 from 'd3';
import type { Ref } from 'vue';
import { buildTreeData } from '../utils/tree-layout';
import type { TreeNode } from '../utils/tree-layout';
import type { useFamilyTreeStore } from '../stores/family-tree-store';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 120;
const NODE_SPACING = 20;
const LEVEL_SPACING = 100;

function extractYearFromBirthdate(birthDate?: string): number | null {
  if (!birthDate) return null;
  const yearMatch = birthDate.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) return parseInt(yearMatch[0], 10);
  const anyYearMatch = birthDate.match(/\b\d{4}\b/);
  if (anyYearMatch) {
    const year = parseInt(anyYearMatch[0], 10);
    if (year >= 1000 && year <= 2100) return year;
  }
  return null;
}

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

  function drawLinks(rootNode: d3.HierarchyPointNode<TreeNode>) {
    if (!g) return;
    const allLinks = rootNode.links();
    const nodeMap = new Map<string, d3.HierarchyPointNode<TreeNode>>();
    rootNode.each((d) => nodeMap.set(d.data.id, d));

    const links: Array<{ source: d3.HierarchyPointNode<TreeNode>; target: d3.HierarchyPointNode<TreeNode> }> = [];
    for (const link of allLinks) {
      if (link.source.data.id === '__wrapper_root__' && link.target.data.id === '__wrapper_root__') continue;
      if (link.target.data.id === '__wrapper_root__') {
        const wrapperNode = link.target;
        if (wrapperNode.children?.length) {
          const actualRoot = wrapperNode.children.find((c: any) => c.data.id === store.currentRootPersonId);
          if (actualRoot) { links.push({ source: link.source, target: actualRoot }); continue; }
        }
      }
      if (link.source.data.id === '__wrapper_root__') continue;
      if (link.target.data.isInvisibleLink) continue;
      links.push({ source: link.source, target: link.target });
    }

    const linkEls = g.selectAll('.link')
      .data(links, (d: unknown) => {
        const l = d as typeof links[0];
        return `${l.source.data.id}-${l.target.data.id}`;
      });
    linkEls.exit().remove();
    const entered = linkEls.enter().append('path').attr('class', 'link').attr('fill', 'none').attr('stroke', '#ccc').attr('stroke-width', 2);
    linkEls.merge(entered as any)
      .attr('d', (d) => {
        const { x: sx, y: sy } = d.source;
        const { x: tx, y: ty } = d.target;
        if ([sx, sy, tx, ty].some(v => v === undefined || isNaN(v as number))) {
          console.warn('Link has invalid positions:', d.source.data.id, '->', d.target.data.id);
          return '';
        }
        return `M${sx},${sy! + NODE_HEIGHT / 2}L${tx},${ty! - NODE_HEIGHT / 2}`;
      })
      .attr('stroke', (d) => isLinkInPath(d.source.data.id, d.target.data.id) ? '#ff9800' : '#ccc')
      .attr('stroke-width', (d) => isLinkInPath(d.source.data.id, d.target.data.id) ? 4 : 2);
  }

  function drawSpouseLinks(rootNode: d3.HierarchyPointNode<TreeNode>) {
    if (!g) return;
    const nodeMap = new Map<string, d3.HierarchyPointNode<TreeNode>>();
    rootNode.each((d) => { if (!d.data.isNavigationNode) nodeMap.set(d.data.id, d); });

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
      .attr('stroke', '#999').attr('stroke-width', 2).attr('stroke-dasharray', '5,5').style('opacity', 0.6);
    spouseEls.merge(entered as any)
      .attr('d', (d) => {
        const { x: x1, y: y1 } = d.node1;
        const { x: x2, y: y2 } = d.node2;
        if ([x1, y1, x2, y2].some(v => v === undefined || isNaN(v as number))) {
          console.warn('Spouse link has invalid positions:', d.node1.data.id, '->', d.node2.data.id);
          return '';
        }
        return `M${x1},${y1}L${x2},${y2}`;
      })
      .attr('stroke', (d) => isLinkInPath(d.node1.data.id, d.node2.data.id) ? '#ff9800' : '#999')
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
        return d.data.id === store.selectedPersonId ? '#2196f3' : '#999';
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
        return node.id === store.selectedPersonId ? '#2196f3' : '#999';
      })
      .attr('stroke-width', (d: any) => {
        const node = d.data as TreeNode;
        if (node.isNavigationNode) return 2;
        return node.id === store.selectedPersonId ? 3 : 1;
      });
  }

  return { initializeTree, redrawHighlighting, updateSelectionHighlight, isEditorOpen, editingPersonId, closeEditor };
}
