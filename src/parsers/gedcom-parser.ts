import type { Person, FamilyTree, Gender, Event } from '../types/family-tree';
import { findRootPersonId } from '../utils/find-root-person';

interface GedcomLine {
  level: number;
  tag: string;
  value?: string;
  xref?: string;
}

interface GedcomRecord {
  type: string;
  xref?: string;
  lines: GedcomLine[];
  children: GedcomRecord[];
}

function buildRecordTree(lines: GedcomLine[]): GedcomRecord[] {
  const records: GedcomRecord[] = [];
  const stack: GedcomRecord[] = [];

  for (const line of lines) {
    const record: GedcomRecord = { type: line.tag, xref: line.xref, lines: [line], children: [] };
    if (line.level === 0) {
      records.push(record);
      stack[0] = record;
      stack.length = 1;
    } else {
      stack[line.level - 1]?.children.push(record);
      stack[line.level] = record;
      stack.length = line.level + 1;
    }
  }

  return records;
}

// Assembles note text from a NOTE record's inline value and CONC/CONT children.
function assembleNoteText(record: GedcomRecord): string {
  let text = record.lines[0]?.value || '';
  if (text.match(/^@\w+@$/)) text = '';

  for (const child of record.children) {
    const tag = child.lines[0]?.tag;
    const val = child.lines[0]?.value || '';
    if (tag === 'CONC' || tag === 'CONCATENATION') {
      text += val;
    } else if (tag === 'CONT' || tag === 'CONTINUED') {
      text += '\n' + val;
    }
  }

  return text.trim();
}

export function parseGedcom(content: string): FamilyTree {
  const lines = content.split('\n').map(parseLine).filter(line => line !== null) as GedcomLine[];
  const records = buildRecordTree(lines);

  // Pre-pass: collect top-level NOTE records keyed by xref
  const noteMap = new Map<string, string>();
  for (const record of records) {
    if (record.type === 'NOTE' && record.xref) {
      const text = assembleNoteText(record);
      if (text) noteMap.set(record.xref, text);
    }
  }

  const persons: Person[] = [];
  const personMap = new Map<string, Person>();
  const families: Map<string, { husband?: string; wife?: string; children: string[] }> = new Map();
  const personFamilySpouse = new Map<string, string[]>();
  const personFamilyChild = new Map<string, string[]>();

  for (const record of records) {
    if (record.type === 'INDI' || record.type === 'INDIVIDUAL') {
      const person = parseIndividual(record, noteMap);
      if (person) {
        persons.push(person);
        personMap.set(person.id, person);

        const spouseFamilies: string[] = [];
        const childFamilies: string[] = [];

        for (const child of record.children) {
          const val = child.lines[0]?.value?.replace(/@/g, '');
          if (!val) continue;
          if (child.type === 'FAMS' || child.type === 'FAMILY_SPOUSE') {
            spouseFamilies.push(val);
          } else if (child.type === 'FAMC' || child.type === 'FAMILY_CHILD') {
            childFamilies.push(val);
          }
        }

        if (spouseFamilies.length > 0) personFamilySpouse.set(person.id, spouseFamilies);
        if (childFamilies.length > 0) personFamilyChild.set(person.id, childFamilies);
      }
    } else if (record.type === 'FAM' || record.type === 'FAMILY') {
      const family = parseFamily(record);
      if (family && record.xref) {
        families.set(record.xref, family);
      }
    }
  }

  // Second pass: resolve relationships from FAM records
  for (const [, family] of families.entries()) {
    if (family.husband) {
      const husband = personMap.get(family.husband);
      if (husband && family.wife) {
        addRelationshipIfNotExists(husband, { type: 'spouse', personId: family.wife });
        const wife = personMap.get(family.wife);
        if (wife) addRelationshipIfNotExists(wife, { type: 'spouse', personId: family.husband });
      }
      if (husband) {
        for (const childId of family.children) {
          addRelationshipIfNotExists(husband, { type: 'child', personId: childId });
          const child = personMap.get(childId);
          if (child && family.husband) addRelationshipIfNotExists(child, { type: 'parent', personId: family.husband });
        }
      }
    }

    if (family.wife) {
      const wife = personMap.get(family.wife);
      if (wife) {
        for (const childId of family.children) {
          addRelationshipIfNotExists(wife, { type: 'child', personId: childId });
          const child = personMap.get(childId);
          if (child && family.wife) addRelationshipIfNotExists(child, { type: 'parent', personId: family.wife });
        }
      }
    }
  }

  // Resolve FAMS/FAMC links
  for (const [familyId, family] of families.entries()) {
    const spousesInFamily: string[] = [];
    for (const [personId, familyIds] of personFamilySpouse.entries()) {
      if (familyIds.includes(familyId)) spousesInFamily.push(personId);
    }

    for (let i = 0; i < spousesInFamily.length; i++) {
      for (let j = i + 1; j < spousesInFamily.length; j++) {
        const s1 = personMap.get(spousesInFamily[i]);
        const s2 = personMap.get(spousesInFamily[j]);
        if (s1 && s2) {
          addRelationshipIfNotExists(s1, { type: 'spouse', personId: spousesInFamily[j] });
          addRelationshipIfNotExists(s2, { type: 'spouse', personId: spousesInFamily[i] });
        }
      }
    }

    if (family.husband && family.wife) {
      const husband = personMap.get(family.husband);
      const wife = personMap.get(family.wife);
      if (husband && wife) {
        addRelationshipIfNotExists(husband, { type: 'spouse', personId: family.wife });
        addRelationshipIfNotExists(wife, { type: 'spouse', personId: family.husband });
      }
    }

    const childrenInFamily: string[] = [...family.children];
    for (const [personId, familyIds] of personFamilyChild.entries()) {
      if (familyIds.includes(familyId) && !childrenInFamily.includes(personId)) {
        childrenInFamily.push(personId);
      }
    }

    for (const childId of childrenInFamily) {
      const child = personMap.get(childId);
      if (!child) continue;

      for (const spouseId of spousesInFamily) {
        addRelationshipIfNotExists(child, { type: 'parent', personId: spouseId });
        const spouse = personMap.get(spouseId);
        if (spouse) addRelationshipIfNotExists(spouse, { type: 'child', personId: childId });
      }

      if (family.husband) {
        addRelationshipIfNotExists(child, { type: 'parent', personId: family.husband });
        const husband = personMap.get(family.husband);
        if (husband) addRelationshipIfNotExists(husband, { type: 'child', personId: childId });
      }
      if (family.wife) {
        addRelationshipIfNotExists(child, { type: 'parent', personId: family.wife });
        const wife = personMap.get(family.wife);
        if (wife) addRelationshipIfNotExists(wife, { type: 'child', personId: childId });
      }
    }
  }

  return { rootPersonId: findRootPersonId(persons), persons };
}

