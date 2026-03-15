import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';
import Header from '@/components/layout/Header';
import { formatDistanceToNow } from 'date-fns';
import {
    Settings, Loader2, AlertCircle, Calendar, Mail, Award, Camera,
    Save, X, RotateCw, AlertTriangle, FileText, FileImage,
    FileVideo, FileAudio, ChevronLeft, ChevronRight
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// React Query fetch functions
// ─────────────────────────────────────────────────────────────────────────────
const fetchHistory = async (page, limit) => {
    const res = await apiClient.get(`/api/history?page=${page}&limit=${limit}`);
    return res.data; // { history, total, page, limit, totalPages }
};

// ─────────────────────────────────────────────────────────────────────────────
// ProfileCard
// ─────────────────────────────────────────────────────────────────────────────
const ProfileCard = ({ user, isEditing, handleEditToggle, isSaving, handleSaveAllChanges, error, setError }) => {
    const [editForm, setEditForm] = useState({ name: '' });
    const [profilePicFile, setProfilePicFile] = useState(null);
    const [profilePicPreview, setProfilePicPreview] = useState(user?.profilePictureUrl || null);

    useEffect(() => {
        if (user) {
            setEditForm({ name: user.name || '' });
            setProfilePicPreview(user.profilePictureUrl || null);
        }
    }, [user]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePicFile(file);
            setProfilePicPreview(URL.createObjectURL(file));
        }
    };

    const onSave   = () => handleSaveAllChanges(editForm, profilePicFile);
    const onCancel = () => {
        setEditForm({ name: user?.name || '' });
        setProfilePicFile(null);
        setProfilePicPreview(user?.profilePictureUrl || null);
        setError(null);
        handleEditToggle();
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    const isGoogleUrl = (url) => url?.includes('googleusercontent.com');

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 transition-colors duration-300">
            <div className="text-center">

                {/* Profile Picture */}
                <div className="relative inline-block mb-6">
                    {user && (
                        <img
                            src={profilePicPreview || user.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=96`}
                            alt="Profile"
                            referrerPolicy={isGoogleUrl(profilePicPreview || user.profilePictureUrl) ? 'no-referrer' : 'strict-origin-when-cross-origin'}
                            onError={(e) => {
                                e.target.onerror = null;
                                const initials = encodeURIComponent(user.name.charAt(0).toUpperCase());
                                e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' rx='48' fill='%230D8ABC'/><text x='48' y='64' text-anchor='middle' font-size='40' fill='white' font-family='Arial'>${initials}</text></svg>`;
                            }}
                            className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white dark:border-gray-800 shadow-lg"
                        />
                    )}
                    {!isEditing && (
                        <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" />
                    )}
                    {isEditing && (
                        <>
                            <input
                                type="file"
                                id="profilePicUpload"
                                className="hidden"
                                accept="image/jpeg, image/png"
                                onChange={handleFileChange}
                                disabled={isSaving}
                            />
                            <label
                                htmlFor="profilePicUpload"
                                className="absolute bottom-0 right-0 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center cursor-pointer border-2 border-white dark:border-gray-800 transition-transform hover:scale-110"
                                title="Change picture"
                            >
                                <Camera className="w-4 h-4 text-white" />
                            </label>
                        </>
                    )}
                </div>

                {/* Name + Email */}
                <div className="space-y-2 mb-6">
                    {!isEditing ? (
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                    ) : (
                        <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full text-center text-2xl font-bold px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your name"
                            disabled={isSaving}
                        />
                    )}
                    <div className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-400">
                        <Mail className="w-4 h-4" />
                        <span>{user.email}</span>
                    </div>
                </div>

                {/* Stats */}
                <div className="space-y-3 mb-8">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Member Since</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(user.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <Award className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Files</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {user?.filesConverted?.toLocaleString() || '0'}
                        </span>
                    </div>
                </div>

                {/* Edit / Save / Cancel */}
                <div className="flex space-x-3">
                    {isEditing ? (
                        <>
                            <button
                                onClick={onSave}
                                disabled={isSaving}
                                className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{isSaving ? 'Saving...' : 'Save'}</span>
                            </button>
                            <button
                                onClick={onCancel}
                                disabled={isSaving}
                                className="flex-1 flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 px-3 rounded-lg text-sm font-medium transition-all"
                            >
                                <X className="w-4 h-4" />
                                <span>Cancel</span>
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleEditToggle}
                            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors shadow-sm"
                        >
                            <Settings className="w-4 h-4" />
                            <span>Edit Profile</span>
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mt-4 bg-red-100 border border-red-300 text-red-700 p-3 rounded-lg flex items-center space-x-2 text-sm text-left">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-800 font-bold">×</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pagination Controls
// ─────────────────────────────────────────────────────────────────────────────
const Pagination = ({ page, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    // Build page number array — show max 5 pages around current
    const getPages = () => {
        const pages = [];
        const start = Math.max(1, page - 2);
        const end   = Math.min(totalPages, page + 2);

        if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }

        return pages;
    };

    return (
        <div className="flex items-center justify-center space-x-1 px-4 py-4 border-t border-gray-100 dark:border-gray-700">

            {/* Prev */}
            <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page numbers */}
            {getPages().map((p, i) =>
                p === '...' ? (
                    <span key={`dot-${i}`} className="px-2 text-gray-400 dark:text-gray-500 text-sm">…</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                            p === page
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        {p}
                    </button>
                )
            )}

            {/* Next */}
            <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// RecentActivityList  —  uses React Query for caching + pagination
// ─────────────────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 5;

const RecentActivityList = () => {
    const [page, setPage] = useState(1);
    const queryClient = useQueryClient();

    // ── React Query ────────────────────────────────────────────────────────────
    // Cache key includes page so each page is cached independently.
    // staleTime: 2 min — won't refetch if you navigate away and back within 2min.
    // keepPreviousData: true — keeps old page visible while new page loads (no flash).
    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey:        ['history', page],
        queryFn:         () => fetchHistory(page, ITEMS_PER_PAGE),
        staleTime:       1000 * 60 * 2,   // 2 minutes
        keepPreviousData: true,
    });

    // Prefetch the next page in background when user is on current page
    useEffect(() => {
        if (data?.totalPages && page < data.totalPages) {
            queryClient.prefetchQuery({
                queryKey: ['history', page + 1],
                queryFn:  () => fetchHistory(page + 1, ITEMS_PER_PAGE),
                staleTime: 1000 * 60 * 2,
            });
        }
    }, [page, data?.totalPages, queryClient]);

    const history    = data?.history    || [];
    const total      = data?.total      || 0;
    const totalPages = data?.totalPages || 1;

    // ── Icon helpers ───────────────────────────────────────────────────────────
    const getFileIcon = (format) => {
        const fmt = format?.toLowerCase();
        if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(fmt)) return FileVideo;
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(fmt)) return FileImage;
        if (['mp3', 'wav', 'aac', 'flac'].includes(fmt)) return FileAudio;
        return FileText;
    };

    const getIconColor = (format) => {
        const fmt = format?.toLowerCase();
        if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(fmt))
            return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(fmt))
            return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
        if (['mp3', 'wav', 'aac', 'flac'].includes(fmt))
            return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
    };

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // ── Content ────────────────────────────────────────────────────────────────
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center p-12 text-gray-500 dark:text-gray-400">
                    <RotateCw className="w-6 h-6 animate-spin mr-3" />
                    <span>Loading activity...</span>
                </div>
            );
        }

        if (isError) {
            return (
                <div className="flex justify-center items-center p-12 text-red-600 bg-red-50 dark:bg-red-900/10 rounded-lg m-4">
                    <AlertTriangle className="w-6 h-6 mr-3" />
                    <span>Could not load recent activity.</span>
                </div>
            );
        }

        if (history.length === 0) {
            return (
                <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                    <p>You have no conversion history yet.</p>
                </div>
            );
        }

        return (
            <div className={`divide-y divide-gray-100 dark:divide-gray-700 transition-opacity duration-150 ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
                {history.map((item) => {
                    const IconComponent = getFileIcon(item.format);
                    const iconColor     = getIconColor(item.format);
                    return (
                        <div key={item._id} className="flex items-center space-x-4 p-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                                <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.filename}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Converted to <span className="font-semibold uppercase">{item.format}</span>
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDistanceToNow(new Date(item.processedAt), { addSuffix: true })}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                    {formatBytes(item.sizeInBytes)}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-300">

            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-200/50 dark:border-gray-700 flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recent Activity</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {total > 0 ? `${total} file${total !== 1 ? 's' : ''} processed` : 'Your latest file processing activities'}
                    </p>
                </div>
                {/* Subtle fetching indicator */}
                {isFetching && !isLoading && (
                    <RotateCw className="w-4 h-4 text-gray-400 animate-spin" />
                )}
            </div>

            {/* List */}
            {renderContent()}

            {/* Pagination — only shown when there's more than one page */}
            <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
            />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard (parent)
// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = () => {
    const { user, updateUser, isAuthenticated, authLoading } = useAuth();
    const navigate = useNavigate();

    const [error,     setError]     = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving,  setIsSaving]  = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) navigate('/');
    }, [isAuthenticated, authLoading, navigate]);

    const handleSaveAllChanges = async (editForm, profilePicFile) => {
        if (!editForm.name.trim()) { setError('Name cannot be empty.'); return; }
        setIsSaving(true);
        setError(null);
        try {
            let payload;
            if (profilePicFile) {
                payload = new FormData();
                if (editForm.name !== user.name) payload.append('name', editForm.name);
                payload.append('profilePicture', profilePicFile);
            } else {
                payload = { name: editForm.name };
            }
            const response = await apiClient.put('/api/user/profile', payload);
            updateUser(response.data.user);
            setIsEditing(false);
        } catch (err) {
            console.error('Profile update error:', err);
            setError(
                err.code === 'ERR_NETWORK'
                    ? 'Connection error. Please check internet.'
                    : err.response?.data?.message || 'Failed to update profile.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditToggle = () => {
        setIsEditing(prev => !prev);
        if (isEditing) setError(null);
    };

    if (authLoading || !isAuthenticated || !user) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <ProfileCard
                            user={user}
                            isEditing={isEditing}
                            handleEditToggle={handleEditToggle}
                            isSaving={isSaving}
                            handleSaveAllChanges={handleSaveAllChanges}
                            error={error}
                            setError={setError}
                        />
                    </div>
                    <div className="lg:col-span-2 space-y-8">
                        <RecentActivityList />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;