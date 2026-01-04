<template>
  <div class="tree-viewer" ref="containerRef">
    <svg ref="svgRef" class="tree-svg"></svg>
    <div v-if="!hasData" class="empty-state">
      <p>No family tree data loaded. Upload a GEDCOM or JSON file to get started.</p>
    </div>
    <PersonEditor 
      :is-open="isEditorOpen" 
      :person-id="editingPersonId" 
      @close="closeEditor" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import * as d3 from 'd3';
import { useFamilyTreeStore } from '../stores/family-tree-store';
import { buildTreeData } from '../utils/tree-layout';
import type { TreeNode } from '../utils/tree-layout';
import PersonEditor from './PersonEditor.vue';

const store = useFamilyTreeStore();
const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGElement | null>(null);
const isEditorOpen = ref(false);
const editingPersonId = ref<string | null>(null);

const hasData = computed(() => store.familyTree.persons.length > 0);

// Helper function to check if a link is part of the connection path
function isLinkInPath(sourceId: string, targetId: string): boolean {
  if (!store.connectionPath || store.connectionPath.length < 2) return false;
  
  for (let i = 0; i < store.connectionPath.length - 1; i++) {
    const pathSource = store.connectionPath[i];
    const pathTarget = store.connectionPath[i + 1];
    if ((pathSource === sourceId && pathTarget === targetId) ||
        (pathSource === targetId && pathTarget === sourceId)) {
      return true;
    }
  }
  return false;
}

// Helper function to check if a node is part of the connection path
function isNodeInPath(nodeId: string): boolean {
  return store.connectionPath ? store.connectionPath.includes(nodeId) : false;
}

function openEditor(personId: string) {
  editingPersonId.value = personId;
  isEditorOpen.value = true;
}

function closeEditor() {
  isEditorOpen.value = false;
  editingPersonId.value = null;
}

let svg: d3.Selection<SVGElement, unknown, null, undefined> | null = null;
let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
let zoom: d3.ZoomBehavior<SVGElement, unknown> | null = null;
let treeLayout: d3.TreeLayout<TreeNode> | null = null;
let root: d3.HierarchyPointNode<TreeNode> | null = null;

const nodeWidth = 180;
const nodeHeight = 100;
const nodeSpacing = 20;
const levelSpacing = 100; // Additional vertical spacing between tree levels

// Helper function to parse birthdate and extract year
function extractYearFromBirthdate(birthDate?: string): number | null {
  if (!birthDate) return null;
  
  // Try to extract year from various formats:
  // "1 JAN 1930" -> 1930
  // "1930" -> 1930
  // "1930-01-01" -> 1930
  // "January 1, 1930" -> 1930
  
  // First, try to find a 4-digit year (1900-2100 range)
  const yearMatch = birthDate.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0], 10);
  }
  
  // If no 4-digit year found, try any 4-digit number
  const anyYearMatch = birthDate.match(/\b\d{4}\b/);
  if (anyYearMatch) {
    const year = parseInt(anyYearMatch[0], 10);
    // Reasonable year range for family trees
    if (year >= 1000 && year <= 2100) {
      return year;
    }
  }
  
  return null;
}

