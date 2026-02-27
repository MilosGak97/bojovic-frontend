import { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { emailApi } from '../../api';
import type { EmailLog } from '../../domain/entities';
import { formatInSerbia } from '../../utils/serbia-time';

type EmailLogPanelProps = {
  relatedEntityType: string;
  relatedEntityId: string;
};

export function EmailLogPanel({ relatedEntityType, relatedEntityId }: EmailLogPanelProps) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailApi.getLogs({ relatedEntityType, relatedEntityId });
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch email logs', err);
    } finally {
      setLoading(false);
    }
  }, [relatedEntityType, relatedEntityId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (iso: string) => {
    return formatInSerbia(iso, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }, iso);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Email History</h3>
        <button
          type="button"
          onClick={fetchLogs}
          className="rounded-md bg-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-300"
        >
          <RefreshCw className="inline h-3 w-3" />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-xs text-slate-500">
          No emails sent for this record yet.
        </p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs font-semibold text-slate-900">
                      {log.subject}
                    </p>
                    <span className="ml-2 shrink-0 text-xs text-slate-400">
                      {formatDate(log.sentAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    From: {log.fromEmail} &rarr; To: {log.toEmails}
                  </p>
                  {log.ccEmails && (
                    <p className="text-xs text-slate-400">CC: {log.ccEmails}</p>
                  )}
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                    {log.body.replace(/<[^>]*>/g, '').slice(0, 200)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
