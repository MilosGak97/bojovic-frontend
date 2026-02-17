import { Upload, Settings, Bell, User } from 'lucide-react';

interface TopNavProps {
  onUploadClick: () => void;
}

export function TopNav({ onUploadClick }: TopNavProps) {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">VD</span>
          </div>
          <h1 className="font-semibold text-gray-900">Van Dispatch Planning Board</h1>
        </div>
        
        <div className="flex items-center gap-6 text-sm">
          <button className="text-gray-600 hover:text-gray-900 font-medium">
            Planning
          </button>
          <button className="text-gray-600 hover:text-gray-900">
            Routes
          </button>
          <button className="text-gray-600 hover:text-gray-900">
            Drivers
          </button>
          <button className="text-gray-600 hover:text-gray-900">
            Analytics
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={onUploadClick}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload Freight
        </button>
        <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100">
          <Bell className="w-5 h-5" />
        </button>
        <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100">
          <Settings className="w-5 h-5" />
        </button>
        <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100">
          <User className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