function initializeTree() {
  console.log('initializeTree called', { 
    hasSvgRef: !!svgRef.value, 
    hasContainerRef: !!containerRef.value,
    hasData: hasData.value,
    personsCount: store.familyTree.persons.length,
    currentRoot: store.currentRootPersonId,
    maxGenerations: store.maxGenerations
  });
  
  if (!svgRef.value || !hasData.value || !store.currentRootPersonId) {
    console.log('initializeTree: early return - missing refs, data, or root');
    return;
  }
  
  // Clear existing content
  d3.select(svgRef.value).selectAll('*').remove();
  
  svg = d3.select(svgRef.value);
  
  if (!containerRef.value) {
    console.log('initializeTree: no containerRef');
    return;
  }
  const width = containerRef.value.clientWidth || 800;
  const height = containerRef.value.clientHeight || 600;
  
  console.log('initializeTree: container size', { width, height });
  
  svg.attr('width', width).attr('height', height);
  
  g = svg.append('g');
  
  // Set up zoom behavior
  zoom = d3.zoom<SVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      if (g) {
        g.attr('transform', event.transform);
      }
      store.setZoom(event.transform.k);
      store.setPan(event.transform.x, event.transform.y);
    });
  
  svg.call(zoom);
  
  // Apply initial zoom/pan
  const initialTransform = d3.zoomIdentity
    .translate(store.panX, store.panY)
    .scale(store.zoom);
  svg.call(zoom.transform, initialTransform);
  
  // Build tree data with generation limiting
  const treeData = buildTreeData(store.familyTree, store.currentRootPersonId, store.maxGenerations);
  console.log('initializeTree: treeData', treeData);
  
  if (!treeData) {
    console.log('initializeTree: no treeData returned');
    return;
  }
  
  // Calculate birthdate-based separation for tree layout
  const allYears: number[] = [];
  const collectYears = (node: TreeNode) => {
    const year = extractYearFromBirthdate(node.birthDate);
    if (year !== null) {
      allYears.push(year);
    }
    if (node.children) {
      node.children.forEach(child => collectYears(child));
    }
  };
  collectYears(treeData);
  
  // Set up tree layout with birthdate-based separation
  // Use fixed nodeSize - we'll adjust navigation node positions after layout
  const baseNodeSize: [number, number] = [nodeWidth + nodeSpacing, nodeHeight + levelSpacing];
  treeLayout = d3.tree<TreeNode>()
    .nodeSize(baseNodeSize)
    .separation((a, b) => {
      // If nodes are siblings, check if they're spouses
      if (a.parent === b.parent) {
        // Special handling for parent navigation node - keep it close to its child (the root)
        if (a.data.id === '__parent_nav__' || b.data.id === '__parent_nav__') {
          return 0.1; // Very close separation for parent nav node
        }
        
        const aPerson = store.familyTree.persons.find(p => p.id === a.data.id);
        const bPerson = store.familyTree.persons.find(p => p.id === b.data.id);
        
        if (aPerson && bPerson) {
          // Check if they're spouses
          const areSpouses = aPerson.relationships.some(r => 
            r.type === 'spouse' && r.personId === b.data.id
          ) || bPerson.relationships.some(r => 
            r.type === 'spouse' && r.personId === a.data.id
          );
          
          if (areSpouses) {
            // Spouses should be positioned next to each other
            // Use smaller separation to keep them close
            return 1.5;
          }
        }
        // Regular siblings - use birthdate-based separation
        const aYear = extractYearFromBirthdate(a.data.birthDate);
        const bYear = extractYearFromBirthdate(b.data.birthDate);
        if (aYear !== null && bYear !== null && allYears.length > 0) {
          const minYear = Math.min(...allYears);
          const maxYear = Math.max(...allYears);
          if (maxYear !== minYear) {
            // More separation for larger age differences
            const ageDiff = Math.abs(aYear - bYear);
            const normalizedDiff = ageDiff / (maxYear - minYear);
            return 1.5 + normalizedDiff * 1.0; // 1.5 to 2.5
          }
        }
        return 1.5; // Default separation for siblings
      }
      // Different parents
      return 1.5;
    });
  
  // Handle wrapper root - if treeData is a wrapper, we need to find the actual root
  let actualTreeData = treeData;
  if (treeData.id === '__wrapper_root__' && treeData.children && treeData.children.length > 0) {
    // Use the first child as the actual root for hierarchy
    // But keep the wrapper for layout purposes
    actualTreeData = treeData;
  }
  
  const hierarchyRoot = d3.hierarchy(actualTreeData, (d: TreeNode) => d.children);
  if (!treeLayout) return;
  root = treeLayout(hierarchyRoot);
  if (!root) return;
  
  // Validate and fix any NaN positions
  root.each((d) => {
    if (d.x === undefined || d.x === null || isNaN(d.x)) {
      console.warn('Node has invalid x position:', d.data.id, d.data.name);
      d.x = 0;
    }
    if (d.y === undefined || d.y === null || isNaN(d.y)) {
      console.warn('Node has invalid y position:', d.data.id, d.data.name);
      d.y = 0;
    }
  });
  
  // Post-process: adjust positions for navigation nodes to bring them closer to their children
  root.each((d) => {
    if (d.data.isNavigationNode && d.children && d.children.length > 0) {
      // Move navigation node closer to its first child
      const firstChild = d.children[0];
      if (firstChild.x !== undefined && firstChild.y !== undefined && 
          !isNaN(firstChild.x) && !isNaN(firstChild.y) &&
          d.x !== undefined && d.y !== undefined &&
          !isNaN(d.x) && !isNaN(d.y)) {
        // Keep same x, but move y closer to child (reduce vertical distance by 70%)
        const distance = firstChild.y - d.y;
        d.y = firstChild.y - (distance * 0.3);
      }
    }
  });
  
  console.log('initializeTree: root after layout', root);
  
  // Calculate bounds (excluding nodes with invalid positions)
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  
  root.each((d) => {
    const x = d.x;
    const y = d.y;
    if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  });
  
  // If no valid bounds found, use defaults
  if (!isFinite(x0) || !isFinite(x1) || !isFinite(y0) || !isFinite(y1)) {
    console.warn('No valid bounds found, using defaults');
    x0 = 0;
    x1 = nodeWidth;
    y0 = 0;
    y1 = nodeHeight;
  }
  
  console.log('initializeTree: bounds', { x0, x1, y0, y1 });
  
  // Find the root person node to center it on screen
  let rootPersonNode: d3.HierarchyPointNode<TreeNode> | null = null;
  root.each((d) => {
    if (d.data.id === store.currentRootPersonId && !d.data.isNavigationNode) {
      rootPersonNode = d;
    }
  });
  
  // If root person is in a wrapper root, find it in the children
  if (!rootPersonNode && root.data.id === '__wrapper_root__' && root.children) {
    rootPersonNode = root.children.find((child: any) => 
      child.data.id === store.currentRootPersonId
    ) || null;
  }
  
  // If still not found, use the root itself (if it's not a wrapper)
  if (!rootPersonNode && root.data.id !== '__wrapper_root__') {
    rootPersonNode = root;
  }
  
  // Center the root person on screen
  if (rootPersonNode && rootPersonNode.x !== undefined && rootPersonNode.y !== undefined &&
      !isNaN(rootPersonNode.x) && !isNaN(rootPersonNode.y) && svg && zoom) {
    const rootX = rootPersonNode.x;
    const rootY = rootPersonNode.y;
    
    // Calculate center of viewport
    const viewportCenterX = width / 2;
    const viewportCenterY = height / 2;
    
    // Calculate transform to center root person
    // We want: viewportCenterX = rootX * scale + translateX
    // So: translateX = viewportCenterX - rootX * scale
    const scale = store.zoom;
    const translateX = viewportCenterX - rootX * scale;
    const translateY = viewportCenterY - rootY * scale;
    
    console.log('initializeTree: centering root person', { 
      rootX, rootY, viewportCenterX, viewportCenterY, translateX, translateY, scale 
    });
    
    // Apply transform using D3 zoom
    const centerTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);
    svg.call(zoom.transform, centerTransform);
    
    // Update store with new pan values
    store.setPan(translateX, translateY);
  } else {
    // Fallback: center the tree as before
    const dx = x1 - x0 + nodeWidth + nodeSpacing * 2;
    const dy = y1 - y0 + nodeHeight + levelSpacing * 2;
    
    const translateX = (width - dx) / 2 - x0;
    const translateY = nodeSpacing;
    
    console.log('initializeTree: transform (fallback)', { translateX, translateY, dx, dy });
    
    // Apply transform using D3 zoom if available
    if (svg && zoom) {
      const fallbackTransform = d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(store.zoom);
      svg.call(zoom.transform, fallbackTransform);
      store.setPan(translateX, translateY);
    } else if (g) {
      g.attr('transform', `translate(${translateX},${translateY})`);
    }
  }
  
  // Draw links
  console.log('initializeTree: drawing links');
  if (root) {
    drawLinks(root);
    
    // Draw spouse connections (before nodes so nodes appear on top)
    console.log('initializeTree: drawing spouse links');
    drawSpouseLinks(root);
    
    // Draw nodes (after links so nodes appear on top)
    console.log('initializeTree: drawing nodes');
    drawNodes(root);
  }
  
  console.log('initializeTree: complete');
}

