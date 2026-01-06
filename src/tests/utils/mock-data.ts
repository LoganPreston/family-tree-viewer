import type { FamilyTree, Person } from '../../types/family-tree';

export const mockPerson1: Person = {
  id: 'person1',
  name: 'John Doe',
  birthDate: '1 JAN 1900',
  birthPlace: 'New York',
  deathDate: '1 DEC 1990',
  gender: 'M',
  religion: 'Protestant',
  occupation: 'Engineer',
  relationships: [],
  events: []
};

export const mockPerson2: Person = {
  id: 'person2',
  name: 'Jane Doe',
  birthDate: '15 MAR 1905',
  birthPlace: 'Boston',
  gender: 'F',
  relationships: [
    { type: 'spouse', personId: 'person1' }
  ],
  events: []
};

export const mockPerson3: Person = {
  id: 'person3',
  name: 'Bob Doe',
  birthDate: '10 JUN 1930',
  gender: 'M',
  relationships: [
    { type: 'parent', personId: 'person1' },
    { type: 'parent', personId: 'person2' }
  ],
  events: []
};

export const mockFamilyTree: FamilyTree = {
  rootPersonId: 'person1',
  persons: [mockPerson1, mockPerson2, mockPerson3]
};

export const mockEmptyTree: FamilyTree = {
  rootPersonId: undefined,
  persons: []
};

export const mockSinglePersonTree: FamilyTree = {
  rootPersonId: 'person1',
  persons: [mockPerson1]
};

export const mockSimpleTree: FamilyTree = {
  rootPersonId: 'person1',
  persons: [
    {
      id: 'person1',
      name: 'Parent',
      gender: 'M',
      relationships: [
        { type: 'child', personId: 'person2' }
      ],
      events: []
    },
    {
      id: 'person2',
      name: 'Child',
      gender: 'M',
      relationships: [
        { type: 'parent', personId: 'person1' }
      ],
      events: []
    }
  ]
};

