import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone, Globe, RotateCw, AlertTriangle,
         CheckCircle, Trash2, LogOut, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';

const fetchSessions    = () => apiClient.get('/api/auth/sessions').then(r => r.data);
const revokeSession    = (id) => apiClient.delete(`/api/auth/sessions/${id}`);
const logoutAllDevices = () => apiClient.post('/api/auth/logout-all');

const parseDevice = (ua) => {
  if (!ua) return { name: 'Unknown device', Icon: Globe };
  let Icon = Monitor;
  if (/iphone|android.*mobile|mobile/i.test(ua)) Icon = Smartphone;
  let os = 'Unknown OS';
  if (/windows nt/i.test(ua))       os = 'Windows';
  else if (/mac os x/i.test(ua))    os = 'macOS';
  else if (/linux/i.test(ua))       os = 'Linux';
  else if (/android/i.test(ua))     os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  let browser = 'Unknown browser';
  if (/edg\//i.test(ua))             browser = 'Edge';
  else if (/chrome\/\d/i.test(ua))   browser = 'Chrome';
  else if (/firefox\/\d/i.test(ua))  browser = 'Firefox';
  else if (/safari\//i.test(ua))     browser = 'Safari';
  return { name: `${browser} on ${os}`, Icon };
};

const SecurityTab = () => {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey:  ['sessions'],
    queryFn:   fetchSessions,
    staleTime: 1000 * 60,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const logoutAllMutation = useMutation({
    mutationFn: logoutAllDevices,
    onSuccess: () => logout(false),
  });

  const sessions       = data?.sessions || [];
  const currentSession = sessions.find(s => s.current);
  const otherSessions  = sessions.filter(s => !s.current);

  const renderSession = (s, isCurrent) => {
    const { name: deviceName, Icon: DeviceIcon } = parseDevice(s.device);
    return (
      <div key={s.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700/80 last:border-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
          ${isCurrent
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          <DeviceIcon className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-medium text-gray-900 dark:text-white">{deviceName}</p>
            {isCurrent && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="w-2.5 h-2.5" /> Current
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            Active {formatDistanceToNow(new Date(s.lastActive), { addSuffix: true })}
            <span className="mx-1.5 text-gray-300 dark:text-gray-700">·</span>
            Started {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
          </p>
        </div>

        {!isCurrent && (
          <button
            onClick={() => revokeMutation.mutate(s.id)}
            disabled={revokeMutation.isPending && revokeMutation.variables === s.id}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors"
            title="Revoke session"
          >
            {revokeMutation.isPending && revokeMutation.variables === s.id
              ? <RotateCw className="w-3 h-3 animate-spin" />
              : <Trash2 className="w-3 h-3" />
            }
            Revoke
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Active sessions */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
              Active sessions
            </h3>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} across your devices
            </p>
          </div>
          <Shield className="w-4 h-4 text-gray-400 dark:text-gray-600" />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-10 text-gray-400 gap-2 text-[13px]">
            <RotateCw className="w-4 h-4 animate-spin" /> Loading sessions…
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center py-10 text-red-500 gap-2 text-[13px]">
            <AlertTriangle className="w-4 h-4" /> Could not load sessions.
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center py-10 text-[13px] text-gray-400 dark:text-gray-600">
            No active sessions found.
          </p>
        ) : (
          <>
            {currentSession && renderSession(currentSession, true)}
            {otherSessions.map(s => renderSession(s, false))}
          </>
        )}
      </div>

      {/* Sign out everywhere */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
            Sign out everywhere
          </h3>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
            Revoke all sessions — use this if your account may be compromised.
          </p>
        </div>
        <div className="px-5 py-4">
          <button
            onClick={() => logoutAllMutation.mutate()}
            disabled={logoutAllMutation.isPending}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {logoutAllMutation.isPending
              ? <RotateCw className="w-3.5 h-3.5 animate-spin" />
              : <LogOut className="w-3.5 h-3.5" />
            }
            {logoutAllMutation.isPending ? 'Signing out…' : 'Sign out of all devices'}
          </button>
        </div>
      </div>

    </div>
  );
};

export default SecurityTab;