function drawLinks(rootNode: d3.HierarchyPointNode<TreeNode>) {
  if (!g) return;
  
  // Draw links between parent and child nodes
  // We need to handle links to wrapper root specially - draw to actual root person instead
  const allLinks = rootNode.links();
  
  // Build a map to find actual root person when we have a wrapper root
  const nodeMap = new Map<string, d3.HierarchyPointNode<TreeNode>>();
  rootNode.each((d) => {
    nodeMap.set(d.data.id, d);
  });
  
  // Process links and handle wrapper root cases
  const links: Array<{ source: d3.HierarchyPointNode<TreeNode>, target: d3.HierarchyPointNode<TreeNode> }> = [];
  
  for (const link of allLinks) {
    // Skip links where both source and target are wrapper root
    if (link.source.data.id === '__wrapper_root__' && link.target.data.id === '__wrapper_root__') {
      continue;
    }
    
    // If link goes to wrapper root, find the actual root person to connect to
    if (link.target.data.id === '__wrapper_root__') {
      const wrapperNode = link.target;
      if (wrapperNode.children && wrapperNode.children.length > 0) {
        // Find the actual root person (the one that matches currentRootPersonId)
        const actualRoot = wrapperNode.children.find((child: any) => 
          child.data.id === store.currentRootPersonId
        );
        if (actualRoot) {
          links.push({ source: link.source, target: actualRoot });
          continue;
        }
      }
    }
    
    // If link comes from wrapper root, skip it (we'll draw children links separately)
    if (link.source.data.id === '__wrapper_root__') {
      continue;
    }
    
    // Skip invisible links (e.g., links from parent to child's spouse)
    if (link.target.data.isInvisibleLink) {
      continue;
    }
    
    // Regular link
    links.push({ source: link.source, target: link.target });
  }
  
  const linkElements = g.selectAll('.link')
    .data(links, (d: unknown) => {
      const link = d as { source: d3.HierarchyPointNode<TreeNode>; target: d3.HierarchyPointNode<TreeNode> };
      return `${link.source.data.id}-${link.target.data.id}`;
    });
  
  linkElements.exit().remove();
  
  const linkEnter = linkElements.enter()
    .append('path')
    .attr('class', 'link')
    .attr('fill', 'none')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 2);
  
  linkElements.merge(linkEnter as any)
    .attr('d', (d) => {
      const sx = d.source.x;
      const sy = d.source.y;
      const tx = d.target.x;
      const ty = d.target.y;
      
      if (sx === undefined || sy === undefined || tx === undefined || ty === undefined ||
          isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) {
        console.warn('Link has invalid positions:', d.source.data.id, '->', d.target.data.id);
        return '';
      }
      // Draw from bottom of parent to top of child
      return `M${sx},${sy + nodeHeight / 2}L${tx},${ty - nodeHeight / 2}`;
    })
    .attr('stroke', (d) => {
      const sourceId = d.source.data.id;
      const targetId = d.target.data.id;
      return isLinkInPath(sourceId, targetId) ? '#ff9800' : '#ccc';
    })
    .attr('stroke-width', (d) => {
      const sourceId = d.source.data.id;
      const targetId = d.target.data.id;
      return isLinkInPath(sourceId, targetId) ? 4 : 2;
    });
}

