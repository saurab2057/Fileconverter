import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, User, Mail, Shield, Calendar, Clock, MapPin, Globe,
    Monitor, Chrome, Hash, Smartphone, Laptop, Ban, CheckCircle,
    KeyRound, AlertCircle, Loader2,
} from 'lucide-react';
import apiClient from '@/lib/api';

const display = (value) => {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    return String(value);
};

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
};

/* ---------- Badges ---------- */

const RoleBadge = ({ role }) => {
    const isAdmin = role === 'admin';
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-all ${isAdmin
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                }`}
        >
            <Shield className="h-3 w-3" />
            {isAdmin ? 'Admin' : 'User'}
        </span>
    );
};

const StatusBadge = ({ status }) => {
    const isBanned = status === 'banned';
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-all ${isBanned
                    ? 'bg-rose-50 text-rose-700 ring-rose-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                }`}
        >
            {isBanned ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
            {isBanned ? 'Banned' : 'Active'}
        </span>
    );
};

/* ---------- Info Row ---------- */

const InfoRow = ({ icon, label, value, mono = false, capitalize = false }) => (
    <div className="group flex items-center justify-start gap-3 py-2.5 transition-colors hover:bg-slate-50/80 -mx-2 px-2 rounded-lg">
        <div className="flex flex-shrink-0 items-center gap-2.5 text-slate-500">
            <span className="flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-500">
                {icon}
            </span>
            <span className="whitespace-nowrap text-[13px] font-medium">
                {label}:
            </span>
        </div>
        <span
            className={`min-w-0 break-all text-left font-semibold text-slate-800 ${mono ? 'font-mono text-xs text-slate-600' : 'text-[13px]'
                } ${capitalize ? 'capitalize' : ''}`}
        >
            {display(value)}
        </span>
    </div>
);

/* ---------- Info Card ---------- */

const InfoCard = ({ icon, title, children, accent = 'slate' }) => {
    const accentMap = {
        slate: 'bg-slate-100 text-slate-600',
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        cyan: 'bg-cyan-50 text-cyan-600',
        amber: 'bg-amber-50 text-amber-600',
    };

    return (
        <section className="group/card overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover/card:scale-110 ${accentMap[accent]}`}>
                    {icon}
                </span>
                <h2 className="text-sm font-bold tracking-tight text-slate-800">
                    {title}
                </h2>
            </div>
            <div className="divide-y divide-slate-50 p-3">
                {children}
            </div>
        </section>
    );
};

/* ---------- Quick Stat ---------- */

