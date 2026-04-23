export type Gender = 'M' | 'F' | 'U';

export type RelationshipType = 'parent' | 'child' | 'spouse';

export interface Relationship {
  type: RelationshipType;
  personId: string;
}

export interface Event {
  type: string;
  date?: string;
  place?: string;
  note?: string;
  source?: string;
}

export interface Person {
  id: string;
  name: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  gender?: Gender;
  relationships: Relationship[];
  events?: Event[];
  religion?: string;
  occupation?: string;
  notes?: string[];
  birthSource?: string;
  deathSource?: string;
}

export interface FamilyTree {
  rootPersonId?: string;
  persons: Person[];
}