function drawSpouseLinks(rootNode: d3.HierarchyPointNode<TreeNode>) {
  if (!g) return;
  
  // Find all spouse pairs in the tree
  const spousePairs: Array<{ node1: d3.HierarchyPointNode<TreeNode>, node2: d3.HierarchyPointNode<TreeNode> }> = [];
  
  // Build a map of hierarchy nodes by person ID
  // Include all nodes except navigation nodes (spouses should be included)
  const nodeMap = new Map<string, d3.HierarchyPointNode<TreeNode>>();
  rootNode.each((d) => {
    if (!d.data.isNavigationNode) {
      nodeMap.set(d.data.id, d);
    }
  });
  
  // Find spouse relationships
  rootNode.each((d) => {
    if (d.data.isNavigationNode) return;
    
    const person = store.familyTree.persons.find(p => p.id === d.data.id);
    if (!person) return;
    
    person.relationships.forEach(rel => {
      if (rel.type === 'spouse') {
        const spouseNode = nodeMap.get(rel.personId);
        if (spouseNode && spouseNode !== d) {
          // Check if we've already added this pair
          const pairKey = [d.data.id, rel.personId].sort().join('|');
          const alreadyAdded = spousePairs.some(pair => {
            const pairKey2 = [pair.node1.data.id, pair.node2.data.id].sort().join('|');
            return pairKey === pairKey2;
          });
          
          if (!alreadyAdded) {
            spousePairs.push({ node1: d, node2: spouseNode });
          }
        }
      }
    });
  });
  
  // Draw spouse links
  const spouseLinkElements = g.selectAll('.spouse-link')
    .data(spousePairs, (d: unknown) => {
      const pair = d as { node1: d3.HierarchyPointNode<TreeNode>; node2: d3.HierarchyPointNode<TreeNode> };
      const ids = [pair.node1.data.id, pair.node2.data.id].sort();
      return `spouse-${ids[0]}-${ids[1]}`;
    });
  
  spouseLinkElements.exit().remove();
  
  const spouseLinkEnter = spouseLinkElements.enter()
    .append('path')
    .attr('class', 'spouse-link')
    .attr('fill', 'none')
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5')
    .style('opacity', 0.6);
  
  spouseLinkElements.merge(spouseLinkEnter as any)
    .attr('d', (d) => {
      const x1 = d.node1.x;
      const y1 = d.node1.y;
      const x2 = d.node2.x;
      const y2 = d.node2.y;
      
      if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined ||
          isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
        console.warn('Spouse link has invalid positions:', d.node1.data.id, '->', d.node2.data.id);
        return '';
      }
      // Draw horizontal line between spouses at middle height
      return `M${x1},${y1}L${x2},${y2}`;
    })
    .attr('stroke', (d) => {
      const node1Id = d.node1.data.id;
      const node2Id = d.node2.data.id;
      return isLinkInPath(node1Id, node2Id) ? '#ff9800' : '#999';
    })
    .attr('stroke-width', (d) => {
      const node1Id = d.node1.data.id;
      const node2Id = d.node2.data.id;
      return isLinkInPath(node1Id, node2Id) ? 4 : 2;
    });
}


