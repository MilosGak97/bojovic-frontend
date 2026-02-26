import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, RefreshCw, Trash2, Unplug, X } from 'lucide-react';
import { emailApi } from '../api';
import type { EmailAccount, EmailTemplate } from '../domain/entities';
import type { CreateEmailTemplateDto } from '../domain/dto';
import { ThinModuleMenu } from './components/ThinModuleMenu';

type SettingsTab = 'accounts' | 'templates';

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'accounts', label: 'Email Accounts' },
  { id: 'templates', label: 'Email Templates' },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'accounts';
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  // ─── Accounts ──────────────────────────────────────────
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [connectLabel, setConnectLabel] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const data = await emailApi.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch email accounts', err);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleConnect = async () => {
    if (!connectLabel.trim()) return;
    try {
      const { authUrl } = await emailApi.connectAccount({ label: connectLabel.trim() });
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to start OAuth flow', err);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await emailApi.disconnectAccount(id);
      await fetchAccounts();
    } catch (err) {
      console.error('Failed to disconnect account', err);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await emailApi.deleteAccount(id);
      await fetchAccounts();
    } catch (err) {
      console.error('Failed to delete account', err);
    }
  };

  // ─── Templates ─────────────────────────────────────────
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateDraft, setTemplateDraft] = useState<CreateEmailTemplateDto>({
    name: '',
    subjectTemplate: '',
    bodyTemplate: '',
    description: '',
    isActive: true,
  });

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await emailApi.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to fetch email templates', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateDraft({ name: '', subjectTemplate: '', bodyTemplate: '', description: '', isActive: true });
    setShowTemplateForm(true);
  };

  const openEditTemplate = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setTemplateDraft({
      name: t.name,
      subjectTemplate: t.subjectTemplate,
      bodyTemplate: t.bodyTemplate,
      description: t.description ?? '',
      isActive: t.isActive,
    });
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await emailApi.updateTemplate(editingTemplate.id, templateDraft);
      } else {
        await emailApi.createTemplate(templateDraft);
      }
      setShowTemplateForm(false);
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to save template', err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await emailApi.deleteTemplate(id);
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template', err);
    }
  };

  const handleTabChange = (t: SettingsTab) => {
    setTab(t);
    setSearchParams({ tab: t });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <ThinModuleMenu />

      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Settings</h1>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-slate-200 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Accounts Tab ─────────────────────────────── */}
        {tab === 'accounts' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Connected Google Accounts</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchAccounts}
                  className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
                >
                  <RefreshCw className="inline h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowConnectForm(true)}
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Connect Account
                </button>
              </div>
            </div>

            {showConnectForm && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-800">Connect Google Account</span>
                  <button type="button" onClick={() => setShowConnectForm(false)}>
                    <X className="h-4 w-4 text-blue-600" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Account label (e.g. Milan, Office)"
                    value={connectLabel}
                    onChange={(e) => setConnectLabel(e.target.value)}
                    className="flex-1 rounded-md border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  />
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={!connectLabel.trim()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Authorize with Google
                  </button>
                </div>
              </div>
            )}

            {loadingAccounts ? (
              <p className="text-sm text-slate-500">Loading accounts...</p>
            ) : accounts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
                No email accounts connected yet. Click "Connect Account" to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {acc.avatarUrl ? (
                        <img
                          src={acc.avatarUrl}
                          alt={acc.label}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                          {acc.label.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{acc.label}</p>
                        <p className="text-xs text-slate-500">
                          {acc.emailAddress || 'Pending authorization'}
                        </p>
                      </div>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                          acc.isConnected
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {acc.isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {acc.isConnected && (
                        <button
                          type="button"
                          onClick={() => handleDisconnect(acc.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-orange-600"
                          title="Disconnect"
                        >
                          <Unplug className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Templates Tab ────────────────────────────── */}
        {tab === 'templates' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Email Templates</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchTemplates}
                  className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
                >
                  <RefreshCw className="inline h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={openNewTemplate}
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> New Template
                </button>
              </div>
            </div>

            {showTemplateForm && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">
                    {editingTemplate ? 'Edit Template' : 'New Template'}
                  </span>
                  <button type="button" onClick={() => setShowTemplateForm(false)}>
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Template name"
                    value={templateDraft.name}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Subject template (use {{variable}} for placeholders)"
                    value={templateDraft.subjectTemplate}
                    onChange={(e) =>
                      setTemplateDraft({ ...templateDraft, subjectTemplate: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <textarea
                    placeholder="Body template (use {{variable}} for placeholders)"
                    value={templateDraft.bodyTemplate}
                    onChange={(e) =>
                      setTemplateDraft({ ...templateDraft, bodyTemplate: e.target.value })
                    }
                    rows={6}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={templateDraft.description ?? ''}
                    onChange={(e) =>
                      setTemplateDraft({ ...templateDraft, description: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={templateDraft.isActive ?? true}
                        onChange={(e) =>
                          setTemplateDraft({ ...templateDraft, isActive: e.target.checked })
                        }
                        className="rounded"
                      />
                      Active
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">
                    Available variables:{' '}
                    <span className="font-mono">
                      {'{{referenceNumber}}, {{brokerName}}, {{pickupCity}}, {{deliveryCity}}, {{contactPerson}}'}
                    </span>
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplateForm(false)}
                      className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={!templateDraft.name.trim() || !templateDraft.subjectTemplate.trim()}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {editingTemplate ? 'Update' : 'Create'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingTemplates ? (
              <p className="text-sm text-slate-500">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
                No email templates yet. Click "New Template" to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {t.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEditTemplate(t)}
                          className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {t.description && (
                      <p className="mt-1 text-xs text-slate-500">{t.description}</p>
                    )}
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      Subject: {t.subjectTemplate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