const QuickStat = ({ icon, label, value, mono = false, accent = 'slate' }) => {
    const accentMap = {
        slate: { bg: 'bg-slate-50', text: 'text-slate-600' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
        cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
    };

    const a = accentMap[accent];

    return (
        <div className="group relative overflow-hidden px-5 py-4 transition-colors hover:bg-slate-50/60">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md ${a.bg} ${a.text} transition-transform group-hover:scale-110`}>
                    {React.cloneElement(icon, { className: 'h-3 w-3' })}
                </span>
                <span>{label}</span>
            </div>
            <p
                className={`mt-2 break-all text-sm font-bold text-slate-800 ${mono ? 'font-mono text-xs text-slate-600' : ''
                    }`}
            >
                {display(value)}
            </p>
        </div>
    );
};

/* ---------- Device Icon ---------- */

const getDeviceIcon = (type) => {
    const normalized = String(type || '').toLowerCase();
    if (normalized.includes('mobile') || normalized.includes('phone')) {
        return <Smartphone className="h-4 w-4" />;
    }
    if (normalized.includes('tablet')) {
        return <Monitor className="h-4 w-4" />;
    }
    return <Laptop className="h-4 w-4" />;
};

/* ---------- Skeleton ---------- */

const SkeletonRow = () => (
    <div className="flex items-center justify-between py-2.5">
        <div className="flex items-center gap-2.5">
            <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
    </div>
);

const SkeletonCard = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="space-y-1 p-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
        </div>
    </div>
);

/* ---------- Main Component ---------- */

const UserDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [metadata, setMetadata] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;

        const fetchUserDetails = async () => {
            try {
                setLoading(true);
                setError('');

                const response = await apiClient.get(
                    `/api/admin/users/details/${id}`
                );

                if (!mounted) return;

                setUser(response.data?.user || null);
                setMetadata(response.data?.metadata || null);
            } catch (err) {
                if (!mounted) return;

                console.error('Failed to fetch user details:', err);

                setError(
                    err.response?.data?.message ||
                    'Failed to load user details.'
                );
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        if (id) {
            fetchUserDetails();
        }

        return () => {
            mounted = false;
        };
    }, [id]);

    /* ----- Loading State ----- */
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50/50 p-6 lg:p-8">
                <div className="mx-auto max-w-5xl space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200" />
                        <div className="space-y-1.5">
                            <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
                            <div className="h-3 w-48 animate-pulse rounded bg-slate-200" />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex items-center gap-4 p-6">
                            <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                                <div className="h-3 w-56 animate-pulse rounded bg-slate-200" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                <div className="px-5 py-4">
                                    <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                                    <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                </div>
            </div>
        );
    }

    /* ----- Error State ----- */
    if (error || !user) {
        return (
            <div className="min-h-screen bg-slate-50/50 p-6 lg:p-8">
                <div className="mx-auto max-w-5xl space-y-5">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-md"
                            title="Back to users"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-slate-800">
                                User Details
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-5">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="pt-1">
                            <p className="text-sm font-bold text-rose-800">
                                Something went wrong
                            </p>
                            <p className="mt-0.5 text-sm text-rose-600">
                                {error || 'User not found.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const device = metadata?.device || {};
    const location = metadata?.location || {};
    const network = metadata?.network || {};

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 lg:p-8">
            <div className="mx-auto max-w-5xl space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-md active:scale-95"
                        title="Back to users"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold tracking-tight text-slate-800">
                            User Details
                        </h1>
                        <p className="mt-0.5 text-[13px] text-slate-500">
                            Account and security information
                        </p>
                    </div>
                </div>

                {/* Profile Card */}
                <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-center gap-4">
                        {user.profilePictureUrl ? (
                            <img
                                src={user.profilePictureUrl}
                                alt={user.name}
                                className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover shadow-lg"
                            />
                        ) : (
                            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 shadow-lg">
                                <User className="h-9 w-9" />
                            </div>
                        )}

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h2 className="truncate text-lg font-bold tracking-tight text-slate-800">
                                    {display(user.name)}
                                </h2>
                                <RoleBadge role={user.role} />
                                <StatusBadge status={user.status} />
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="break-all">
                                    {display(user.email)}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quick Stats */}
                <section className="grid grid-cols-1 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
                    <QuickStat
                        icon={<KeyRound />}
                        label="Auth"
                        value={user.authProvider}
                        accent="blue"
                    />
                    <QuickStat
                        icon={<Calendar />}
                        label="Joined"
                        value={formatDate(user.createdAt)}
                        accent="emerald"
                    />
                    <QuickStat
                        icon={<Clock />}
                        label="Updated"
                        value={formatDate(user.updatedAt)}
                        accent="amber"
                    />
                    <QuickStat
                        icon={<Hash />}
                        label="User ID"
                        value={user._id}
                        mono
                        accent="cyan"
                    />
                </section>

                {/* Banned Notice */}
                {user.status === 'banned' && (
                    <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                            <Ban className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-rose-800">
                                Account is banned
                            </p>
                            <p className="mt-0.5 text-xs text-rose-600">
                                Banned on {formatDate(user.bannedAt)}
                            </p>
                        </div>
                    </div>
                )}

                {/* Account / Location / Device */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <InfoCard
                        icon={<User className="h-4 w-4" />}
                        title="Account"
                        accent="blue"
                    >
                        <InfoRow
                            icon={<User className="h-4 w-4" />}
                            label="Name"
                            value={user.name}
                        />
                        <InfoRow
                            icon={<Mail className="h-4 w-4" />}
                            label="Email"
                            value={user.email}
                        />
                        <InfoRow
                            icon={<Shield className="h-4 w-4" />}
                            label="Role"
                            value={user.role}
                            capitalize
                        />
                        <InfoRow
                            icon={<CheckCircle className="h-4 w-4" />}
                            label="Status"
                            value={user.status}
                            capitalize
                        />
                    </InfoCard>

                    <InfoCard
                        icon={<MapPin className="h-4 w-4" />}
                        title="Location"
                        accent="emerald"
                    >
                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="Country"
                            value={location.country}
                        />
                        <InfoRow
                            icon={<MapPin className="h-4 w-4" />}
                            label="Region"
                            value={location.region}
                        />
                        <InfoRow
                            icon={<MapPin className="h-4 w-4" />}
                            label="City"
                            value={location.city}
                        />
                    </InfoCard>

                    <InfoCard
                        icon={getDeviceIcon(device.type)}
                        title="Device"
                        accent="cyan"
                    >
                        <InfoRow
                            icon={getDeviceIcon(device.type)}
                            label="Type"
                            value={device.type}
                            capitalize
                        />
                        <InfoRow
                            icon={<Chrome className="h-4 w-4" />}
                            label="Browser"
                            value={device.browser}
                        />
                        <InfoRow
                            icon={<Monitor className="h-4 w-4" />}
                            label="Operating System"
                            value={device.os}
                        />
                    </InfoCard>
                </div>

                {/* Network / Metadata */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <InfoCard
                        icon={<Globe className="h-4 w-4" />}
                        title="Network"
                        accent="amber"
                    >
                        <InfoRow
                            icon={<Hash className="h-4 w-4" />}
                            label="IP Hash"
                            value={metadata?.ipHash}
                            mono
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="ISP"
                            value={network.isp}
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="Organization"
                            value={network.organization}
                        />

                        <InfoRow
                            icon={<Hash className="h-4 w-4" />}
                            label="ASN"
                            value={network.asn}
                            mono
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="Connection"
                            value={network.connectionType}
                            capitalize
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="Proxy"
                            value={network.isProxy ? 'Detected' : 'No'}
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="VPN"
                            value={network.isVpn ? 'Detected' : 'No'}
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="Tor"
                            value={network.isTor ? 'Detected' : 'No'}
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="Hosting"
                            value={network.isHosting ? 'Detected' : 'No'}
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="Timezone"
                            value={metadata?.timezone}
                        />

                        <InfoRow
                            icon={<Globe className="h-4 w-4" />}
                            label="Country"
                            value={location.country}
                        />

                        <InfoRow
                            icon={<MapPin className="h-4 w-4" />}
                            label="City"
                            value={location.city}
                        />
                    </InfoCard>
                </div>

                {/* User Agent */}
                <InfoCard
                    icon={<Monitor className="h-4 w-4" />}
                    title="User Agent"
                    accent="slate"
                >
                    <div className="break-all rounded-xl bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-100">
                        {display(metadata?.userAgent)}
                    </div>
                </InfoCard>

                {/* Footer */}
                <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400">
                    {user.role === 'admin' ? (
                        <>
                            <Shield className="h-3.5 w-3.5" />
                            Administrator account
                        </>
                    ) : (
                        <>
                            <User className="h-3.5 w-3.5" />
                            Standard user account
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserDetails;