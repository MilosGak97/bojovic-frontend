import { BaseEntity } from './base.entity';
import { DocumentType, DocumentCategory } from '../enums';

export interface Document extends BaseEntity {
  documentType: DocumentType;
  category: DocumentCategory;
  title: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number | null;
  documentNumber: string | null;
  issuedAt: string | null;
  validUntil: string | null;
  notes: string | null;

  // Polymorphic references
  loadId: string | null;
  brokerId: string | null;
  driverId: string | null;
  vanId: string | null;
}

export interface DocumentUploadResult {
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number | null;
  url: string;
}
