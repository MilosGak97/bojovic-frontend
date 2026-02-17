import { DocumentType, DocumentCategory } from '../enums';

export interface CreateDocumentDto {
  documentType: DocumentType;
  category: DocumentCategory;
  title: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes?: number;
  documentNumber?: string;
  issuedAt?: string;
  validUntil?: string;
  notes?: string;
  loadId?: string;
  brokerId?: string;
  driverId?: string;
  vanId?: string;
}

export type UpdateDocumentDto = Partial<CreateDocumentDto>;
