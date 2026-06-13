import React from 'react';
import {
  FileText,
  MessageCircle,
  Sun,
  Moon,
  Users,
  Download,
  Copy,
  Play,
  Link2,
  Save,
  History,
} from 'lucide-react';

const Toolbar = ({
  onNewDocument,
  onCopyUrl,
  copyUrlFeedback,
  onSaveVersion,
  versionFeedback,
  onToggleVersionHistory,
  showVersionHistory,
  onToggleChat,
  onToggleTheme,
  onExecuteCode,
  theme,
  showChat,
  isExecuting,
}) => {
  return (
    <div className="flex items-center space-x-2">
      <ToolbarButton
        icon={<FileText className="w-4 h-4" />}
        label="New Document"
        onClick={onNewDocument}
        tooltip="Create a new document"
      />

      <ToolbarButton
        icon={<Save className="w-4 h-4" />}
        label={versionFeedback || 'Save Version'}
        onClick={onSaveVersion}
        isActive={!!versionFeedback}
        tooltip="Save a snapshot of the current document"
      />

      <ToolbarButton
        icon={<History className="w-4 h-4" />}
        label="History"
        onClick={onToggleVersionHistory}
        isActive={showVersionHistory}
        tooltip="View and restore saved versions"
      />

      <ToolbarButton
        icon={<Link2 className="w-4 h-4" />}
        label={copyUrlFeedback || 'Copy URL'}
        onClick={onCopyUrl}
        isActive={!!copyUrlFeedback}
        tooltip="Copy document link to clipboard"
      />

      <ToolbarButton
        icon={isExecuting ? (
          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        label={isExecuting ? 'Running...' : 'Run Code'}
        onClick={onExecuteCode}
        disabled={isExecuting}
        tooltip="Execute JavaScript code"
      />

      <div className="w-px h-6 bg-gray-300" />

      <ToolbarButton
        icon={<MessageCircle className="w-4 h-4" />}
        label="Chat"
        onClick={onToggleChat}
        isActive={showChat}
        tooltip="Toggle chat panel"
      />

      <ToolbarButton
        icon={theme === 'vs-dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        label={theme === 'vs-dark' ? 'Light' : 'Dark'}
        onClick={onToggleTheme}
        tooltip="Toggle theme"
      />

      <div className="w-px h-6 bg-gray-300" />

      <DropdownMenu />
    </div>
  );
};

const ToolbarButton = ({
  icon, label, onClick, isActive, tooltip, disabled,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
      ${isActive
        ? 'bg-green-100 text-green-800 border border-green-200'
        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
    `}
    title={tooltip}
    aria-label={tooltip}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const DropdownMenu = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
        aria-label="More options"
      >
        <span>More</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <DropdownItem icon={<Download className="w-4 h-4" />} label="Export Document" onClick={() => setIsOpen(false)} />
          <DropdownItem icon={<Copy className="w-4 h-4" />} label="Copy Content" onClick={() => setIsOpen(false)} />
          <div className="border-t border-gray-100 my-1" />
          <DropdownItem icon={<Users className="w-4 h-4" />} label="Keyboard Shortcuts" onClick={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
};

const DropdownItem = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default Toolbar;
