import type { FamilyTree, Person } from '../types/family-tree';

export function parseJson(content: string): FamilyTree {
  try {
    const data = JSON.parse(content);
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON: root must be an object');
    }
    
    // Validate structure
    if (!Array.isArray(data.persons)) {
      throw new Error('Invalid JSON: "persons" must be an array');
    }
    
    // Validate each person
    const persons: Person[] = [];
    for (const personData of data.persons) {
      const person = validatePerson(personData);
      persons.push(person);
    }
    
    // Validate rootPersonId if provided
    let rootPersonId: string | undefined = data.rootPersonId;
    if (rootPersonId && !persons.find(p => p.id === rootPersonId)) {
      throw new Error(`Invalid JSON: rootPersonId "${rootPersonId}" not found in persons array`);
    }
    
    // If no rootPersonId provided, set first person as root (will be overridden by store logic if needed)
    if (!rootPersonId && persons.length > 0) {
      // Try to find a person with no parents and has children (true root)
      const personWithoutParentsWithChildren = persons.find(p => 
        !p.relationships.some(rel => rel.type === 'parent') &&
        p.relationships.some(rel => rel.type === 'child')
      );
      
      if (personWithoutParentsWithChildren) {
        rootPersonId = personWithoutParentsWithChildren.id;
      } else {
        // Fallback: find someone with no parents
        const personWithoutParents = persons.find(p => 
          !p.relationships.some(rel => rel.type === 'parent')
        );
        if (personWithoutParents) {
          rootPersonId = personWithoutParents.id;
        } else {
          // Final fallback: use first person
          rootPersonId = persons[0].id;
        }
      }
    }
    
    return {
      rootPersonId,
      persons
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
    throw new Error('Failed to parse JSON: unknown error');
  }
}

function validatePerson(data: any): Person {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid person: must be an object');
  }
  
  if (!data.id || typeof data.id !== 'string') {
    throw new Error('Invalid person: "id" must be a non-empty string');
  }
  
  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Invalid person: "name" must be a non-empty string');
  }
  
  if (data.birthDate !== undefined && typeof data.birthDate !== 'string') {
    throw new Error('Invalid person: "birthDate" must be a string or undefined');
  }
  
  if (data.deathDate !== undefined && typeof data.deathDate !== 'string') {
    throw new Error('Invalid person: "deathDate" must be a string or undefined');
  }
  
  if (data.gender !== undefined && !['M', 'F', 'U'].includes(data.gender)) {
    throw new Error('Invalid person: "gender" must be "M", "F", "U", or undefined');
  }
  
  if (!Array.isArray(data.relationships)) {
    throw new Error('Invalid person: "relationships" must be an array');
  }
  
  if (data.events !== undefined && !Array.isArray(data.events)) {
    throw new Error('Invalid person: "events" must be an array or undefined');
  }
  
  if (data.religion !== undefined && typeof data.religion !== 'string') {
    throw new Error('Invalid person: "religion" must be a string or undefined');
  }
  
  if (data.occupation !== undefined && typeof data.occupation !== 'string') {
    throw new Error('Invalid person: "occupation" must be a string or undefined');
  }
  
  const relationships = data.relationships.map((rel: any) => {
    if (!rel || typeof rel !== 'object') {
      throw new Error('Invalid relationship: must be an object');
    }
    
    if (!['parent', 'child', 'spouse'].includes(rel.type)) {
      throw new Error('Invalid relationship: "type" must be "parent", "child", or "spouse"');
    }
    
    if (!rel.personId || typeof rel.personId !== 'string') {
      throw new Error('Invalid relationship: "personId" must be a non-empty string');
    }
    
    return {
      type: rel.type,
      personId: rel.personId
    };
  });
  
  const events = data.events?.map((event: any) => {
    if (!event || typeof event !== 'object') {
      throw new Error('Invalid event: must be an object');
    }
    
    if (!event.type || typeof event.type !== 'string') {
      throw new Error('Invalid event: "type" must be a non-empty string');
    }
    
    if (event.date !== undefined && typeof event.date !== 'string') {
      throw new Error('Invalid event: "date" must be a string or undefined');
    }
    
    if (event.place !== undefined && typeof event.place !== 'string') {
      throw new Error('Invalid event: "place" must be a string or undefined');
    }
    
    return {
      type: event.type,
      date: event.date,
      place: event.place
    };
  });
  
  return {
    id: data.id,
    name: data.name,
    birthDate: data.birthDate,
    deathDate: data.deathDate,
    gender: data.gender,
    relationships,
    events,
    religion: data.religion,
    occupation: data.occupation
  };
}

