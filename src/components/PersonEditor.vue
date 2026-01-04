<template>
  <div v-if="isOpen" class="editor-overlay" @click.self="close">
    <div class="editor-modal">
      <div class="editor-header">
        <h2>{{ personId ? 'Edit Person' : 'Add Person' }}</h2>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="editor-content">
        <div class="form-group">
          <label>Name</label>
          <input v-model="formData.name" type="text" />
        </div>
        
        <div class="form-group">
          <label>Birth Date</label>
          <input v-model="formData.birthDate" type="text" placeholder="e.g., 1950" />
        </div>
        
        <div class="form-group">
          <label>Death Date</label>
          <input v-model="formData.deathDate" type="text" placeholder="e.g., 2020" />
        </div>
        
        <div class="form-group">
          <label>Gender</label>
          <select v-model="formData.gender">
            <option value="">Unknown</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        
        <div v-if="person" class="form-group">
          <label>Relationships</label>
          <div class="relationships-list">
            <div v-for="(rel, index) in person.relationships" :key="index" class="relationship-item">
              <span class="rel-type">{{ rel.type }}</span>
              <span class="rel-person">{{ getPersonName(rel.personId) }}</span>
              <button @click="removeRelationship(index)" class="remove-btn">Remove</button>
            </div>
            <div v-if="person.relationships.length === 0" class="no-relationships">
              No relationships
            </div>
          </div>
        </div>
        
        <div v-if="person" class="form-group">
          <label>Add Relationship</label>
          <div class="add-relationship">
            <select v-model="newRelationshipType">
              <option value="">Select type</option>
              <option value="parent">Parent</option>
              <option value="child">Child</option>
              <option value="spouse">Spouse</option>
            </select>
            <select v-model="newRelationshipPersonId">
              <option value="">Select person</option>
              <option v-for="p in availablePersons" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
            <button @click="addRelationship" :disabled="!canAddRelationship" class="add-btn">
              Add
            </button>
          </div>
        </div>
        
        <div class="form-actions">
          <button @click="save" class="save-btn">{{ personId ? 'Save' : 'Add Person' }}</button>
          <button v-if="personId" @click="deletePerson" class="delete-btn">Delete Person</button>
          <button @click="close" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFamilyTreeStore } from '../stores/family-tree-store';
import type { Gender, RelationshipType } from '../types/family-tree';

const props = defineProps<{
  isOpen: boolean;
  personId: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const store = useFamilyTreeStore();

const formData = ref({
  name: '',
  birthDate: '',
  deathDate: '',
  gender: '' as Gender | ''
});

const newRelationshipType = ref<RelationshipType | ''>('');
const newRelationshipPersonId = ref('');

const person = computed(() => {
  if (!props.personId) return null;
  return store.familyTree.persons.find(p => p.id === props.personId) || null;
});

const availablePersons = computed(() => {
  if (!props.personId) return [];
  return store.familyTree.persons.filter(p => p.id !== props.personId);
});

const canAddRelationship = computed(() => {
  return newRelationshipType.value !== '' && newRelationshipPersonId.value !== '';
});

watch(() => props.personId, (newId) => {
  if (newId && person.value) {
    formData.value = {
      name: person.value.name,
      birthDate: person.value.birthDate || '',
      deathDate: person.value.deathDate || '',
      gender: person.value.gender || ''
    };
  } else {
    // Reset form for new person
    formData.value = {
      name: '',
      birthDate: '',
      deathDate: '',
      gender: ''
    };
  }
}, { immediate: true });

function getPersonName(personId: string): string {
  const person = store.familyTree.persons.find(p => p.id === personId);
  return person ? person.name : 'Unknown';
}

function addRelationship() {
  if (!props.personId || !canAddRelationship.value) return;
  
  // Make sure person exists (should always be true if personId is set)
  if (!person.value) return;
  
  store.addRelationship(props.personId, {
    type: newRelationshipType.value as RelationshipType,
    personId: newRelationshipPersonId.value
  });
  
  newRelationshipType.value = '';
  newRelationshipPersonId.value = '';
}

function removeRelationship(index: number) {
  if (!props.personId) return;
  store.removeRelationship(props.personId, index);
}

function save() {
  if (!formData.value.name.trim()) {
    alert('Please enter a name');
    return;
  }
  
  if (props.personId) {
    // Update existing person
    store.updatePerson(props.personId, {
      name: formData.value.name,
      birthDate: formData.value.birthDate || undefined,
      deathDate: formData.value.deathDate || undefined,
      gender: (formData.value.gender || undefined) as Gender | undefined
    });
  } else {
    // Add new person
    store.addPerson({
      name: formData.value.name,
      birthDate: formData.value.birthDate || undefined,
      deathDate: formData.value.deathDate || undefined,
      gender: (formData.value.gender || undefined) as Gender | undefined,
      relationships: []
    });
  }
  
  close();
}

function deletePerson() {
  if (!props.personId) return;
  if (confirm('Are you sure you want to delete this person?')) {
    store.removePerson(props.personId);
    close();
  }
}

function close() {
  emit('close');
}
</script>

<style scoped>
.editor-overlay {
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

.editor-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.editor-header h2 {
  margin: 0;
  font-size: 24px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 32px;
  cursor: pointer;
  color: #999;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.close-btn:hover {
  color: #333;
}

.editor-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #2196f3;
}

.relationships-list {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  min-height: 100px;
  max-height: 200px;
  overflow-y: auto;
}

.relationship-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.relationship-item:last-child {
  border-bottom: none;
}

.rel-type {
  font-weight: 500;
  color: #666;
  min-width: 80px;
  text-transform: capitalize;
}

.rel-person {
  flex: 1;
}

.remove-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.remove-btn:hover {
  background: #d32f2f;
}

.no-relationships {
  color: #999;
  text-align: center;
  padding: 20px;
}

.add-relationship {
  display: flex;
  gap: 8px;
  align-items: center;
}

.add-relationship select {
  flex: 1;
}

.add-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.add-btn:hover:not(:disabled) {
  background: #45a049;
}

.add-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.save-btn,
.delete-btn,
.cancel-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.save-btn {
  background: #2196f3;
  color: white;
}

.save-btn:hover {
  background: #1976d2;
}

.delete-btn {
  background: #f44336;
  color: white;
}

.delete-btn:hover {
  background: #d32f2f;
}

.cancel-btn {
  background: #e0e0e0;
  color: #333;
}

.cancel-btn:hover {
  background: #bdbdbd;
}
</style>

