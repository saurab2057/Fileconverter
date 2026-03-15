import { useState, useEffect } from 'react';
import { Camera, Save, Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';

// ── Shared card primitives ────────────────────────────────
const Card = ({ children }) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
    {children}
  </div>
);

const CardHeader = ({ title, description }) => (
  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
    <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h3>
    {description && (
      <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
    )}
  </div>
);

const CardBody = ({ children }) => (
  <div className="p-5">{children}</div>
);

const CardFooter = ({ children }) => (
  <div className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
    {children}
  </div>
);

// ── Form elements ─────────────────────────────────────────
const Label = ({ children }) => (
  <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
    {children}
  </label>
);

const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg
      placeholder:text-gray-400 dark:placeholder:text-gray-600
      focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-0 focus:border-transparent
      disabled:bg-gray-50 dark:disabled:bg-gray-800disabled:text-blue-400 dark:disabled:text-blue-400 disabled:cursor-not-allowed
      transition-shadow ${className}`}
    {...props}
  />
);

// ── Alert banner ──────────────────────────────────────────
const Alert = ({ type, message, onDismiss }) => {
  if (!message) return null;
  const ok = type === 'success';
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg text-[12px] border
      ${ok
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
      }`}
    >
      {ok
        ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      }
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-50 hover:opacity-100 font-bold leading-none text-base">×</button>
      )}
    </div>
  );
};

// ── Client-side image compression ────────────────────────
const compressImage = (file) =>
  new Promise((resolve) => {
    const MAX_BYTES = 700 * 1024;
    if (file.size <= MAX_BYTES) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const MAX_DIM = 1024;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', 0.82
      );
    };
    img.src = url;
  });

// ── SettingsTab ───────────────────────────────────────────
const SettingsTab = () => {
  const { user, updateUser, logout } = useAuth();
  const isGoogleUser = user?.authProvider !== 'email';

  // ── Profile ──────────────────────────────────────────
  const [name,          setName]          = useState(user?.name || '');
  const [picFile,       setPicFile]       = useState(null);
  const [picPreview,    setPicPreview]    = useState(user?.profilePictureUrl || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState({ type: '', text: '' });

  useEffect(() => { setName(user?.name || ''); }, [user?.name]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPicFile(compressed);
    setPicPreview(URL.createObjectURL(compressed));
  };

  const handleProfileSave = async () => {
    if (!name.trim()) {
      setProfileMsg({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }
    setProfileSaving(true);
    setProfileMsg({ type: '', text: '' });
    try {
      let payload;
      if (picFile) {
        payload = new FormData();
        if (name !== user.name) payload.append('name', name.trim());
        payload.append('profilePicture', picFile);
      } else {
        payload = { name: name.trim() };
      }
      const res = await apiClient.put('/api/user/profile', payload);
      updateUser(res.data.user);
      setPicFile(null);
      setProfileMsg({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const profileChanged = name !== user?.name || !!picFile;
  const isGoogleUrl = (url) => url?.includes('googleusercontent.com');

  // ── Password ─────────────────────────────────────────
  const [currentPw,   setCurrentPw]   = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [pwSaving,    setPwSaving]    = useState(false);
  const [pwMsg,       setPwMsg]       = useState({ type: '', text: '' });

  const handlePasswordChange = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg({ type: 'error', text: 'All fields are required.' });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPw === currentPw) {
      setPwMsg({ type: 'error', text: 'New password must differ from current.' });
      return;
    }
    setPwSaving(true);
    setPwMsg({ type: '', text: '' });
    try {
      await apiClient.post('/api/user/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setPwMsg({ type: 'success', text: 'Password changed. Signing you out…' });
      setTimeout(() => logout(), 1500);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">

      {/* ── Profile ──────────────────────────────────────── */}
      <Card>
        <CardHeader title="Profile" description="Update your display name and photo" />

        {/* Avatar row — no duplicate, just avatar + name + hint */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative flex-shrink-0">
            <img
              src={picPreview || user?.profilePictureUrl || ''}
              alt="Profile"
              referrerPolicy={isGoogleUrl(picPreview || user?.profilePictureUrl) ? 'no-referrer' : 'strict-origin-when-cross-origin'}
              onError={(e) => {
                e.target.onerror = null;
                const initial = encodeURIComponent((user?.name || 'U').charAt(0).toUpperCase());
                e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='52' height='52'><rect width='52' height='52' rx='26' fill='%236366f1'/><text x='26' y='34' text-anchor='middle' font-size='20' fill='white' font-family='system-ui'>${initial}</text></svg>`;
              }}
              className="w-13 h-13 w-[52px] h-[52px] rounded-full object-cover"
            />
            <label
              htmlFor="profilePicInput"
              className="absolute bottom-0 right-0 w-5 h-5 bg-gray-800 dark:bg-white rounded-full flex items-center justify-center cursor-pointer border-2 border-white dark:border-gray-900"
              title="Change photo"
            >
              <Camera className="w-2.5 h-2.5 text-white dark:text-gray-900" />
            </label>
            <input
              id="profilePicInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{user?.name}</p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
              {picFile ? `Ready to upload: ${picFile.name}` : 'Click the camera icon to change your photo'}
            </p>
          </div>
        </div>

        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Full name</Label>
              <Input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <Label>Email address</Label>
              <Input type="email" value={user?.email || ''} disabled />
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">Cannot be changed</p>
            </div>
          </div>

          {profileMsg.text && (
            <div className="mt-4">
              <Alert
                type={profileMsg.type}
                message={profileMsg.text}
                onDismiss={() => setProfileMsg({ type: '', text: '' })}
              />
            </div>
          )}
        </CardBody>

        <CardFooter>
          <button
            onClick={handleProfileSave}
            disabled={profileSaving || !profileChanged}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium bg-gray-800 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {profileSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {profileSaving ? 'Saving…' : 'Save changes'}
          </button>
        </CardFooter>
      </Card>

      {/* ── Change Password ───────────────────────────────── */}
      <Card>
        <CardHeader
          title="Change password"
          description={
            isGoogleUser
              ? 'Not available for Google accounts'
              : 'You will be signed out of all devices after updating'
          }
        />

        {isGoogleUser ? (
          <CardBody>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">
              Your account uses Google Sign-In — password management is handled by Google.
            </p>
          </CardBody>
        ) : (
          <>
            <CardBody>
              <div className="space-y-4">
                <div>
                  <Label>Current password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      placeholder="Enter current password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>New password</Label>
                    <div className="relative">
                      <Input
                        type={showNew ? 'text' : 'password'}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Confirm new password</Label>
                    <Input
                      type="password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>

                {pwMsg.text && (
                  <Alert
                    type={pwMsg.type}
                    message={pwMsg.text}
                    onDismiss={() => setPwMsg({ type: '', text: '' })}
                  />
                )}
              </div>
            </CardBody>

            <CardFooter>
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium bg-gray-800 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {pwSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {pwSaving ? 'Updating…' : 'Update password'}
              </button>
            </CardFooter>
          </>
        )}
      </Card>

    </div>
  );
};

export default SettingsTab;