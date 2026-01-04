<template>
  <div class="app">
    <header class="app-header">
      <h1>Family Tree Viewer</h1>
      <div class="header-actions">
        <button 
          v-if="hasData && store.canGoBack" 
          @click="store.goBack" 
          class="back-btn"
          title="Go back to previous person"
        >
          ← Back
        </button>
        <button 
          v-if="hasData" 
          @click="showUpload = true" 
          class="upload-btn"
        >
          Upload New File
        </button>
        <button 
          v-if="hasData" 
          @click="exportTree" 
          class="export-btn"
        >
          Export JSON
        </button>
        <button 
          v-if="hasData" 
          @click="showAddPerson = true" 
          class="add-person-btn"
        >
          Add Person
        </button>
      </div>
    </header>
    
    <main class="app-main">
      <FileUpload 
        v-if="!hasData" 
        @loaded="handleFileLoaded" 
      />
      
      <div v-else class="tree-container">
        <TreeViewer />
      </div>
    </main>
    
    <PersonEditor 
      v-if="showAddPerson"
      :is-open="showAddPerson"
      :person-id="null"
      @close="handleAddPersonClose"
    />
    
    <div v-if="showUpload" class="upload-modal-overlay" @click.self="showUpload = false">
      <div class="upload-modal">
        <div class="upload-modal-header">
          <h2>Upload New Family Tree</h2>
          <button class="close-btn" @click="showUpload = false">&times;</button>
        </div>
        <div class="upload-modal-content">
          <FileUpload @loaded="handleFileLoaded" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFamilyTreeStore } from './stores/family-tree-store';
import FileUpload from './components/FileUpload.vue';
import TreeViewer from './components/TreeViewer.vue';
import PersonEditor from './components/PersonEditor.vue';
import { downloadJson } from './utils/json-exporter';

const store = useFamilyTreeStore();
const showAddPerson = ref(false);
const showUpload = ref(false);

const hasData = computed(() => store.familyTree.persons.length > 0);

function handleFileLoaded() {
  // File loaded, tree will be displayed
  showUpload.value = false;
}

function exportTree() {
  downloadJson(store.familyTree);
}

function handleAddPersonClose() {
  showAddPerson.value = false;
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  background: white;
  padding: 16px 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
}

.app-header h1 {
  font-size: 24px;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.export-btn,
.add-person-btn,
.back-btn,
.upload-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.back-btn {
  background: #757575;
  color: white;
}

.back-btn:hover {
  background: #616161;
}

.upload-btn {
  background: #ff9800;
  color: white;
}

.upload-btn:hover {
  background: #f57c00;
}

.export-btn {
  background: #4caf50;
  color: white;
}

.export-btn:hover {
  background: #45a049;
}

.add-person-btn {
  background: #2196f3;
  color: white;
}

.add-person-btn:hover {
  background: #1976d2;
}

.app-main {
  flex: 1;
  overflow: hidden;
  padding: 24px;
}

.tree-container {
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.upload-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.upload-modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.upload-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.upload-modal-header h2 {
  margin: 0;
  color: #333;
}

.upload-modal-header .close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.upload-modal-header .close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.upload-modal-content {
  padding: 0;
}
</style>

