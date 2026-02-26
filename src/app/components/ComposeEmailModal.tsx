import { useCallback, useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { emailApi } from '../../api';
import type { EmailAccount, EmailTemplate } from '../../domain/entities';
import type { SendEmailDto } from '../../domain/dto';

type ComposeEmailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  defaultTo?: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  templateVariables?: Record<string, string>;
};

export function ComposeEmailModal({
  isOpen,
  onClose,
  onSent,
  defaultTo,
  relatedEntityType,
  relatedEntityId,
  templateVariables,
}: ComposeEmailModalProps) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [accs, tmpls] = await Promise.all([
        emailApi.getAccounts(),
        emailApi.getTemplates(),
      ]);
      setAccounts(accs.filter((a) => a.isConnected));
      setTemplates(tmpls.filter((t) => t.isActive));
      if (accs.length > 0) {
        const connected = accs.find((a) => a.isConnected);
        if (connected) setSelectedAccountId(connected.id);
      }
    } catch (err) {
      console.error('Failed to load email data', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setTo(defaultTo?.join(', ') ?? '');
      setCc('');
      setSubject('');
      setBody('');
      setSelectedTemplateId('');
      setError('');
    }
  }, [isOpen, defaultTo, fetchData]);

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    try {
      const rendered = await emailApi.renderTemplate(templateId, templateVariables ?? {});
      setSubject(rendered.subject);
      setBody(rendered.body);
    } catch (err) {
      console.error('Failed to render template', err);
    }
  };

  const handleSend = async () => {
    if (!selectedAccountId || !to.trim() || !subject.trim()) {
      setError('Account, To, and Subject are required.');
      return;
    }

    setSending(true);
    setError('');

    const toList = to.split(',').map((e) => e.trim()).filter(Boolean);
    const ccList = cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : undefined;

    const dto: SendEmailDto = {
      accountId: selectedAccountId,
      to: toList,
      cc: ccList,
      subject,
      body,
      templateId: selectedTemplateId || undefined,
      relatedEntityType,
      relatedEntityId,
    };

    try {
      await emailApi.send(dto);
      onSent?.();
      onClose();
    } catch (err) {
      console.error('Failed to send email', err);
      setError('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Compose Email</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 p-5">
          {/* From */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-medium text-slate-500">From</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.emailAddress})
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-medium text-slate-500">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* CC */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-medium text-slate-500">CC</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com (optional)"
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Template picker */}
          {templates.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="w-16 text-xs font-medium text-slate-500">Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">No template (free-form)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subject */}
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none"
          />

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email..."
            rows={10}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !selectedAccountId || !to.trim() || !subject.trim()}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