function drawNodes(rootNode: d3.HierarchyPointNode<TreeNode>) {
  if (!g) return;
  
  const nodes = rootNode.descendants().filter(d => {
    // Don't render wrapper root nodes (they're structural), but DO render parent navigation nodes
    return d.data.id !== '__wrapper_root__';
  });
  
  const nodeGroup = g.selectAll('.node-group')
    .data(nodes, (d: unknown) => {
      const node = d as d3.HierarchyPointNode<TreeNode>;
      return node.data.id;
    });
  
  nodeGroup.exit().remove();
  
  const nodeGroupEnter = nodeGroup.enter()
    .append('g')
    .attr('class', 'node-group')
    .style('cursor', 'pointer');
  
  // Draw node rectangle
  nodeGroupEnter.append('rect')
    .attr('class', 'node')
    .attr('width', nodeWidth)
    .attr('height', nodeHeight)
    .attr('rx', 8)
    .attr('x', -nodeWidth / 2)
    .attr('y', -nodeHeight / 2);
  
  nodeGroupEnter.merge(nodeGroup as any)
    .select('.node')
    .attr('fill', (d) => {
      if (d.data.isNavigationNode) return '#fff3cd'; // Yellow for navigation node
      const inPath = isNodeInPath(d.data.id);
      if (inPath) {
        // Slightly lighter background for path nodes
        const gender = d.data.gender;
        if (gender === 'M') return '#cfe2ff';
        if (gender === 'F') return '#f8d7e6';
        return '#fff4e6';
      }
      const gender = d.data.gender;
      if (gender === 'M') return '#e3f2fd';
      if (gender === 'F') return '#fce4ec';
      return '#f5f5f5';
    })
    .attr('stroke', (d) => {
      if (d.data.isNavigationNode) return '#ff9800';
      const inPath = isNodeInPath(d.data.id);
      if (inPath) return '#ff9800'; // Orange for path nodes
      return d.data.id === store.selectedPersonId ? '#2196f3' : '#999';
    })
    .attr('stroke-width', (d) => {
      if (d.data.isNavigationNode) return 2;
      const inPath = isNodeInPath(d.data.id);
      if (inPath) return 4; // Thicker border for path nodes
      return d.data.id === store.selectedPersonId ? 3 : 1;
    })
    .on('click', (event: MouseEvent, d) => {
      event.stopPropagation();
      handleNodeClick(d);
    })
    .on('dblclick', (event: MouseEvent, d) => {
      event.stopPropagation();
      if (!d.data.isNavigationNode) {
        store.setSelectedPerson(d.data.id);
        openEditor(d.data.id);
      }
    });
  
  // Draw name
  nodeGroupEnter.append('text')
    .attr('class', 'node-name')
    .attr('x', 0)
    .attr('y', -nodeHeight / 2 + 25)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .attr('font-weight', 'bold');
  
  nodeGroupEnter.merge(nodeGroup as any)
    .select('.node-name')
    .text((d) => d.data.name);
  
  // Draw birth date (only for non-navigation nodes)
  nodeGroupEnter.append('text')
    .attr('class', 'node-birth')
    .attr('x', 0)
    .attr('y', -nodeHeight / 2 + 45)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('fill', '#666');
  
  nodeGroupEnter.merge(nodeGroup as any)
    .select('.node-birth')
    .each(function(d: any) {
      const textEl = d3.select(this);
      // Remove all existing tspans
      textEl.selectAll('tspan').remove();
      
      if (d.data.isNavigationNode) {
        textEl.text('');
        return;
      }
      
      const parts: string[] = [];
      if (d.data.birthDate) parts.push(`b. ${d.data.birthDate}`);
      if (d.data.birthPlace) parts.push(d.data.birthPlace);
      
      if (parts.length === 0) {
        textEl.text('');
        return;
      }
      
      // Create tspan for each line
      parts.forEach((part, i) => {
        textEl.append('tspan')
          .attr('x', 0)
          .attr('dy', i === 0 ? '0' : '1.2em')
          .text(part);
      });
    });
  
  // Draw death date (only for non-navigation nodes)
  nodeGroupEnter.append('text')
    .attr('class', 'node-death')
    .attr('x', 0)
    .attr('y', -nodeHeight / 2 + 65)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('fill', '#666');
  
  nodeGroupEnter.merge(nodeGroup as any)
    .select('.node-death')
    .text((d) => d.data.isNavigationNode ? '' : (d.data.deathDate ? `d. ${d.data.deathDate}` : ''));
  
  // Update positions
  nodeGroupEnter.merge(nodeGroup as any)
    .attr('transform', (d) => {
      // Check for NaN or undefined values
      const x = d.x;
      const y = d.y;
      if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
        console.warn('Node has invalid position:', d.data.id, { x, y });
        return 'translate(0,0)';
      }
      return `translate(${x},${y})`;
    });
}

