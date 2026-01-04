import type { FamilyTree } from '../types/family-tree';

export function exportToJson(familyTree: FamilyTree): string {
  return JSON.stringify(familyTree, null, 2);
}

export function downloadJson(familyTree: FamilyTree, filename: string = 'family-tree.json') {
  const json = exportToJson(familyTree);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

