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
import { useFamilyTreeStore } from '../stores/family-tree-store';
import PersonEditor from './PersonEditor.vue';
import { useTreeRenderer } from '../composables/useTreeRenderer';

const store = useFamilyTreeStore();
const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGElement | null>(null);

const hasData = computed(() => store.familyTree.persons.length > 0);

const { initializeTree, redrawHighlighting, updateSelectionHighlight, isEditorOpen, editingPersonId, closeEditor } =
  useTreeRenderer(svgRef, containerRef, store);

watch(() => [store.familyTree, store.currentRootPersonId, store.maxGenerations], async () => {
  if (hasData.value && store.currentRootPersonId) {
    await nextTick();
    initializeTree();
  }
}, { deep: true, immediate: false });

watch(() => store.connectionPath, async () => {
  if (hasData.value && store.currentRootPersonId) {
    await nextTick();
    redrawHighlighting();
  }
});

watch(hasData, async (newValue) => {
  if (newValue && store.currentRootPersonId) {
    await nextTick();
    initializeTree();
  }
});

watch(() => store.selectedPersonId, () => {
  updateSelectionHighlight();
});

function handleResize() {
  if (hasData.value && store.currentRootPersonId) initializeTree();
}

function exportSvg() {
  if (!svgRef.value) return;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgRef.value);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'family-tree.svg';
  a.click();
  URL.revokeObjectURL(url);
}

defineExpose({ exportSvg });

onMounted(async () => {
  await nextTick();
  if (hasData.value && store.currentRootPersonId) initializeTree();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
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