function handleNodeClick(d: d3.HierarchyPointNode<TreeNode>) {
  if (d.data.isNavigationNode) {
    // Navigate to parent
    const currentRoot = store.familyTree.persons.find(p => p.id === store.currentRootPersonId);
    if (currentRoot) {
      const parentRel = currentRoot.relationships.find(r => r.type === 'parent');
      if (parentRel) {
        store.setCurrentRoot(parentRel.personId);
        initializeTree();
      }
    }
  } else {
    // Navigate to this person as new root
    if (d.data.id !== store.currentRootPersonId) {
      store.setCurrentRoot(d.data.id);
      initializeTree();
    } else {
      // Already root, just select
      store.setSelectedPerson(d.data.id);
    }
  }
}

watch(() => [store.familyTree, store.currentRootPersonId, store.maxGenerations], async () => {
  console.log('watch: familyTree/root/generations changed', { 
    personsCount: store.familyTree.persons.length,
    currentRoot: store.currentRootPersonId,
    maxGenerations: store.maxGenerations
  });
  if (hasData.value && store.currentRootPersonId) {
    console.log('watch: hasData and root, waiting for nextTick');
    await nextTick();
    console.log('watch: calling initializeTree');
    initializeTree();
  } else {
    console.log('watch: missing data or root');
  }
}, { deep: true, immediate: false });

