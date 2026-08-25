import { useState } from 'react';
import { Shield, Activity, Link, AlertTriangle } from 'lucide-react';
import AuditLogsView from './AuditLogs';
import ActivityLogsView from './ActivityLogs';
import ChainAuditingView from './ChainAuditing';
import WafStatusView from './WafStatus';

export default function LogsManager() {
  const [activeTab, setActiveTab] = useState('audit');

  const tabs = [
    { id: 'audit', label: 'Audit Logs', icon: Shield },
    { id: 'activity', label: 'Activity Logs', icon: Activity },
    { id: 'chain', label: 'Chain Auditing', icon: Link },
    { id: 'waf', label: 'WAF Status', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Logs & Security</h2>
        <p className="text-sm text-gray-500 mt-1">Security trail, system integrity, and firewall monitoring.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'audit' && <AuditLogsView />}
          {activeTab === 'activity' && <ActivityLogsView />}
          {activeTab === 'chain' && <ChainAuditingView />}
          {activeTab === 'waf' && <WafStatusView />}
        </div>
      </div>
    </div>
  );
}