function parseLine(line: string): GedcomLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+)\s+(@(\w+)@\s+)?(\w+)(\s+(.+))?$/);
  if (!match) return null;

  return {
    level: parseInt(match[1], 10),
    tag: match[4],
    value: match[6] || undefined,
    xref: match[3] || undefined,
  };
}

function parseIndividual(record: GedcomRecord, noteMap: Map<string, string> = new Map()): Person | null {
  if (!record.xref) return null;

  const person: Person = { id: record.xref, name: '', relationships: [], events: [] };

  // Name
  const nameRecord = record.children.find(c => c.type === 'NAME');
  if (nameRecord) {
    let fullName = (nameRecord.lines[0]?.value || '').replace(/\//g, '').trim();
    const givenRecord = nameRecord.children.find(c => c.type === 'GIVN');
    const surnRecord = nameRecord.children.find(c => c.type === 'SURN');
    if (givenRecord || surnRecord) {
      const given = givenRecord?.lines[0]?.value || '';
      const surn = surnRecord?.lines[0]?.value || '';
      person.name = [given, surn].filter(Boolean).join(' ').trim();
    } else {
      person.name = fullName || 'Unknown';
    }
  } else {
    person.name = 'Unknown';
  }

  // Gender
  const sexRecord = record.children.find(c => c.type === 'SEX' || c.type === 'GENDER');
  if (sexRecord) {
    const val = (sexRecord.lines[0]?.value || '').toUpperCase();
    person.gender = (val === 'M' ? 'M' : val === 'F' ? 'F' : 'U') as Gender;
  }

  // Recursively finds the first DATE value in a record tree (handles nested DATE structures)
  function findDateValue(r: GedcomRecord): string | undefined {
    if (r.lines[0]?.tag === 'DATE' && r.lines[0]?.value) return r.lines[0].value;
    for (const child of r.children) {
      const found = findDateValue(child);
      if (found) return found;
    }
    return undefined;
  }

  // Birth
  const birtRecord = record.children.find(c => c.type === 'BIRT' || c.type === 'BIRTH');
  if (birtRecord) {
    const dateRecord = birtRecord.children.find(c => c.type === 'DATE');
    if (dateRecord) person.birthDate = findDateValue(dateRecord);
    const placeRecord = birtRecord.children.find(c => c.type === 'PLACE');
    if (placeRecord) person.birthPlace = placeRecord.lines[0]?.value;
    const sourRecord = birtRecord.children.find(c => c.type === 'SOURCE' || c.type === 'SOUR');
    if (sourRecord) person.birthSource = sourRecord.lines[0]?.value;
  }

  // Non-standard direct birth/death date tags
  const birthDateRecord = record.children.find(c => c.type === 'BIRTH_DATE' || c.type === 'BIRTHDATE');
  if (birthDateRecord) person.birthDate = birthDateRecord.lines[0]?.value;
  const deathDateRecord = record.children.find(c => c.type === 'DEATH_DATE' || c.type === 'DEATHDATE');
  if (deathDateRecord) person.deathDate = deathDateRecord.lines[0]?.value;

  // Death
  const deatRecord = record.children.find(c => c.type === 'DEAT' || c.type === 'DEATH');
  if (deatRecord) {
    const dateRecord = deatRecord.children.find(c => c.type === 'DATE');
    if (dateRecord) person.deathDate = findDateValue(dateRecord);
    const placeRecord = deatRecord.children.find(c => c.type === 'PLACE');
    if (placeRecord) person.deathPlace = placeRecord.lines[0]?.value;
    const sourRecord = deatRecord.children.find(c => c.type === 'SOURCE' || c.type === 'SOUR');
    if (sourRecord) person.deathSource = sourRecord.lines[0]?.value;
  }

  // Religion
  const religionRecord = record.children.find(c => c.type === 'RELIGION');
  if (religionRecord) {
    const placeRecord = religionRecord.children.find(c => c.type === 'PLACE');
    person.religion = placeRecord?.lines[0]?.value || religionRecord.lines[0]?.value;
  }

  // Occupation
  const occupRecord = record.children.find(c => c.type === 'OCCUPATION');
  if (occupRecord) {
    const placeRecord = occupRecord.children.find(c => c.type === 'PLACE');
    person.occupation = placeRecord?.lines[0]?.value || occupRecord.lines[0]?.value;
  }

  // Events and custom tags
  for (const childRecord of record.children) {
    if (childRecord.type === 'EVEN' || childRecord.type === 'EVENT') {
      const event: Event = { type: '' };
      const typeRecord = childRecord.children.find(c => c.type === 'TYPE');
      if (typeRecord) event.type = typeRecord.lines[0]?.value || '';
      const dateRecord = childRecord.children.find(c => c.type === 'DATE');
      if (dateRecord) event.date = dateRecord.lines[0]?.value;
      const placeRecord = childRecord.children.find(c => c.type === 'PLACE');
      if (placeRecord) event.place = placeRecord.lines[0]?.value;
      const sourRecord = childRecord.children.find(c => c.type === 'SOURCE' || c.type === 'SOUR');
      if (sourRecord) event.source = sourRecord.lines[0]?.value;
      if (event.type) person.events!.push(event);
    }

    if (childRecord.type?.startsWith('_') && childRecord.lines[0]?.value) {
      person.events!.push({
        type: childRecord.type.replace(/^_/, ''),
        note: childRecord.lines[0].value,
      });
    }

    if (childRecord.type === 'NOTE') {
      const noteVal = childRecord.lines[0]?.value || '';
      const refMatch = noteVal.match(/^@(\w+)@$/);
      if (refMatch) {
        const noteText = noteMap.get(refMatch[1]);
        if (noteText) {
          if (!person.notes) person.notes = [];
          person.notes.push(noteText);
        }
      } else {
        const inlineText = assembleNoteText(childRecord);
        if (inlineText) {
          if (!person.notes) person.notes = [];
          person.notes.push(inlineText);
        }
      }
    }
  }

  return person;
}

function parseFamily(record: GedcomRecord): { husband?: string; wife?: string; children: string[] } | null {
  const family: { husband?: string; wife?: string; children: string[] } = { children: [] };

  for (const child of record.children) {
    const val = child.lines[0]?.value?.replace(/@/g, '');
    if (!val) continue;
    if (child.type === 'HUSB' || child.type === 'HUSBAND') family.husband = val;
    else if (child.type === 'WIFE') family.wife = val;
    else if (child.type === 'CHIL') family.children.push(val);
  }

  return family;
}

function addRelationshipIfNotExists(person: Person, relationship: { type: 'parent' | 'child' | 'spouse'; personId: string }) {
  if (!person.relationships.some(r => r.type === relationship.type && r.personId === relationship.personId)) {
    person.relationships.push(relationship);
  }
}
