import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Monitor, Smartphone, Tablet, Globe,
  RotateCw, AlertTriangle, CheckCircle,
  Trash2, LogOut, Shield, KeyRound,
  Plus, Pencil, X, Check, Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';
import { startRegistration } from '@simplewebauthn/browser';

// ─────────────────────────────────────────────────────────────
// API CALLS — Sessions
// ─────────────────────────────────────────────────────────────
const fetchSessions = () => apiClient.get('/api/auth/sessions').then(r => r.data);
const revokeSession = (id) => apiClient.delete(`/api/auth/sessions/${id}`);
const logoutAllDevices = () => apiClient.post('/api/auth/logout-all');

// ─────────────────────────────────────────────────────────────
// API CALLS — Passkeys
// ─────────────────────────────────────────────────────────────
const fetchPasskeys = () => apiClient.get('/api/passkeys').then(r => r.data);
const deletePasskey = (id) => apiClient.delete(`/api/passkeys/${id}`);
const renamePasskey = ({ id, label }) =>
  apiClient.patch(`/api/passkeys/${id}/label`, { label }).then(r => r.data);

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const parseDevice = (ua) => {
  if (!ua) return { name: 'Unknown device', Icon: Globe };
  let Icon = Monitor;
  if (/iphone|android.*mobile|mobile/i.test(ua)) Icon = Smartphone;
  let os = 'Unknown OS';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  let browser = 'Unknown browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\/\d/i.test(ua)) browser = 'Chrome';
  else if (/firefox\/\d/i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua)) browser = 'Safari';
  return { name: `${browser} on ${os}`, Icon };
};

// Pick icon based on passkey deviceType field
const passkeyIcon = (deviceType) => {
  if (deviceType === 'mobile') return Smartphone;
  if (deviceType === 'tablet') return Tablet;
  return Monitor;
};

