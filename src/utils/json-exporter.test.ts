import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportToJson, downloadJson } from './json-exporter';
import { mockFamilyTree, mockPerson1 } from '../tests/utils/mock-data';

describe('json-exporter', () => {
  describe('exportToJson', () => {
    it('should export family tree to JSON', () => {
      const result = exportToJson(mockFamilyTree);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should preserve all person data', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      const json = exportToJson(tree);
      const parsed = JSON.parse(json);
      
      expect(parsed.persons[0].id).toBe(mockPerson1.id);
      expect(parsed.persons[0].name).toBe(mockPerson1.name);
      expect(parsed.persons[0].birthDate).toBe(mockPerson1.birthDate);
      expect(parsed.persons[0].birthPlace).toBe(mockPerson1.birthPlace);
      expect(parsed.persons[0].deathDate).toBe(mockPerson1.deathDate);
      expect(parsed.persons[0].gender).toBe(mockPerson1.gender);
      expect(parsed.persons[0].religion).toBe(mockPerson1.religion);
      expect(parsed.persons[0].occupation).toBe(mockPerson1.occupation);
    });

    it('should preserve relationships', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      const json = exportToJson(tree);
      const parsed = JSON.parse(json);
      
      expect(parsed.persons[0].relationships).toEqual(mockPerson1.relationships);
    });

    it('should preserve events', () => {
      const personWithEvents = {
        ...mockPerson1,
        events: [
          {
            type: 'Marriage',
            date: '1 JAN 1920',
            place: 'New York'
          }
        ]
      };
      const tree = {
        rootPersonId: 'person1',
        persons: [personWithEvents]
      };
      const json = exportToJson(tree);
      const parsed = JSON.parse(json);
      
      expect(parsed.persons[0].events).toBeDefined();
      expect(parsed.persons[0].events[0].type).toBe('Marriage');
      expect(parsed.persons[0].events[0].date).toBe('1 JAN 1920');
      expect(parsed.persons[0].events[0].place).toBe('New York');
    });

    it('should handle optional fields correctly', () => {
      const personMinimal = {
        id: 'person1',
        name: 'Test',
        relationships: []
      };
      const tree = {
        persons: [personMinimal]
      };
      const json = exportToJson(tree);
      const parsed = JSON.parse(json);
      
      expect(parsed.persons[0].id).toBe('person1');
      expect(parsed.persons[0].name).toBe('Test');
      expect(parsed.persons[0].birthDate).toBeUndefined();
      expect(parsed.persons[0].events).toBeUndefined();
    });

    it('should format JSON with 2-space indentation', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      const json = exportToJson(tree);
      
      // Check that it's formatted (has newlines and indentation)
      expect(json).toContain('\n');
      expect(json).toContain('  '); // 2-space indent
    });

    it('should preserve rootPersonId', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      const json = exportToJson(tree);
      const parsed = JSON.parse(json);
      
      expect(parsed.rootPersonId).toBe('person1');
    });

    it('should handle empty tree', () => {
      const tree = {
        persons: []
      };
      const json = exportToJson(tree);
      const parsed = JSON.parse(json);
      
      expect(parsed.persons).toHaveLength(0);
    });
  });

  describe('downloadJson', () => {
    let mockLink: HTMLAnchorElement;
    let mockAppendChild: ReturnType<typeof vi.fn>;
    let mockRemoveChild: ReturnType<typeof vi.fn>;
    let mockClick: ReturnType<typeof vi.fn>;
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    beforeEach(() => {
      // Mock DOM methods
      mockClick = vi.fn();
      mockLink = {
        href: '',
        download: '',
        click: mockClick
      } as unknown as HTMLAnchorElement;

      mockAppendChild = vi.fn().mockImplementation((node: Node) => node) as ReturnType<typeof vi.fn>;
      mockRemoveChild = vi.fn().mockImplementation((node: Node) => node) as ReturnType<typeof vi.fn>;
      
      // Mock document.createElement
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild as any);
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild as any);

      // Mock URL methods
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url') as ReturnType<typeof vi.fn>;
      mockRevokeObjectURL = vi.fn() as ReturnType<typeof vi.fn>;
      URL.createObjectURL = mockCreateObjectURL as typeof URL.createObjectURL;
      URL.revokeObjectURL = mockRevokeObjectURL as typeof URL.revokeObjectURL;
    });

    afterEach(() => {
      vi.restoreAllMocks();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('should create a blob with correct JSON content', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      
      downloadJson(tree);
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      const blobCall = mockCreateObjectURL.mock.calls[0][0];
      expect(blobCall).toBeInstanceOf(Blob);
      expect(blobCall.type).toBe('application/json');
    });

    it('should create a download link with correct filename', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      
      downloadJson(tree, 'custom-name.json');
      
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('custom-name.json');
    });

    it('should use default filename when not provided', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      
      downloadJson(tree);
      
      expect(mockLink.download).toBe('family-tree.json');
    });

    it('should append link to document body', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      
      downloadJson(tree);
      
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
    });

    it('should trigger click on link', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      
      downloadJson(tree);
      
      expect(mockClick).toHaveBeenCalled();
    });

    it('should remove link from document body', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      
      downloadJson(tree);
      
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
    });

    it('should revoke object URL', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      
      downloadJson(tree);
      
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should set correct href from blob URL', () => {
      const tree = {
        rootPersonId: 'person1',
        persons: [mockPerson1]
      };
      
      downloadJson(tree);
      
      expect(mockLink.href).toBe('blob:mock-url');
    });

    it('should handle empty tree', () => {
      const tree = {
        persons: []
      };
      
      downloadJson(tree);
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should handle complex tree structure', () => {
      downloadJson(mockFamilyTree);
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      const blobCall = mockCreateObjectURL.mock.calls[0][0];
      expect(blobCall).toBeInstanceOf(Blob);
      
      // The blob should contain JSON data
      expect(blobCall.size).toBeGreaterThan(0);
    });
  });
});

