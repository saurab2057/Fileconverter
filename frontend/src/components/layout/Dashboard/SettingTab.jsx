// src/components/layout/Dashboard/SettingTab.jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { profileUpdateSchema, changePasswordSchema } from '@/utils/validationSchemas';
import { authService } from '@/services/authService';
import { useToast } from '@/context/ToastContext';

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

const Input = ({ className = '', error, ...props }) => (
  <input
    className={`w-full px-3 py-2 text-[13px] border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-shadow ${
      error ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-600'
    } ${className}`}
    {...props}
  />
);

// ── Client-side image compression ────────────────────────
const compressImage = (file) =>
  new Promise((resolve) => {
    const MAX_BYTES = 700 * 1024;
    if (file.size <= MAX_BYTES) {
      resolve(file);
      return;
    }
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
        'image/jpeg',
        0.82
      );
    };
    img.src = url;
  });

const SettingsTab = () => {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const isGoogleUser = user?.authProvider !== 'email';

  // ── Profile state ──────────────────────────────────────
  const [picFile, setPicFile] = useState(null);
  const [picPreview, setPicPreview] = useState(user?.profilePictureUrl || '');
  const [profileSaving, setProfileSaving] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isDirty: profileDirty },
    reset: resetProfile,
  } = useForm({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { name: user?.name || '' },
  });

  // ── Password state ─────────────────────────────────────
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPicFile(compressed);
    setPicPreview(URL.createObjectURL(compressed));
  };

  const onProfileSubmit = async (data) => {
    setProfileSaving(true);
    try {
      let payload;
      if (picFile) {
        payload = new FormData();
        if (data.name !== user.name) payload.append('name', data.name.trim());
        payload.append('profilePicture', picFile);
      } else {
        payload = { name: data.name.trim() };
      }
      const res = await authService.updateProfile(payload);
      updateUser(res.user);
      setPicFile(null);
      resetProfile({ name: res.user.name });
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const onPasswordSubmit = async (data) => {
    setPwSaving(true);
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed. Signing you out...');
      resetPassword();
      setTimeout(() => logout(), 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  const isGoogleUrl = (url) => url?.includes('googleusercontent.com');

  return (
    <div className="space-y-4 max-w-2xl">
      {/* ── Profile ──────────────────────────────────────── */}
      <Card>
        <CardHeader title="Profile" description="Update your display name and photo" />

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

        <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Full name</Label>
                <Input
                  type="text"
                  placeholder="Your name"
                  error={profileErrors.name}
                  {...registerProfile('name')}
                />
                {profileErrors.name && (
                  <p className="text-xs text-red-500 mt-1">{profileErrors.name.message}</p>
                )}
              </div>
              <div>
                <Label>Email address</Label>
                <Input type="email" value={user?.email || ''} disabled />
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">Cannot be changed</p>
              </div>
            </div>
          </CardBody>

          <CardFooter>
            <button
              type="submit"
              disabled={profileSaving || (!profileDirty && !picFile)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium bg-gray-800 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {profileSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {profileSaving ? 'Saving…' : 'Save changes'}
            </button>
          </CardFooter>
        </form>
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
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
            <CardBody>
              <div className="space-y-4">
                <div>
                  <Label>Current password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="Enter current password"
                      error={passwordErrors.currentPassword}
                      className="pr-10"
                      {...registerPassword('currentPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordErrors.currentPassword && (
                    <p className="text-xs text-red-500 mt-1">{passwordErrors.currentPassword.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>New password</Label>
                    <div className="relative">
                      <Input
                        type={showNew ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        error={passwordErrors.newPassword}
                        className="pr-10"
                        {...registerPassword('newPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="text-xs text-red-500 mt-1">{passwordErrors.newPassword.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Confirm new password</Label>
                    <Input
                      type="password"
                      placeholder="Repeat new password"
                      error={passwordErrors.confirmNewPassword}
                      {...registerPassword('confirmNewPassword')}
                    />
                    {passwordErrors.confirmNewPassword && (
                      <p className="text-xs text-red-500 mt-1">{passwordErrors.confirmNewPassword.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>

            <CardFooter>
              <button
                type="submit"
                disabled={pwSaving}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium bg-gray-800 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {pwSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {pwSaving ? 'Updating…' : 'Update password'}
              </button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
};

export default SettingsTab;