// ─────────────────────────────────────────────────────────────
// PASSKEY CARD — single passkey row with rename + delete
// ─────────────────────────────────────────────────────────────
const PasskeyCard = ({ passkey, onRename, onDelete, isDeleting }) => {
  const [editing, setEditing] = useState(false);
  const [labelVal, setLabelVal] = useState(passkey.label);
  const [saving, setSaving] = useState(false);
  const DeviceIcon = passkeyIcon(passkey.deviceType);

  const handleSave = async () => {
    if (!labelVal.trim() || labelVal.trim() === passkey.label) {
      setEditing(false);
      setLabelVal(passkey.label);
      return;
    }
    setSaving(true);
    await onRename({ id: passkey._id, label: labelVal.trim() });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setLabelVal(passkey.label);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700/80 last:border-0">

      {/* Device icon */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
        <DeviceIcon className="w-3.5 h-3.5" />
      </div>

      {/* Label + device name + last used */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={labelVal}
            onChange={(e) => setLabelVal(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={50}
            className="w-full text-[13px] font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-0.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        ) : (
          <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
            {passkey.label}
          </p>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          {passkey.deviceName}
          <span className="mx-1.5 text-gray-300 dark:text-gray-700">·</span>
          {passkey.lastUsed
            ? `Last used ${formatDistanceToNow(new Date(passkey.lastUsed), { addSuffix: true })}`
            : 'Never used'
          }
          <span className="mx-1.5 text-gray-300 dark:text-gray-700">·</span>
          Added {formatDistanceToNow(new Date(passkey.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {editing ? (
          <>
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition-colors"
            >
              {saving
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Check className="w-3 h-3" />
              }
              Save
            </button>
            {/* Cancel */}
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </>
        ) : (
          <>
            {/* Rename */}
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              title="Rename passkey"
            >
              <Pencil className="w-3 h-3" />
              Rename
            </button>
            {/* Delete */}
            <button
              onClick={() => onDelete(passkey._id)}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors"
              title="Delete passkey"
            >
              {isDeleting
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Trash2 className="w-3 h-3" />
              }
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN SECURITY TAB
// ─────────────────────────────────────────────────────────────
const SecurityTab = () => {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [passkeyError, setPasskeyError] = useState('');
  const [passkeySuccess, setPasskeySuccess] = useState('');
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // ── Sessions ──────────────────────────────────────────────
  const { data: sessionData, isLoading: sessionsLoading, isError: sessionsError } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
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

  const sessions = sessionData?.sessions || [];
  const currentSession = sessions.find(s => s.current);
  const otherSessions = sessions.filter(s => !s.current);

  // ── Passkeys ──────────────────────────────────────────────
  const { data: passkeyData, isLoading: passkeysLoading, isError: passkeysError } = useQuery({
    queryKey: ['passkeys'],
    queryFn: fetchPasskeys,
    staleTime: 1000 * 60,
  });

  const renameMutation = useMutation({
    mutationFn: renamePasskey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passkeys'] }),
  });

  const passkeys = passkeyData?.passkeys || [];
  const atLimit = passkeys.length >= 5;

  // ─────────────────────────────────────────────────────────────
  // ADD PASSKEY
  // Step 1: GET challenge from server
  // Step 2: Browser shows biometric/PIN prompt
  // Step 3: POST credential back to server
  // ─────────────────────────────────────────────────────────────
  const handleAddPasskey = async () => {
    setPasskeyError('');
    setPasskeySuccess('');
    setRegistering(true);

    try {
      // Step 1 — get options from server
      const { data: options } = await apiClient.post('/api/passkeys/register/start');

      // Step 2 — browser prompt (biometric / PIN)
      let credential;
      try {
        credential = await startRegistration({ optionsJSON: options });
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setPasskeyError('Passkey prompt was cancelled.');
          return;
        }
        // NEW — browser blocked it because credential already exists
        if (err.name === 'InvalidStateError') {
          setPasskeyError(`A passkey for this device is already registered. You can rename it from the list.`);
          return;
        }
        // NEW — prompt timed out
        if (err.name === 'AbortError') {
          setPasskeyError('Passkey prompt timed out. Please try again.');
          return;
        }
        setPasskeyError('Your device does not support passkeys or the prompt failed.');
        return;
      }

      // Step 3 — send credential to server
      await apiClient.post('/api/passkeys/register/finish', { response: credential });

      setPasskeySuccess('Passkey added successfully.');
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });

    } catch (err) {
      setPasskeyError(err.response?.data?.message || 'Failed to add passkey. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DELETE PASSKEY
  // ─────────────────────────────────────────────────────────────
  const handleDeletePasskey = async (id) => {
    setPasskeyError('');
    setPasskeySuccess('');
    setDeletingId(id);
    try {
      await deletePasskey(id);
      setPasskeySuccess('Passkey removed.');
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
    } catch (err) {
      setPasskeyError(err.response?.data?.message || 'Failed to delete passkey.');
    } finally {
      setDeletingId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SESSION ROW
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-2xl">

      {/* ── PASSKEYS SECTION ────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
              Passkeys
            </h3>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
              {passkeys.length} of 5 passkeys registered — sign in with your device biometric or PIN
            </p>
          </div>
          <KeyRound className="w-4 h-4 text-gray-400 dark:text-gray-600" />
        </div>

        {/* Feedback messages */}
        {passkeySuccess && (
          <div className="mx-5 mt-4 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <p className="text-[12px] text-emerald-700 dark:text-emerald-400">{passkeySuccess}</p>
          </div>
        )}
        {passkeyError && (
          <div className="mx-5 mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-[12px] text-red-700 dark:text-red-400">{passkeyError}</p>
          </div>
        )}

        {/* Passkey list */}
        {passkeysLoading ? (
          <div className="flex justify-center items-center py-10 text-gray-400 gap-2 text-[13px]">
            <RotateCw className="w-4 h-4 animate-spin" /> Loading passkeys…
          </div>
        ) : passkeysError ? (
          <div className="flex justify-center items-center py-10 text-red-500 gap-2 text-[13px]">
            <AlertTriangle className="w-4 h-4" /> Could not load passkeys.
          </div>
        ) : passkeys.length === 0 ? (
          <p className="text-center py-8 text-[13px] text-gray-400 dark:text-gray-600">
            No passkeys registered yet.
          </p>
        ) : (
          passkeys.map((pk) => (
            <PasskeyCard
              key={pk._id}
              passkey={pk}
              onRename={renameMutation.mutateAsync}
              onDelete={handleDeletePasskey}
              isDeleting={deletingId === pk._id}
            />
          ))
        )}

        {/* Add passkey button */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/80">
          {atLimit ? (
            <p className="text-[12px] text-amber-600 dark:text-amber-400">
              Maximum of 5 passkeys reached. Delete one to add a new device.
            </p>
          ) : (
            <button
              onClick={handleAddPasskey}
              disabled={registering}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {registering
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for device…</>
                : <><Plus className="w-3.5 h-3.5" /> Add passkey</>
              }
            </button>
          )}
        </div>
      </div>

      {/* ── ACTIVE SESSIONS SECTION ─────────────────────────── */}
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

        {sessionsLoading ? (
          <div className="flex justify-center items-center py-10 text-gray-400 gap-2 text-[13px]">
            <RotateCw className="w-4 h-4 animate-spin" /> Loading sessions…
          </div>
        ) : sessionsError ? (
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

      {/* ── SIGN OUT EVERYWHERE ──────────────────────────────── */}
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