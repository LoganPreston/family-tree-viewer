# Family Tree Viewer

A modern web application for visualizing and managing family trees. Built with Vue 3, TypeScript, and D3.js, this application provides an interactive, zoomable family tree visualization with support for GEDCOM and JSON file formats.

## Features

- **File Support**: Import family tree data from GEDCOM (.ged) or JSON files
- **Interactive Visualization**: Zoom and pan through large family trees with D3.js
- **Tree Navigation**: Click nodes to navigate through the tree, set different people as roots, and limit displayed generations
- **Search**: Search for family members by name and quickly jump to them
- **Connection Finder**: Find and highlight the shortest path between any two people in the family tree
- **Person Management**: Add, edit, and remove family members with detailed information (name, birth/death dates, gender, religion, occupation, events)
- **Relationship Tracking**: Automatic handling of parent-child and spouse relationships
- **Export**: Export your family tree data to JSON format
- **Client-Side Processing**: All data processing happens in the browser - no server required

## Technology Stack

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Pinia** - State management
- **D3.js** - Data visualization and tree layout
- **Vite** - Build tool and dev server

## Installation

This project uses `pnpm` for package management. Make sure you have Node.js and pnpm installed.

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Usage

1. **Upload a File**: Start by uploading a GEDCOM or JSON file containing your family tree data
2. **Navigate the Tree**: 
   - Click on any person to set them as the root of the tree
   - Use the "Back" button to navigate through previously selected roots
   - The tree displays up to 5 generations by default
3. **Search**: Use the "Search" button to find and jump to specific family members
4. **Find Connections**: Use "Find Connection" to select two people and see the path connecting them highlighted in the tree
5. **Edit People**: Double-click on a person's node to open the editor and modify their information
6. **Add People**: Use the "Add Person" button to create new family members
7. **Export**: Save your family tree data as JSON using the "Export JSON" button

## Supported File Formats

### GEDCOM (.ged)
Supports standard GEDCOM 5.5.1 format, including:
- Standard `INDI` and custom `INDIVIDUAL` record types
- `FAMILY_SPOUSE` and `FAMILY_CHILD` relationship references
- Birth and death dates (supports both `BIRT`/`BIRTH` and `DEAT`/`DEATH` tags)
- Gender, religion, and occupation information
- Event data with types, dates, and places

### JSON
Custom JSON format matching the application's data structure:
```json
{
  "rootPersonId": "optional-root-id",
  "persons": [
    {
      "id": "person-id",
      "name": "Full Name",
      "birthDate": "1 JAN 1900",
      "deathDate": "1 DEC 1990",
      "gender": "M",
      "religion": "Religion",
      "occupation": "Occupation",
      "relationships": [
        { "type": "parent", "personId": "parent-id" },
        { "type": "child", "personId": "child-id" },
        { "type": "spouse", "personId": "spouse-id" }
      ],
      "events": [
        {
          "type": "Event Type",
          "date": "1 JAN 1950",
          "place": "Location"
        }
      ]
    }
  ]
}
```

## Development

The project uses Vite for fast development with Hot Module Replacement (HMR). The main application code is in `src/`:

- `src/components/` - Vue components (TreeViewer, PersonEditor, FileUpload)
- `src/parsers/` - File format parsers (GEDCOM, JSON)
- `src/stores/` - Pinia state management
- `src/utils/` - Utility functions (tree layout, path finding, JSON export)
- `src/types/` - TypeScript type definitions

## License

This project is open source and available for personal and commercial use.

