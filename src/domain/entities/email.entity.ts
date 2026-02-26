import { BaseEntity } from './base.entity';

export interface EmailAccount extends BaseEntity {
  label: string;
  emailAddress: string;
  isConnected: boolean;
  avatarUrl: string | null;
}

export interface EmailLog extends BaseEntity {
  accountId: string;
  fromEmail: string;
  toEmails: string;
  ccEmails: string | null;
  subject: string;
  body: string;
  templateId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  sentAt: string;
  gmailMessageId: string | null;
  account?: EmailAccount;
}

export interface EmailTemplate extends BaseEntity {
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  description: string | null;
  isActive: boolean;
}
