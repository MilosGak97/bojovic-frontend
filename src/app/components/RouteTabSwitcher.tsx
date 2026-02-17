import { Plus, Save, X, Pencil, Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface RouteVariant {
  id: string;
  name: string;
  savedAt: string;
}

interface RouteTabSwitcherProps {
  activeTab: string; // 'current' or variant ID
  variants: RouteVariant[];
  onTabChange: (tabId: string) => void;
  onRenameVariant: (variantId: string, newName: string) => void;
  onDeleteVariant: (variantId: string) => void;
  onDuplicateVariant: (variantId: string) => void;
  onDuplicateCurrent: () => void;
}

export function RouteTabSwitcher({
  activeTab,
  variants,
  onTabChange,
  onRenameVariant,
  onDeleteVariant,
  onDuplicateVariant,
  onDuplicateCurrent,
}: RouteTabSwitcherProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startEditing = (variant: RouteVariant, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(variant.id);
    setEditingName(variant.name);
  };

  const saveEdit = (variantId: string) => {
    if (editingName.trim()) {
      onRenameVariant(variantId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="bg-white border-b border-gray-300 px-6 py-0 flex items-center gap-6">
      {/* Current Route */}
      <div className="relative group">
        <button
          onClick={() => onTabChange('current')}
          className={`relative px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'current'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          Current Route
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateCurrent();
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-blue-100 rounded transition-opacity"
            title="Duplicate Current Route"
          >
            <Copy className="w-3 h-3 text-blue-600" />
          </button>
        </button>
      </div>

      {/* Variants */}
      {variants.map((variant) => (
        <div key={variant.id} className="relative group">
          {editingId === variant.id ? (
            <div className="flex items-center gap-1 px-2 py-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(variant.id);
                  if (e.key === 'Escape') cancelEdit();
                }}
                className="px-2 py-1 text-sm font-semibold border-2 border-blue-500 rounded w-24 focus:outline-none"
                autoFocus
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => saveEdit(variant.id)}
                className="p-1 hover:bg-green-100 rounded"
              >
                <Check className="w-3.5 h-3.5 text-green-600" />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onTabChange(variant.id)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === variant.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {variant.name}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateVariant(variant.id);
                  }}
                  className="p-0.5 hover:bg-green-100 rounded transition-opacity"
                  title="Duplicate"
                >
                  <Copy className="w-3 h-3 text-green-600" />
                </button>
                <button
                  onClick={(e) => startEditing(variant, e)}
                  className="p-0.5 hover:bg-blue-100 rounded transition-opacity"
                  title="Rename"
                >
                  <Pencil className="w-3 h-3 text-blue-600" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteVariant(variant.id);
                  }}
                  className="p-0.5 hover:bg-red-100 rounded transition-opacity"
                  title="Delete variant"
                >
                  <X className="w-3 h-3 text-red-600" />
                </button>
              </div>
            </button>
          )}
          
          {/* Tooltip */}
          {editingId !== variant.id && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Saved: {variant.savedAt}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}