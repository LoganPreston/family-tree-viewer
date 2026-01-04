import type { Person, FamilyTree, Gender, Event } from '../types/family-tree';

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

export function parseGedcom(content: string): FamilyTree {
  const lines = content.split('\n').map(parseLine).filter(line => line !== null) as GedcomLine[];
  const records = buildRecordTree(lines);
  
  const persons: Person[] = [];
  const personMap = new Map<string, Person>();
  const families: Map<string, { husband?: string; wife?: string; children: string[] }> = new Map();
  // Track which families each person belongs to
  const personFamilySpouse = new Map<string, string[]>(); // personId -> familyIds where they're a spouse
  const personFamilyChild = new Map<string, string[]>(); // personId -> familyIds where they're a child
  
  // First pass: collect all individuals and families
  for (const record of records) {
    if (record.type === 'INDI' || record.type === 'INDIVIDUAL') {
      const person = parseIndividual(record);
      if (person) {
        persons.push(person);
        personMap.set(person.id, person);
        
        // Track FAMILY_SPOUSE and FAMILY_CHILD references
        const spouseFamilies: string[] = [];
        const childFamilies: string[] = [];
        
        // Check direct lines
        for (const line of record.lines) {
          if (line.tag === 'FAMILY_SPOUSE' && line.value) {
            const familyId = line.value.replace(/@/g, '');
            spouseFamilies.push(familyId);
          } else if (line.tag === 'FAMILY_CHILD' && line.value) {
            const familyId = line.value.replace(/@/g, '');
            childFamilies.push(familyId);
          }
        }
        
        // Check nested child records
        for (const childRecord of record.children) {
          if (childRecord.type === 'FAMILY_SPOUSE' || childRecord.lines.some(l => l.tag === 'FAMILY_SPOUSE')) {
            const familyId = findRelationshipId(childRecord);
            if (familyId) {
              spouseFamilies.push(familyId);
            }
          } else if (childRecord.type === 'FAMILY_CHILD' || childRecord.lines.some(l => l.tag === 'FAMILY_CHILD')) {
            const familyId = findRelationshipId(childRecord);
            if (familyId) {
              childFamilies.push(familyId);
            }
          }
        }
        
        if (spouseFamilies.length > 0) {
          personFamilySpouse.set(person.id, spouseFamilies);
        }
        if (childFamilies.length > 0) {
          personFamilyChild.set(person.id, childFamilies);
        }
      }
    } else if (record.type === 'FAM' || record.type === 'FAMILY') {
      // Standard GEDCOM family records (support both FAM and FAMILY)
      const family = parseFamily(record);
      if (family && record.xref) {
        families.set(record.xref, family);
      }
    }
  }
  
  // Second pass: process relationships
  // Handle standard FAM records
  for (const [, family] of families.entries()) {
    if (family.husband) {
      const husband = personMap.get(family.husband);
      if (husband && family.wife) {
        addRelationshipIfNotExists(husband, { type: 'spouse', personId: family.wife });
        const wife = personMap.get(family.wife);
        if (wife) {
          addRelationshipIfNotExists(wife, { type: 'spouse', personId: family.husband });
        }
      }
      if (husband) {
        family.children.forEach(childId => {
          addRelationshipIfNotExists(husband, { type: 'child', personId: childId });
          const child = personMap.get(childId);
          if (child && family.husband) {
            addRelationshipIfNotExists(child, { type: 'parent', personId: family.husband });
          }
        });
      }
    }
    
    if (family.wife) {
      const wife = personMap.get(family.wife);
      if (wife) {
        family.children.forEach(childId => {
          addRelationshipIfNotExists(wife, { type: 'child', personId: childId });
          const child = personMap.get(childId);
          if (child && family.wife) {
            addRelationshipIfNotExists(child, { type: 'parent', personId: family.wife });
          }
        });
      }
    }
  }
  
  // Handle FAMILY_SPOUSE and FAMILY_CHILD connections via family records
  // For each family, link all spouses together and link children to parents
  for (const [familyId, family] of families.entries()) {
    // Get all people who are spouses in this family
    const spousesInFamily: string[] = [];
    for (const [personId, familyIds] of personFamilySpouse.entries()) {
      if (familyIds.includes(familyId)) {
        spousesInFamily.push(personId);
      }
    }
    
    // Link all spouses together
    for (let i = 0; i < spousesInFamily.length; i++) {
      for (let j = i + 1; j < spousesInFamily.length; j++) {
        const spouse1 = personMap.get(spousesInFamily[i]);
        const spouse2 = personMap.get(spousesInFamily[j]);
        if (spouse1 && spouse2) {
          addRelationshipIfNotExists(spouse1, { type: 'spouse', personId: spousesInFamily[j] });
          addRelationshipIfNotExists(spouse2, { type: 'spouse', personId: spousesInFamily[i] });
        }
      }
    }
    
    // Also use the FAMILY record's HUSBAND/WIFE if available
    if (family.husband && family.wife) {
      const husband = personMap.get(family.husband);
      const wife = personMap.get(family.wife);
      if (husband && wife) {
        addRelationshipIfNotExists(husband, { type: 'spouse', personId: family.wife });
        addRelationshipIfNotExists(wife, { type: 'spouse', personId: family.husband });
      }
    }
    
    // Get all people who are children in this family
    const childrenInFamily: string[] = [];
    for (const [personId, familyIds] of personFamilyChild.entries()) {
      if (familyIds.includes(familyId)) {
        childrenInFamily.push(personId);
      }
    }
    
    // Also get children from the FAMILY record
    if (family.children) {
      family.children.forEach(childId => {
        if (!childrenInFamily.includes(childId)) {
          childrenInFamily.push(childId);
        }
      });
    }
    
    // Link children to all spouses in the family
    for (const childId of childrenInFamily) {
      const child = personMap.get(childId);
      if (!child) continue;
      
      // Link to spouses from FAMILY_SPOUSE
      for (const spouseId of spousesInFamily) {
        addRelationshipIfNotExists(child, { type: 'parent', personId: spouseId });
        const spouse = personMap.get(spouseId);
        if (spouse) {
          addRelationshipIfNotExists(spouse, { type: 'child', personId: childId });
        }
      }
      
      // Also link to HUSBAND/WIFE from FAMILY record
      if (family.husband) {
        addRelationshipIfNotExists(child, { type: 'parent', personId: family.husband });
        const husband = personMap.get(family.husband);
        if (husband) {
          addRelationshipIfNotExists(husband, { type: 'child', personId: childId });
        }
      }
      if (family.wife) {
        addRelationshipIfNotExists(child, { type: 'parent', personId: family.wife });
        const wife = personMap.get(family.wife);
        if (wife) {
          addRelationshipIfNotExists(wife, { type: 'child', personId: childId });
        }
      }
    }
  }
  
  // Find a person with no parents AND has children (true root of tree)
  let rootPersonId: string | undefined = undefined;
  
  // First, try to find someone with no parent relationships AND has children
  const personWithoutParentsWithChildren = persons.find(p => 
    !p.relationships.some(rel => rel.type === 'parent') &&
    p.relationships.some(rel => rel.type === 'child')
  );
  
  if (personWithoutParentsWithChildren) {
    rootPersonId = personWithoutParentsWithChildren.id;
  } else {
    // Fallback: find someone with no parents (even if no children)
    const personWithoutParents = persons.find(p => 
      !p.relationships.some(rel => rel.type === 'parent')
    );
    if (personWithoutParents) {
      rootPersonId = personWithoutParents.id;
    } else if (persons.length > 0) {
      // Final fallback: use first person if all have parents
      rootPersonId = persons[0].id;
    }
  }
  
  // Debug logging to verify parsing
  console.log('Parsed family tree:', {
    totalPersons: persons.length,
    personsWithSpouses: persons.filter(p => p.relationships.some(r => r.type === 'spouse')).length,
    allRelationships: persons.map(p => ({
      id: p.id,
      name: p.name,
      relationships: p.relationships
    }))
  });
  
  return {
    rootPersonId,
    persons
  };
}

