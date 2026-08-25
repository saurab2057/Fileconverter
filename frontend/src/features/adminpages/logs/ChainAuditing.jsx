import { useState } from 'react';
import { RefreshCw, Shield, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import apiClient from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const fetchChainStatus = async () => {
  const { data } = await apiClient.get('/api/admin/audit-logs/chain-status');
  return data;
};

const runVerifyChain = async (limit) => {
  const { data } = await apiClient.get('/api/admin/audit-logs/verify-chain', { params: { limit } });
  return data;
};

export default function ChainAuditingView() {
  const [expanded, setExpanded] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const { data: chainStatus, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['chainStatus'],
    queryFn: fetchChainStatus,
    refetchInterval: 5 * 60 * 1000,
  });

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await runVerifyChain(1000);
      setVerifyResult(result);
    } catch {
      setVerifyResult({ valid: false, message: 'Verification request failed.' });
    } finally {
      setVerifying(false);
    }
  };

  const statusIcon = () => {
    if (isLoading || isFetching) return <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />;
    if (!chainStatus) return <Shield className="w-4 h-4 text-gray-400" />;
    if (chainStatus.status === 'valid') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (chainStatus.status === 'empty') return <Shield className="w-4 h-4 text-gray-400" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  const statusLabel = () => {
    if (!chainStatus) return 'Unknown';
    const map = { valid: 'Intact', broken: 'BROKEN', empty: 'No logs', error: 'Error' };
    return map[chainStatus.status] ?? chainStatus.status;
  };

  const statusColour = () => {
    if (!chainStatus) return 'text-gray-500';
    const map = { valid: 'text-green-700', broken: 'text-red-700', empty: 'text-gray-500', error: 'text-amber-700' };
    return map[chainStatus.status] ?? 'text-gray-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
      >
        <div className="flex items-center gap-2">
          {statusIcon()}
          <span>Hash-chain integrity: <span className={`font-semibold ${statusColour()}`}>{statusLabel()}</span></span>
          {chainStatus?.checkedAt && <span className="text-gray-400 text-xs">(checked {new Date(chainStatus.checkedAt).toLocaleTimeString()})</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); refetch(); }} className="p-1 rounded hover:bg-gray-200 transition-colors" title="Refresh status">
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-4 bg-white text-sm">
          {chainStatus && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              {chainStatus.latestLogId && (
                <div>
                  <span className="text-gray-500">Latest log ID</span>
                  <p className="font-mono text-gray-800 truncate">{chainStatus.latestLogId}</p>
                </div>
              )}
              {chainStatus.logCount !== undefined && (
                <div>
                  <span className="text-gray-500">Logs verified</span>
                  <p className="font-medium text-gray-800">{chainStatus.logCount?.toLocaleString() ?? '—'}</p>
                </div>
              )}
              {chainStatus.status === 'broken' && (
                <div className="col-span-2 bg-red-50 border border-red-200 rounded p-2 text-red-700">
                  <strong>Chain broken.</strong> {chainStatus.message}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {verifying ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying…</> : <><Shield className="w-3.5 h-3.5" /> Run full verification (last 1000 logs)</>}
            </button>
          </div>
          {verifyResult && (
            <div className={`rounded-lg border p-3 text-xs ${verifyResult.valid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                {verifyResult.valid ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {verifyResult.valid ? 'Chain verified — no tampering detected' : 'Chain integrity failure'}
              </div>
              <p>{verifyResult.message}</p>
              {verifyResult.logCount !== undefined && (
                <p className="mt-1 text-gray-500">{verifyResult.logCount.toLocaleString()} logs checked · verified at {new Date(verifyResult.verifiedAt).toLocaleString()}</p>
              )}
              {!verifyResult.valid && verifyResult.brokenLogId && (
                <p className="mt-1">Broken at log ID: <span className="font-mono">{verifyResult.brokenLogId}</span></p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}