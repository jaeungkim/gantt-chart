export interface FileType {
  id: string;
  ufId: string;
  name: string;
  size: number; // bytes
}

// ============ API ============

export interface RequestUploadFile {
  file: File;
  checksum?: string;
}

export interface ResponseUploadFile {
  id: number;
  ufId: string;
  extension: string;
  originalName: string;
  owner: string;
  reused: boolean;
}
