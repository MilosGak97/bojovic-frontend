export interface ConnectEmailAccountDto {
  label: string;
}

export interface SendEmailDto {
  accountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  templateId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface CreateEmailTemplateDto {
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateEmailTemplateDto {
  name?: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
  description?: string;
  isActive?: boolean;
}
