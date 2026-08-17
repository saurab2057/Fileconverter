import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Settings, Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import Header from '@/components/layout/Header/Header';

import ActivityTab from '@/components/layout/Dashboard/ActivityTab';
import SettingsTab from '@/components/layout/Dashboard/SettingTab';
import SecurityTab from '@/components/layout/Dashboard/SecurityTab';

const TABS = [
  { id: 'activity', label: 'Activity', Icon: Clock    },
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'security', label: 'Security', Icon: Shield   },
];

const PAGE_TITLES = {
  activity: 'Activity',
  settings: 'Settings',
  security: 'Security',
};

export const UserAvatar = ({ user, className = 'w-7 h-7' }) => {
  const isGoogle = user?.profilePictureUrl?.includes('googleusercontent.com');
  return (
    <img
      src={user?.profilePictureUrl || ''}
      alt={user?.name}
      referrerPolicy={isGoogle ? 'no-referrer' : 'strict-origin-when-cross-origin'}
      onError={(e) => {
        e.target.onerror = null;
        const initial = encodeURIComponent((user?.name || 'U').charAt(0).toUpperCase());
        e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' rx='20' fill='%236366f1'/><text x='20' y='27' text-anchor='middle' font-size='16' fill='white' font-family='system-ui'>${initial}</text></svg>`;
      }}
      className={`${className} rounded-full object-cover flex-shrink-0`}
    />
  );
};

// ── Sidebar (desktop only) ────────────────────────────────
const Sidebar = ({ user, activeTab, onTabChange }) => (
  <aside className="hidden md:flex flex-col w-[200px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto pt-3">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex items-center gap-2.5 w-full px-3 py-[7px] rounded-lg text-[13px] font-medium transition-colors duration-100 text-left
            ${activeTab === id
              ? 'bg-gray-100 dark:bg-gray-700/80 text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
        >
          <Icon className="w-[14px] h-[14px] flex-shrink-0" />
          {label}
        </button>
      ))}
    </nav>


  </aside>
);

// ── Mobile tab bar ────────────────────────────────────────
const MobileNav = ({ activeTab, onTabChange }) => (
  <div className="md:hidden flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    {TABS.map(({ id, label, Icon }) => (
      <button
        key={id}
        onClick={() => onTabChange(id)}
        className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors
          ${activeTab === id
            ? 'text-gray-900 dark:text-white'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </button>
    ))}
  </div>
);

// ── Dashboard shell ───────────────────────────────────────
const Dashboard = () => {
  const { user, isAuthenticated} = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('activity');

  useEffect(() => {
    if (!isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  if ( !isAuthenticated || !user) return null;

  const renderTab = () => {
    switch (activeTab) {
      case 'activity': return <ActivityTab />;
      case 'settings': return <SettingsTab />;
      case 'security': return <SecurityTab />;
      default:         return <ActivityTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 flex flex-col">

      {/* Your Header — theme toggle lives here */}
      <Header />

      <div className="flex flex-1 min-h-0">
        <Sidebar user={user} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile tab bar */}
          <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />

          <main className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto">
            {renderTab()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;