function parseLine(line: string): GedcomLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  const match = trimmed.match(/^(\d+)\s+(@(\w+)@\s+)?(\w+)(\s+(.+))?$/);
  if (!match) return null;
  
  const level = parseInt(match[1], 10);
  const xref = match[3];
  const tag = match[4];
  const value = match[6];
  
  return {
    level,
    tag,
    value: value || undefined,
    xref: xref || undefined
  };
}

function buildRecordTree(lines: GedcomLine[]): GedcomRecord[] {
  const records: GedcomRecord[] = [];
  const stack: GedcomRecord[] = [];
  
  for (const line of lines) {
    if (line.level === 0) {
      const record: GedcomRecord = {
        type: line.tag,
        xref: line.xref,
        lines: [line],
        children: []
      };
      records.push(record);
      stack.length = 0;
      stack.push(record);
    } else {
      while (stack.length > line.level) {
        stack.pop();
      }
      
      if (stack.length > 0) {
        const current = stack[stack.length - 1];
        if (line.level === current.lines[current.lines.length - 1].level + 1) {
          current.lines.push(line);
        } else {
          const childRecord: GedcomRecord = {
            type: line.tag,
            lines: [line],
            children: []
          };
          current.children.push(childRecord);
          stack.push(childRecord);
        }
      }
    }
  }
  
  return records;
}