// Watch connectionPath to redraw highlighting when it changes
watch(() => store.connectionPath, async () => {
  if (hasData.value && store.currentRootPersonId && root && g) {
    await nextTick();
    // Redraw links and nodes to update highlighting
    drawLinks(root);
    drawSpouseLinks(root);
    drawNodes(root);
  }
});

watch(hasData, async (newValue) => {
  console.log('watch hasData:', newValue);
  if (newValue && store.currentRootPersonId) {
    // Wait a bit longer to ensure DOM is fully ready
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('watch hasData: calling initializeTree after delay');
    initializeTree();
  }
});

watch(() => store.selectedPersonId, () => {
  if (g && root) {
    g.selectAll('.node')
      .attr('stroke', (d: any) => {
        const nodeData = d.data as TreeNode;
        if (nodeData.isNavigationNode) return '#ff9800';
        return nodeData.id === store.selectedPersonId ? '#2196f3' : '#999';
      })
      .attr('stroke-width', (d: any) => {
        const nodeData = d.data as TreeNode;
        if (nodeData.isNavigationNode) return 2;
        return nodeData.id === store.selectedPersonId ? 3 : 1;
      });
  }
});

onMounted(async () => {
  console.log('TreeViewer onMounted', { hasData: hasData.value, currentRoot: store.currentRootPersonId });
  await nextTick();
  if (hasData.value && store.currentRootPersonId) {
    console.log('TreeViewer onMounted: hasData and root, calling initializeTree');
    initializeTree();
  }
  
  // Handle window resize
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

function handleResize() {
  if (hasData.value && store.currentRootPersonId) {
    // Reinitialize tree on resize
    initializeTree();
  }
}
</script>

<style scoped>
.tree-viewer {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.tree-svg {
  width: 100%;
  height: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

:deep(.link) {
  fill: none;
  stroke: #ccc;
  stroke-width: 2;
}

:deep(.spouse-link) {
  fill: none;
  stroke: #999;
  stroke-width: 2;
  stroke-dasharray: 5,5;
  opacity: 0.6;
}

:deep(.node) {
  cursor: pointer;
  transition: stroke-width 0.2s;
}

:deep(.node:hover) {
  stroke-width: 2 !important;
}

:deep(.node-name) {
  pointer-events: none;
}

:deep(.node-birth),
:deep(.node-death) {
  pointer-events: none;
}
</style>


