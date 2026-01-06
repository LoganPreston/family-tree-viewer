import { setActivePinia, createPinia } from 'pinia';

export function setupPiniaForTesting() {
  setActivePinia(createPinia());
}

export function createMockFile(content: string, filename: string, mimeType: string): File {
  const blob = new Blob([content], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

export function createMockFileReader(result: string | ArrayBuffer | null): FileReader {
  const reader = {
    result: result,
    readyState: FileReader.DONE,
    error: null,
    onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
    onerror: null as ((event: ProgressEvent<FileReader>) => void) | null,
    readAsText: function(file: Blob) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: this.result } } as ProgressEvent<FileReader>);
        }
      }, 0);
    },
    readAsArrayBuffer: function(file: Blob) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: this.result } } as ProgressEvent<FileReader>);
        }
      }, 0);
    }
  } as unknown as FileReader;
  
  return reader;
}

