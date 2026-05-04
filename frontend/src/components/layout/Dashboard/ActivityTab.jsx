import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
    FileText, FileImage, FileVideo, FileAudio,
    RotateCw, AlertTriangle, ChevronLeft, ChevronRight,
    Trash2, X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '@/lib/api';

const LIMIT = 10;

const fetchHistory = (page) =>
    apiClient.get(`/api/history?page=${page}&limit=${LIMIT}`).then(r => r.data);

const deleteHistoryItems = (ids) =>
    apiClient.delete('/api/history', { data: { ids } });

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (format) => {
    const f = format?.toLowerCase();
    if (['mp4','mov','avi','webm','mkv'].includes(f)) return FileVideo;
    if (['jpg','jpeg','png','webp','gif','svg'].includes(f)) return FileImage;
    if (['mp3','wav','aac','flac'].includes(f)) return FileAudio;
    return FileText;
};

const getIconStyle = (format) => {
    const f = format?.toLowerCase();
    if (['mp4','mov','avi','webm','mkv'].includes(f))
        return 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400';
    if (['jpg','jpeg','png','webp','gif','svg'].includes(f))
        return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400';
    if (['mp3','wav','aac','flac'].includes(f))
        return 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400';
    return 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400';
};

const getTagStyle = (format) => {
    const f = format?.toLowerCase();
    if (['mp4','mov','avi','webm','mkv'].includes(f))
        return 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400';
    if (['jpg','jpeg','png','webp','gif','svg'].includes(f))
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400';
    if (['mp3','wav','aac','flac'].includes(f))
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400';
};

// ── Pagination (unchanged) ────────────────────────────────
const Pagination = ({ page, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pages = [];
    const start = Math.max(1, page - 2);
    const end   = Math.min(totalPages, page + 2);
    if (start > 1) { pages.push(1); if (start > 2) pages.push('…'); }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) { if (end < totalPages - 1) pages.push('…'); pages.push(totalPages); }

    return (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-200 dark:border-gray-700">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
                <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {pages.map((p, i) =>
                    p === '…' ? (
                        <span key={`dot-${i}`} className="px-1 text-gray-400 text-xs">…</span>
                    ) : (
                        <button key={p} onClick={() => onPageChange(p)}
                            className={`min-w-[28px] h-7 rounded-lg text-[12px] font-medium transition-colors ${
                                p === page
                                    ? 'bg-gray-800 dark:bg-white text-white dark:text-gray-900'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}>
                            {p}
                        </button>
                    )
                )}
                <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

// ── ActivityTab ───────────────────────────────────────────
const ActivityTab = () => {
    const [page, setPage] = useState(1);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const queryClient = useQueryClient();

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['history', page],
        queryFn: () => fetchHistory(page),
        staleTime: 1000 * 60 * 2,
        keepPreviousData: true,
    });

    useEffect(() => {
        if (data?.totalPages && page < data.totalPages) {
            queryClient.prefetchQuery({
                queryKey: ['history', page + 1],
                queryFn: () => fetchHistory(page + 1),
                staleTime: 1000 * 60 * 2,
            });
        }
    }, [page, data?.totalPages, queryClient]);

    // Reset selection when page changes or data refetched
    useEffect(() => {
        setSelectedIds(new Set());
    }, [page, data]);

    const deleteMutation = useMutation({
        mutationFn: deleteHistoryItems,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['history'] });
            setSelectedIds(new Set());
            setSelectMode(false);
        },
    });

    const history    = data?.history || [];
    const total      = data?.total   || 0;
    const totalPages = data?.totalPages || 1;

    const allSelectedOnPage = history.length > 0 && history.every(item => selectedIds.has(item._id));

    const toggleSelectAll = () => {
        if (allSelectedOnPage) {
            const newSelected = new Set(selectedIds);
            history.forEach(item => newSelected.delete(item._id));
            setSelectedIds(newSelected);
        } else {
            const newSelected = new Set(selectedIds);
            history.forEach(item => newSelected.add(item._id));
            setSelectedIds(newSelected);
        }
    };

    const toggleItem = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        deleteMutation.mutate([...selectedIds]);
    };

    const enterSelectMode = () => setSelectMode(true);
    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    return (
        <div className="max-w-3xl">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
                            Conversion history
                        </h3>
                        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {total > 0
                                ? `${total.toLocaleString()} file${total !== 1 ? 's' : ''} processed`
                                : 'No history yet'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {selectMode ? (
                            <>
                                <label className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={allSelectedOnPage}
                                        onChange={toggleSelectAll}
                                        className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-0"
                                    />
                                    Select all
                                </label>
                                <button
                                    onClick={handleDeleteSelected}
                                    disabled={selectedIds.size === 0 || deleteMutation.isLoading}
                                    className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-600
                                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    {deleteMutation.isLoading
                                        ? 'Deleting…'
                                        : `Delete (${selectedIds.size})`}
                                </button>
                                <button
                                    onClick={exitSelectMode}
                                    className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                {history.length > 0 && (
                                    <button
                                        onClick={enterSelectMode}
                                        className="flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Delete
                                    </button>
                                )}
                                {isFetching && !isLoading && (
                                    <RotateCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Body */}
                {isLoading ? (
                    <div className="flex justify-center items-center p-12 text-gray-400 gap-2 text-[13px]">
                        <RotateCw className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                ) : isError ? (
                    <div className="flex justify-center items-center p-12 text-red-500 gap-2 text-[13px]">
                        <AlertTriangle className="w-4 h-4" /> Could not load history.
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center p-12 text-[13px] text-gray-400 dark:text-gray-600">
                        No conversions yet. Start converting files from the menu above.
                    </div>
                ) : (
                    <div className={`divide-y divide-gray-100 dark:divide-gray-700/80 transition-opacity duration-150 ${
                        isFetching ? 'opacity-60' : 'opacity-100'
                    }`}>
                        {history.map(item => {
                            const IconComp = getFileIcon(item.format);
                            return (
                                <div
                                    key={item._id}
                                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                    {/* Checkbox (only in select mode) */}
                                    {selectMode && (
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item._id)}
                                            onChange={() => toggleItem(item._id)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-gray-800 dark:text-white focus:ring-0 flex-shrink-0"
                                        />
                                    )}

                                    {/* Icon */}
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getIconStyle(item.format)}`}>
                                        <IconComp className="w-3.5 h-3.5" />
                                    </div>

                                    {/* File info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
                                            {item.filename}
                                        </p>
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1.5">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${getTagStyle(item.format)}`}>
                                                {item.format}
                                            </span>
                                            <span className="font-mono">{formatBytes(item.sizeInBytes)}</span>
                                        </p>
                                    </div>

                                    {/* Timestamp */}
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                                        {formatDistanceToNow(new Date(item.processedAt), { addSuffix: true })}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}

                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
        </div>
    );
};

export default ActivityTab;