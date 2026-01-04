import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FamilyTree, Person, Relationship, RelationshipType, Gender } from '../types/family-tree';

export const useFamilyTreeStore = defineStore('familyTree', () => {
  const familyTree = ref<FamilyTree>({
    rootPersonId: undefined,
    persons: []
  });
  
  const selectedPersonId = ref<string | null>(null);
  const currentRootPersonId = ref<string | undefined>(undefined);
  const maxGenerations = ref<number>(4);
  const zoom = ref(1);
  const panX = ref(0);
  const panY = ref(0);
  
  const selectedPerson = computed(() => {
    if (!selectedPersonId.value) return null;
    return familyTree.value.persons.find(p => p.id === selectedPersonId.value) || null;
  });
  
  function loadFamilyTree(tree: FamilyTree) {
    familyTree.value = tree;
    // Set initial root - prefer tree's rootPersonId, otherwise first person
    if (tree.rootPersonId) {
      currentRootPersonId.value = tree.rootPersonId;
      selectedPersonId.value = tree.rootPersonId;
    } else if (tree.persons.length > 0) {
      currentRootPersonId.value = tree.persons[0].id;
      selectedPersonId.value = tree.persons[0].id;
    } else {
      currentRootPersonId.value = undefined;
      selectedPersonId.value = null;
    }
  }
  
  function setCurrentRoot(personId: string) {
    currentRootPersonId.value = personId;
    selectedPersonId.value = personId;
  }
  
  function setMaxGenerations(count: number) {
    maxGenerations.value = Math.max(1, Math.min(10, count)); // Limit between 1 and 10
  }
  
  function addPerson(person: Omit<Person, 'id'>): Person {
    const id = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newPerson: Person = {
      ...person,
      id
    };
    familyTree.value.persons.push(newPerson);
    
    if (!familyTree.value.rootPersonId) {
      familyTree.value.rootPersonId = id;
    }
    
    return newPerson;
  }
  
  function updatePerson(id: string, updates: Partial<Omit<Person, 'id' | 'relationships'>>) {
    const person = familyTree.value.persons.find(p => p.id === id);
    if (person) {
      Object.assign(person, updates);
    }
  }
  
  function removePerson(id: string) {
    const index = familyTree.value.persons.findIndex(p => p.id === id);
    if (index === -1) return;
    
    // Remove all relationships pointing to this person
    for (const person of familyTree.value.persons) {
      person.relationships = person.relationships.filter(rel => rel.personId !== id);
    }
    
    // Remove the person
    familyTree.value.persons.splice(index, 1);
    
    // Update root if needed
    if (familyTree.value.rootPersonId === id) {
      familyTree.value.rootPersonId = familyTree.value.persons.length > 0 
        ? familyTree.value.persons[0].id 
        : undefined;
    }
    
    // Clear selection if removed person was selected
    if (selectedPersonId.value === id) {
      selectedPersonId.value = familyTree.value.rootPersonId || null;
    }
  }
  
  function addRelationship(personId: string, relationship: Relationship) {
    const person = familyTree.value.persons.find(p => p.id === personId);
    if (person) {
      // Check if relationship already exists
      const exists = person.relationships.some(
        rel => rel.type === relationship.type && rel.personId === relationship.personId
      );
      if (!exists) {
        person.relationships.push(relationship);
        
        // Add reciprocal relationship
        const targetPerson = familyTree.value.persons.find(p => p.id === relationship.personId);
        if (targetPerson) {
          let reciprocalType: RelationshipType;
          if (relationship.type === 'parent') {
            reciprocalType = 'child';
          } else if (relationship.type === 'child') {
            reciprocalType = 'parent';
          } else {
            reciprocalType = 'spouse';
          }
          
          const reciprocalExists = targetPerson.relationships.some(
            rel => rel.type === reciprocalType && rel.personId === personId
          );
          if (!reciprocalExists) {
            targetPerson.relationships.push({
              type: reciprocalType,
              personId
            });
          }
        }
      }
    }
  }
  
  function removeRelationship(personId: string, relationshipIndex: number) {
    const person = familyTree.value.persons.find(p => p.id === personId);
    if (person && person.relationships[relationshipIndex]) {
      const relationship = person.relationships[relationshipIndex];
      person.relationships.splice(relationshipIndex, 1);
      
      // Remove reciprocal relationship
      const targetPerson = familyTree.value.persons.find(p => p.id === relationship.personId);
      if (targetPerson) {
        let reciprocalType: RelationshipType;
        if (relationship.type === 'parent') {
          reciprocalType = 'child';
        } else if (relationship.type === 'child') {
          reciprocalType = 'parent';
        } else {
          reciprocalType = 'spouse';
        }
        
        const reciprocalIndex = targetPerson.relationships.findIndex(
          rel => rel.type === reciprocalType && rel.personId === personId
        );
        if (reciprocalIndex !== -1) {
          targetPerson.relationships.splice(reciprocalIndex, 1);
        }
      }
    }
  }
  
  function setSelectedPerson(id: string | null) {
    selectedPersonId.value = id;
  }
  
  function setZoom(newZoom: number) {
    zoom.value = Math.max(0.1, Math.min(5, newZoom));
  }
  
  function setPan(x: number, y: number) {
    panX.value = x;
    panY.value = y;
  }
  
  function resetView() {
    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;
  }
  
  return {
    familyTree,
    selectedPersonId,
    selectedPerson,
    currentRootPersonId,
    maxGenerations,
    zoom,
    panX,
    panY,
    loadFamilyTree,
    addPerson,
    updatePerson,
    removePerson,
    addRelationship,
    removeRelationship,
    setSelectedPerson,
    setCurrentRoot,
    setMaxGenerations,
    setZoom,
    setPan,
    resetView
  };
});