function parseIndividual(record: GedcomRecord): Person | null {
  if (!record.xref) return null;
  
  const person: Person = {
    id: record.xref,
    name: '',
    relationships: [],
    events: []
  };
  
  // Parse name - handle both standard NAME and structured names (GIVN, SURN)
  let givenName = '';
  let surname = '';
  let fullName = '';
  
  for (const line of record.lines) {
    if (line.tag === 'NAME') {
      fullName = line.value || '';
      // Remove slashes from GEDCOM name format (e.g., "John /Doe/" becomes "John Doe")
      fullName = fullName.replace(/\//g, '').trim();
    } else if (line.tag === 'SEX' || line.tag === 'GENDER') {
      const genderValue = (line.value || '').toUpperCase();
      person.gender = (genderValue === 'M' ? 'M' : genderValue === 'F' ? 'F' : 'U') as Gender;
    }
  }
  
  // Look for structured name components in child records
  for (const childRecord of record.children) {
    if (childRecord.lines.some(l => l.tag === 'GIVN')) {
      givenName = childRecord.lines.find(l => l.tag === 'GIVN')?.value || '';
    }
    if (childRecord.lines.some(l => l.tag === 'SURN')) {
      surname = childRecord.lines.find(l => l.tag === 'SURN')?.value || '';
    }
  }
  
  // Also check direct lines for GIVN and SURN
  for (const line of record.lines) {
    if (line.tag === 'GIVN') {
      givenName = line.value || '';
    } else if (line.tag === 'SURN') {
      surname = line.value || '';
    }
  }
  
  // Construct name: prefer structured name, fall back to full name
  if (givenName || surname) {
    person.name = [givenName, surname].filter(Boolean).join(' ').trim();
  } else {
    person.name = fullName || 'Unknown';
  }
  
  // Parse dates - look for BIRT/BIRTH and DEAT/DEATH events
  for (const childRecord of record.children) {
    if (childRecord.lines.some(l => l.tag === 'BIRT' || l.tag === 'BIRTH')) {
      // Birth event found, look for DATE in nested children
      for (const dateRecord of childRecord.children) {
        if (dateRecord.lines.some(l => l.tag === 'DATE')) {
          person.birthDate = dateRecord.lines.find(l => l.tag === 'DATE')?.value;
        }
      }
      // Also check direct lines in the BIRT/BIRTH record
      const birthDateLine = childRecord.lines.find(l => l.tag === 'DATE');
      if (birthDateLine?.value) {
        person.birthDate = birthDateLine.value;
      }
    } else if (childRecord.lines.some(l => l.tag === 'DEAT' || l.tag === 'DEATH')) {
      // Death event found
      for (const dateRecord of childRecord.children) {
        if (dateRecord.lines.some(l => l.tag === 'DATE')) {
          person.deathDate = dateRecord.lines.find(l => l.tag === 'DATE')?.value;
        }
      }
      const deathDateLine = childRecord.lines.find(l => l.tag === 'DATE');
      if (deathDateLine?.value) {
        person.deathDate = deathDateLine.value;
      }
    }
  }
  
  // Also check for direct DATE tags (non-standard but sometimes used)
  for (const line of record.lines) {
    if (line.tag === 'BIRTH_DATE' || line.tag === 'BIRTHDATE') {
      person.birthDate = line.value;
    } else if (line.tag === 'DEATH_DATE' || line.tag === 'DEATHDATE') {
      person.deathDate = line.value;
    }
  }
  
  // Parse RELIGION tag
  for (const line of record.lines) {
    if (line.tag === 'RELIGION') {
      person.religion = line.value;
    }
  }
  // Also check child records for RELIGION
  for (const childRecord of record.children) {
    for (const line of childRecord.lines) {
      if (line.tag === 'RELIGION') {
        person.religion = line.value;
      }
    }
  }
  
  // Parse OCCUPATION tag
  for (const line of record.lines) {
    if (line.tag === 'OCCUPATION') {
      // OCCUPATION value is the occupation itself
      person.occupation = line.value;
    }
  }
  // Also check child records for OCCUPATION (may have nested PLACE)
  for (const childRecord of record.children) {
    if (childRecord.lines.some(l => l.tag === 'OCCUPATION')) {
      const occupationLine = childRecord.lines.find(l => l.tag === 'OCCUPATION');
      if (occupationLine?.value) {
        person.occupation = occupationLine.value;
      }
      // Check for PLACE sub-tag (occupation location)
      // Note: We're storing just the occupation, not the place, as per Person interface
      // If needed, we could add occupationPlace field later
    }
  }
  
  // Parse EVENT records
  for (const childRecord of record.children) {
    // Check if this child record is an EVENT (type is EVENT or has EVENT tag in lines)
    if (childRecord.type === 'EVENT' || childRecord.lines.some(l => l.tag === 'EVENT')) {
      const event: Event = {
        type: '',
        date: undefined,
        place: undefined
      };
      
      // Parse TYPE, DATE, and PLACE from the EVENT record lines
      for (const eventLine of childRecord.lines) {
        if (eventLine.tag === 'TYPE') {
          event.type = eventLine.value || '';
        } else if (eventLine.tag === 'DATE') {
          event.date = eventLine.value;
        } else if (eventLine.tag === 'PLACE') {
          event.place = eventLine.value;
        }
      }
      
      // Also check nested children for DATE and PLACE (in case they're at level 3)
      for (const nestedRecord of childRecord.children) {
        for (const nestedLine of nestedRecord.lines) {
          if (nestedLine.tag === 'DATE') {
            event.date = nestedLine.value;
          } else if (nestedLine.tag === 'PLACE') {
            event.place = nestedLine.value;
          }
        }
      }
      
      // Only add event if it has a type
      if (event.type) {
        if (!person.events) {
          person.events = [];
        }
        person.events.push(event);
      }
    }
  }
  
  return person;
}

function parseFamily(record: GedcomRecord): { husband?: string; wife?: string; children: string[] } | null {
  const family: { husband?: string; wife?: string; children: string[] } = {
    children: []
  };
  
  // Check direct lines (support both HUSB and HUSBAND tags)
  for (const line of record.lines) {
    if ((line.tag === 'HUSB' || line.tag === 'HUSBAND') && line.value) {
      family.husband = line.value.replace(/@/g, '');
    } else if (line.tag === 'WIFE' && line.value) {
      family.wife = line.value.replace(/@/g, '');
    } else if (line.tag === 'CHIL' && line.value) {
      family.children.push(line.value.replace(/@/g, ''));
    }
  }
  
  // Also check child records (in case HUSB/WIFE/CHIL are nested)
  for (const childRecord of record.children) {
    for (const line of childRecord.lines) {
      if ((line.tag === 'HUSB' || line.tag === 'HUSBAND') && line.value) {
        family.husband = line.value.replace(/@/g, '');
      } else if (line.tag === 'WIFE' && line.value) {
        family.wife = line.value.replace(/@/g, '');
      } else if (line.tag === 'CHIL' && line.value) {
        family.children.push(line.value.replace(/@/g, ''));
      }
    }
  }
  
  return family;
}

// Helper function to find relationship ID from a record
function findRelationshipId(record: GedcomRecord): string | null {
  // First check if there's a value in the record lines
  for (const line of record.lines) {
    if (line.value) {
      // Check if it looks like an ID (contains @ or is a reference)
      const id = line.value.replace(/@/g, '').trim();
      if (id) {
        return id;
      }
    }
    // Also check xref
    if (line.xref) {
      return line.xref;
    }
  }
  
  // Check child records
  for (const child of record.children) {
    for (const line of child.lines) {
      if (line.value) {
        const id = line.value.replace(/@/g, '').trim();
        if (id) {
          return id;
        }
      }
      if (line.xref) {
        return line.xref;
      }
    }
  }
  
  // Check if the record itself has an xref
  if (record.xref) {
    return record.xref;
  }
  
  return null;
}

// Helper function to add relationship if it doesn't already exist
function addRelationshipIfNotExists(person: Person, relationship: { type: 'parent' | 'child' | 'spouse'; personId: string }) {
  const exists = person.relationships.some(
    rel => rel.type === relationship.type && rel.personId === relationship.personId
  );
  if (!exists) {
    person.relationships.push(relationship);
  }
}

