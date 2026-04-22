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
          <input v-model="formData.name" type="text" @input="validationError = ''" />
          <div v-if="validationError" class="field-error">{{ validationError }}</div>
        </div>
        
        <div class="form-group">
          <label>Birth Date</label>
          <input v-model="formData.birthDate" type="text" placeholder="e.g., 1950" />
        </div>
        
        <div class="form-group">
          <label>Birth Place</label>
          <input v-model="formData.birthPlace" type="text" placeholder="e.g., New York" />
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
        
        <div class="form-group">
          <label>Religion</label>
          <input v-model="formData.religion" type="text" placeholder="e.g., Protestant" />
        </div>
        
        <div class="form-group">
          <label>Occupation</label>
          <input v-model="formData.occupation" type="text" placeholder="e.g., Homemaker" />
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
            <div class="person-select-wrapper">
              <input
                v-model="personSearchQuery"
                type="text"
                placeholder="Search person..."
                class="person-search-input"
              />
              <select v-model="newRelationshipPersonId" size="4" class="person-select">
                <option value="">Select person</option>
                <option v-for="p in filteredPersons" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
            </div>
            <button @click="addRelationship" :disabled="!canAddRelationship" class="add-btn">
              Add
            </button>
          </div>
        </div>
        
        <div v-if="showDeleteConfirm" class="delete-confirm">
          <p>Are you sure you want to delete this person?</p>
          <div class="delete-confirm-actions">
            <button @click="confirmDeletePerson" class="delete-btn">Yes, Delete</button>
            <button @click="showDeleteConfirm = false" class="cancel-btn">Cancel</button>
          </div>
        </div>

        <div v-else class="form-actions">
          <button @click="save" class="save-btn">{{ personId ? 'Save' : 'Add Person' }}</button>
          <button v-if="personId" @click="showDeleteConfirm = true" class="delete-btn">Delete Person</button>
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
  birthPlace: '',
  deathDate: '',
  gender: '' as Gender | '',
  religion: '',
  occupation: ''
});

const newRelationshipType = ref<RelationshipType | ''>('');
const newRelationshipPersonId = ref('');
const personSearchQuery = ref('');
const validationError = ref('');
const showDeleteConfirm = ref(false);

const person = computed(() => {
  if (!props.personId) return null;
  return store.familyTree.persons.find(p => p.id === props.personId) || null;
});

const availablePersons = computed(() => {
  if (!props.personId) return [];
  return store.familyTree.persons.filter(p => p.id !== props.personId);
});

const filteredPersons = computed(() => {
  const q = personSearchQuery.value.toLowerCase().trim();
  if (!q) return availablePersons.value;
  return availablePersons.value.filter(p => p.name.toLowerCase().includes(q));
});

const canAddRelationship = computed(() => {
  return newRelationshipType.value !== '' && newRelationshipPersonId.value !== '';
});

watch(() => props.personId, (newId) => {
  validationError.value = '';
  showDeleteConfirm.value = false;
  personSearchQuery.value = '';
  newRelationshipType.value = '';
  newRelationshipPersonId.value = '';
  if (newId && person.value) {
    formData.value = {
      name: person.value.name,
      birthDate: person.value.birthDate || '',
      birthPlace: person.value.birthPlace || '',
      deathDate: person.value.deathDate || '',
      gender: person.value.gender || '',
      religion: person.value.religion || '',
      occupation: person.value.occupation || ''
    };
  } else {
    formData.value = {
      name: '',
      birthDate: '',
      birthPlace: '',
      deathDate: '',
      gender: '',
      religion: '',
      occupation: ''
    };
  }
}, { immediate: true });

function getPersonName(personId: string): string {
  const person = store.familyTree.persons.find(p => p.id === personId);
  return person ? person.name : 'Unknown';
}

function addRelationship() {
  if (!props.personId || !canAddRelationship.value) return;
  if (!person.value) return;

  const added = store.addRelationship(props.personId, {
    type: newRelationshipType.value as RelationshipType,
    personId: newRelationshipPersonId.value
  });

  if (!added) {
    validationError.value = 'That relationship would create a cycle.';
    return;
  }

  newRelationshipType.value = '';
  newRelationshipPersonId.value = '';
  personSearchQuery.value = '';
  validationError.value = '';
}

function removeRelationship(index: number) {
  if (!props.personId) return;
  store.removeRelationship(props.personId, index);
}

function save() {
  if (!formData.value.name.trim()) {
    validationError.value = 'Please enter a name';
    return;
  }
  validationError.value = '';
  
  if (props.personId) {
    // Update existing person
    store.updatePerson(props.personId, {
      name: formData.value.name,
      birthDate: formData.value.birthDate || undefined,
      birthPlace: formData.value.birthPlace || undefined,
      deathDate: formData.value.deathDate || undefined,
      gender: (formData.value.gender || undefined) as Gender | undefined,
      religion: formData.value.religion || undefined,
      occupation: formData.value.occupation || undefined
    });
  } else {
    // Add new person
    store.addPerson({
      name: formData.value.name,
      birthDate: formData.value.birthDate || undefined,
      birthPlace: formData.value.birthPlace || undefined,
      deathDate: formData.value.deathDate || undefined,
      gender: (formData.value.gender || undefined) as Gender | undefined,
      relationships: [],
      religion: formData.value.religion || undefined,
      occupation: formData.value.occupation || undefined
    });
  }
  
  close();
}

function confirmDeletePerson() {
  if (!props.personId) return;
  store.removePerson(props.personId);
  showDeleteConfirm.value = false;
  close();
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

.field-error {
  margin-top: 4px;
  font-size: 13px;
  color: #c62828;
}

.add-relationship {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.add-relationship > select {
  flex-shrink: 0;
}

.person-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.person-search-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.person-search-input:focus {
  outline: none;
  border-color: #2196f3;
}

.person-select {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.delete-confirm {
  margin-top: 24px;
  padding: 16px;
  background: #fff3f3;
  border: 1px solid #ef9a9a;
  border-radius: 4px;
}

.delete-confirm p {
  margin: 0 0 12px 0;
  color: #b71c1c;
  font-weight: 500;
}

.delete-confirm-actions {
  display: flex;
  gap: 8px;
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

