import { X, Upload, FileText } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg shadow-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Upload Freight PDF</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="border-2 border-dashed border-gray-300 p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              Drop PDF file here or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Supported format: PDF (max 10MB)
            </p>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              id="file-upload"
            />
          </div>

          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-gray-900">Recent Uploads</h3>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900">freight_offer_{i}.pdf</div>
                  <div className="text-xs text-gray-500">
                    {new Date().toLocaleDateString()} • 145 KB
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            Process Upload
          </button>
        </div>
      </div>
    </div>
  );
}
