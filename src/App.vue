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
        <div v-if="hasData" class="generations-control">
          <label class="gen-label">Generations: {{ store.maxGenerations }}</label>
          <input
            type="range"
            min="1"
            max="10"
            :value="store.maxGenerations"
            @input="store.setMaxGenerations(+($event.target as HTMLInputElement).value)"
            class="gen-slider"
          />
        </div>
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
          @click="showSearch = true" 
          class="search-btn"
        >
          Search
        </button>
        <button 
          v-if="hasData" 
          @click="showConnectionModal = true" 
          class="connection-btn"
        >
          Find Connection
        </button>
        <button 
          v-if="hasData && store.connectionPath" 
          @click="clearConnectionPath" 
          class="clear-highlight-btn"
        >
          Clear Highlight
        </button>
        <button
          v-if="hasData"
          @click="treeViewerRef?.exportSvg()"
          class="export-svg-btn"
        >
          Export SVG
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
      <div v-if="!hasData" class="empty-state-container">
        <FileUpload @loaded="handleFileLoaded" />
        <div class="blank-start">
          <span class="blank-start-divider">or</span>
          <button class="blank-start-btn" @click="showAddPerson = true">
            Start with a blank tree
          </button>
        </div>
      </div>
      
      <div v-else class="tree-container">
        <TreeViewer ref="treeViewerRef" />
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
    
    <div v-if="showSearch" class="search-modal-overlay" @click.self="handleSearchClose">
      <div class="search-modal">
        <div class="search-modal-header">
          <h2>Search for Person</h2>
          <button class="close-btn" @click="handleSearchClose">&times;</button>
        </div>
        <div class="search-modal-content">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Type a name to search..."
            class="search-input"
            autofocus
          />
          <div class="search-results">
            <div v-if="searchResults.length === 0 && searchQuery.trim()" class="no-results">
              No results found
            </div>
            <div
              v-for="person in searchResults"
              :key="person.id"
              class="search-result-item"
              @click="handleSearchSelect(person.id)"
            >
              <div class="result-name">{{ person.name }}</div>
              <div class="result-dates">
                <span v-if="person.birthDate">b. {{ person.birthDate }}</span>
                <span v-if="person.birthDate && person.deathDate"> • </span>
                <span v-if="person.deathDate">d. {{ person.deathDate }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="showConnectionModal" class="connection-modal-overlay" @click.self="handleConnectionClose">
      <div class="connection-modal">
        <div class="connection-modal-header">
          <h2>Find Connection Between People</h2>
          <button class="close-btn" @click="handleConnectionClose">&times;</button>
        </div>
        <div class="connection-modal-content">
          <div class="connection-selectors">
            <div class="person-selector">
              <label>Person 1:</label>
              <input
                v-model="connectionPerson1Query"
                type="text"
                placeholder="Type a name to search..."
                class="connection-search-input"
                @input="filterConnectionPerson1"
              />
              <div v-if="connectionPerson1Query && connectionPerson1Results.length > 0" class="connection-results-dropdown">
                <div
                  v-for="person in connectionPerson1Results"
                  :key="person.id"
                  class="connection-result-item"
                  @click="selectConnectionPerson1(person.id)"
                >
                  <div class="result-name">{{ person.name }}</div>
                  <div v-if="person.birthDate" class="result-dates">b. {{ person.birthDate }}</div>
                </div>
              </div>
            </div>
            
            <div class="person-selector">
              <label>Person 2:</label>
              <input
                v-model="connectionPerson2Query"
                type="text"
                placeholder="Type a name to search..."
                class="connection-search-input"
                @input="filterConnectionPerson2"
              />
              <div v-if="connectionPerson2Query && connectionPerson2Results.length > 0" class="connection-results-dropdown">
              <div
                v-for="person in connectionPerson2Results"
                :key="person.id"
                class="connection-result-item"
                @click="selectConnectionPerson2(person.id)"
              >
                <div class="result-name">{{ person.name }}</div>
                <div v-if="person.birthDate" class="result-dates">b. {{ person.birthDate }}</div>
              </div>
              </div>
            </div>
          </div>
          
          <div v-if="connectionPerson1Id && connectionPerson2Id" class="connection-selected">
            <div class="selected-person">
              <strong>Person 1:</strong> {{ getPersonName(connectionPerson1Id) }}
            </div>
            <div class="selected-person">
              <strong>Person 2:</strong> {{ getPersonName(connectionPerson2Id) }}
            </div>
          </div>
          
          <div class="connection-actions">
            <button 
              @click="findConnectionPath"
              :disabled="!connectionPerson1Id || !connectionPerson2Id"
              class="find-path-btn"
            >
              Find Path
            </button>
            <button 
              @click="clearConnectionPath"
              :disabled="!store.connectionPath"
              class="clear-path-btn"
            >
              Clear Highlight
            </button>
          </div>
          
          <div v-if="connectionPathResult" class="connection-path-result">
            <h3>Path Found:</h3>
            <div class="path-display">
              <span
                v-for="(personId, index) in connectionPathResult"
                :key="personId"
                class="path-person"
              >
                {{ getPersonName(personId) }}
                <span v-if="index < connectionPathResult.length - 1" class="path-arrow">→</span>
              </span>
            </div>
          </div>
          
          <div v-if="connectionPathResult === null && hasSearched" class="connection-error">
            No connection found between these two people.
          </div>
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
import { findShortestPath } from './utils/path-finder';

const store = useFamilyTreeStore();
const treeViewerRef = ref<InstanceType<typeof TreeViewer> | null>(null);
const showAddPerson = ref(false);
const showUpload = ref(false);
const showSearch = ref(false);
const searchQuery = ref('');
const showConnectionModal = ref(false);
const connectionPerson1Query = ref('');
const connectionPerson2Query = ref('');
const connectionPerson1Id = ref<string | null>(null);
const connectionPerson2Id = ref<string | null>(null);
const connectionPathResult = ref<string[] | null | undefined>(undefined);
const hasSearched = ref(false);

const hasData = computed(() => store.familyTree.persons.length > 0);

const searchResults = computed(() => {
  if (!searchQuery.value.trim()) {
    return [];
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  const results = store.familyTree.persons.filter(person =>
    person.name.toLowerCase().includes(query)
  );
  
  // Limit to 20 results
  return results.slice(0, 20);
});

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

function handleSearchSelect(personId: string) {
  store.setCurrentRoot(personId);
  handleSearchClose();
}

function handleSearchClose() {
  showSearch.value = false;
  searchQuery.value = '';
}

const connectionPerson1Results = computed(() => {
  if (!connectionPerson1Query.value.trim()) {
    return [];
  }
  const query = connectionPerson1Query.value.toLowerCase().trim();
  const results = store.familyTree.persons
    .filter(person => person.name.toLowerCase().includes(query))
    .slice(0, 10);
  // Don't show results if the query exactly matches the selected person's name
  if (connectionPerson1Id.value) {
    const selectedPerson = store.familyTree.persons.find(p => p.id === connectionPerson1Id.value);
    if (selectedPerson && connectionPerson1Query.value.trim() === selectedPerson.name) {
      return [];
    }
  }
  return results;
});

const connectionPerson2Results = computed(() => {
  if (!connectionPerson2Query.value.trim()) {
    return [];
  }
  const query = connectionPerson2Query.value.toLowerCase().trim();
  const results = store.familyTree.persons
    .filter(person => person.name.toLowerCase().includes(query))
    .slice(0, 10);
  // Don't show results if the query exactly matches the selected person's name
  if (connectionPerson2Id.value) {
    const selectedPerson = store.familyTree.persons.find(p => p.id === connectionPerson2Id.value);
    if (selectedPerson && connectionPerson2Query.value.trim() === selectedPerson.name) {
      return [];
    }
  }
  return results;
});

function filterConnectionPerson1() {
  connectionPerson1Id.value = null;
}

function filterConnectionPerson2() {
  connectionPerson2Id.value = null;
}

function selectConnectionPerson1(personId: string) {
  connectionPerson1Id.value = personId;
  const person = store.familyTree.persons.find(p => p.id === personId);
  connectionPerson1Query.value = person ? person.name : '';
}

function selectConnectionPerson2(personId: string) {
  connectionPerson2Id.value = personId;
  const person = store.familyTree.persons.find(p => p.id === personId);
  connectionPerson2Query.value = person ? person.name : '';
}

function getPersonName(personId: string): string {
  const person = store.familyTree.persons.find(p => p.id === personId);
  return person ? person.name : 'Unknown';
}

function findConnectionPath() {
  if (!connectionPerson1Id.value || !connectionPerson2Id.value) return;
  
  if (connectionPerson1Id.value === connectionPerson2Id.value) {
    connectionPathResult.value = null;
    hasSearched.value = true;
    store.setConnectionPath(null);
    return;
  }
  
  const path = findShortestPath(
    store.familyTree,
    connectionPerson1Id.value,
    connectionPerson2Id.value
  );
  
  connectionPathResult.value = path;
  hasSearched.value = true;
  store.setConnectionPath(path);
}

function clearConnectionPath() {
  store.clearConnectionPath();
  connectionPathResult.value = undefined;
  hasSearched.value = false;
}

function handleConnectionClose() {
  showConnectionModal.value = false;
  connectionPerson1Query.value = '';
  connectionPerson2Query.value = '';
  connectionPerson1Id.value = null;
  connectionPerson2Id.value = null;
  connectionPathResult.value = undefined;
  hasSearched.value = false;
  // Don't clear the path - leave highlighting in place
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

.generations-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gen-label {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
  font-weight: 500;
}

.gen-slider {
  width: 90px;
  cursor: pointer;
  accent-color: #2196f3;
}

.export-btn,
.add-person-btn,
.back-btn,
.upload-btn,
.search-btn,
.connection-btn,
.clear-highlight-btn {
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

.search-btn {
  background: #9c27b0;
  color: white;
}

.search-btn:hover {
  background: #7b1fa2;
}

.connection-btn {
  background: #00bcd4;
  color: white;
}

.connection-btn:hover {
  background: #0097a7;
}

.clear-highlight-btn {
  background: #ff5722;
  color: white;
}

.clear-highlight-btn:hover {
  background: #e64a19;
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

.search-modal-overlay {
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

.search-modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.search-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.search-modal-header h2 {
  margin: 0;
  color: #333;
}

.search-modal-header .close-btn {
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

.search-modal-header .close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.search-modal-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.search-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  margin-bottom: 16px;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: #9c27b0;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
  max-height: 60vh;
}

.no-results {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}

.search-result-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-result-item:hover {
  background-color: #f5f5f5;
}

.search-result-item:last-child {
  border-bottom: none;
}

.result-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.result-dates {
  font-size: 12px;
  color: #666;
}

.connection-modal-overlay {
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

.connection-modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 700px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.connection-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.connection-modal-header h2 {
  margin: 0;
  color: #333;
}

.connection-modal-header .close-btn {
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

.connection-modal-header .close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.connection-modal-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  flex: 1;
}

.connection-selectors {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.person-selector {
  position: relative;
}

.person-selector label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.connection-search-input {
  width: 100%;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.connection-search-input:focus {
  outline: none;
  border-color: #00bcd4;
}

.connection-results-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1001;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-top: 4px;
}

.connection-result-item {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}

.connection-result-item:hover {
  background-color: #f5f5f5;
}

.connection-result-item:last-child {
  border-bottom: none;
}

.connection-result-item .result-name {
  font-weight: 500;
  color: #333;
}

.connection-result-item .result-dates {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.connection-selected {
  padding: 12px;
  background-color: #f9f9f9;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-person {
  color: #333;
}

.connection-actions {
  display: flex;
  gap: 12px;
}

.find-path-btn,
.clear-path-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.find-path-btn {
  background: #00bcd4;
  color: white;
}

.find-path-btn:hover:not(:disabled) {
  background: #0097a7;
}

.find-path-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.clear-path-btn {
  background: #757575;
  color: white;
}

.clear-path-btn:hover:not(:disabled) {
  background: #616161;
}

.clear-path-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.connection-path-result {
  padding: 16px;
  background-color: #e8f5e9;
  border-radius: 4px;
  border: 1px solid #4caf50;
}

.connection-path-result h3 {
  margin: 0 0 12px 0;
  color: #2e7d32;
  font-size: 16px;
}

.path-display {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.path-person {
  font-weight: 500;
  color: #333;
}

.path-arrow {
  color: #4caf50;
  font-weight: bold;
  margin: 0 4px;
}

.connection-error {
  padding: 12px;
  background-color: #ffebee;
  border-radius: 4px;
  border: 1px solid #ef5350;
  color: #c62828;
  text-align: center;
}

.empty-state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  max-width: 600px;
  margin: 0 auto;
}

.blank-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.blank-start-divider {
  color: #999;
  font-size: 14px;
  margin-top: 16px;
}

.blank-start-btn {
  background: white;
  color: #2196f3;
  border: 2px solid #2196f3;
  padding: 10px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
}

.blank-start-btn:hover {
  background: #e3f2fd;
}

.export-svg-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  background: #607d8b;
  color: white;
}

.export-svg-btn:hover {
  background: #455a64;
}

@media print {
  .app-header,
  .upload-modal-overlay,
  .search-modal-overlay,
  .connection-modal-overlay {
    display: none !important;
  }

  .app-main {
    padding: 0;
    height: 100vh;
  }

  .tree-container {
    border-radius: 0;
    box-shadow: none;
    height: 100vh;
  }
}
</style>

