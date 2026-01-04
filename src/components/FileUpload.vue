<template>
  <div 
    class="file-upload" 
    :class="{ 'drag-over': isDragOver }"
    @drop="handleDrop"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @dragend="isDragOver = false"
    @click="triggerFileInput"
  >
    <input 
      ref="fileInputRef" 
      type="file" 
      accept=".ged,.json" 
      @change="handleFileSelect"
      style="display: none"
    />
    
    <div class="upload-content">
      <div class="upload-icon">📁</div>
      <h3>Upload Family Tree</h3>
      <p>Drag and drop a GEDCOM (.ged) or JSON (.json) file here, or click to browse</p>
      <button @click="triggerFileInput" class="browse-btn">Browse Files</button>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useFamilyTreeStore } from '../stores/family-tree-store';
import { parseGedcom } from '../parsers/gedcom-parser';
import { parseJson } from '../parsers/json-parser';

const store = useFamilyTreeStore();
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
const error = ref('');

const emit = defineEmits<{
  loaded: [];
}>();

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    processFile(file);
  }
  // Reset input after a short delay to prevent immediate re-trigger
  setTimeout(() => {
    if (target) {
      target.value = '';
    }
  }, 100);
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false;
  event.preventDefault();
  
  const file = event.dataTransfer?.files[0];
  if (file) {
    processFile(file);
  }
}

async function processFile(file: File) {
  error.value = '';
  
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension !== 'ged' && extension !== 'json') {
    error.value = 'Please upload a .ged or .json file';
    return;
  }
  
  try {
    const text = await file.text();
    
    if (extension === 'ged') {
      const familyTree = parseGedcom(text);
      console.log('Parsed GEDCOM:', familyTree);
      if (!familyTree.persons || familyTree.persons.length === 0) {
        error.value = 'No persons found in GEDCOM file';
        return;
      }
      store.loadFamilyTree(familyTree);
      console.log('Store after load:', store.familyTree);
      emit('loaded');
    } else if (extension === 'json') {
      const familyTree = parseJson(text);
      console.log('Parsed JSON:', familyTree);
      if (!familyTree.persons || familyTree.persons.length === 0) {
        error.value = 'No persons found in JSON file';
        return;
      }
      store.loadFamilyTree(familyTree);
      console.log('Store after load:', store.familyTree);
      emit('loaded');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to parse file';
    console.error('Error parsing file:', err);
  }
}
</script>

<style scoped>
.file-upload {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  background: #fafafa;
  transition: all 0.3s ease;
  cursor: pointer;
}

.file-upload.drag-over {
  border-color: #2196f3;
  background: #e3f2fd;
}

.upload-content {
  pointer-events: none;
}

.file-upload {
  cursor: pointer;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-content h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.upload-content p {
  margin: 0 0 20px 0;
  color: #666;
}

.browse-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  pointer-events: auto;
}

.browse-btn:hover {
  background: #1976d2;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  border: 1px solid #ef5350;
}
</style>

