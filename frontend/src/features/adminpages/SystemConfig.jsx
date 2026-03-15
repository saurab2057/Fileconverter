import React, { useState, useEffect, useCallback } from 'react'; // Keep useState, useEffect for local form state, remove useCallback if not used elsewhere
import apiClient from '@/lib/api';
import { Save, RefreshCw, Shield, Database, Globe, Bell } from 'lucide-react';

// --- NEW IMPORTS FROM REACT QUERY ---
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- 1. Define your data fetching function outside the component ---
// This function will be called by useQuery. It should return a Promise.
const fetchSystemConfig = async () => {
  const { data } = await apiClient.get('/api/admin/config');
  return data;
};

// --- 2. Define your data update function (for useMutation) ---
// This function will be called by useMutation when you save changes.
const updateSystemConfig = async (newConfigData) => {
  const { data } = await apiClient.put('/api/admin/config', newConfigData);
  return data;
};

const SystemConfig = () => {
  // Get the QueryClient instance to interact with the cache
  const queryClient = useQueryClient();

  // --- 3. Use useQuery to fetch the initial configuration ---
  const {
    data: fetchedConfig, // 'data' from useQuery will be your fetched config
    isLoading,         // true while fetching
    isError,           // true if fetch failed
    error: fetchError, // error object if fetch failed
    // isFetching // Can be used to show a spinner during background refetches
  } = useQuery({
    queryKey: ['systemConfig'], // Unique key for this data in the cache
    queryFn: fetchSystemConfig,  // The function that fetches the data
    // Optional: onSuccess can be used to set initial form state
    onSuccess: (data) => {
      // Initialize local config state from fetched data only if it's the first fetch
      // or if we explicitly want to reset it on successful fetch
      if (!config || JSON.stringify(config) !== JSON.stringify(data)) {
        setConfig(data);
      }
      setInitialConfig(data); // Store this as the baseline for reset
      setHasChanges(false); // No changes initially
    },
    // Optional: onError can be used for more specific error handling if needed
    onError: (err) => {
      console.error("Failed to load system configuration:", err);
      // You can still set an error message in local state if you want,
      // but useQuery handles the basic error state for rendering.
    }
  });

  // --- 4. Use useMutation for saving changes ---
  const {
    mutate: saveConfig, // The function to call to trigger the mutation
    isLoading: isSaving, // true while the save operation is in progress
    isError: isSaveError, // true if the save operation failed
    error: saveError, // error object if save failed
  } = useMutation({
    mutationFn: updateSystemConfig, // The function that sends data to the server
    onSuccess: (data) => {
      // Invalidate the 'systemConfig' query cache after a successful update.
      // This tells React Query that the data for 'systemConfig' is stale
      // and should be refetched next time it's requested (or immediately if active).
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
      setInitialConfig(data); // Update initialConfig to the newly saved data
      setHasChanges(false);
      alert('Configuration saved successfully!');
    },
    onError: (err) => {
      console.error('Failed to save configuration:', err);
      alert('Error: Could not save configuration. ' + err.message);
    }
  });


  // --- Local State for Form Management ---
  // We still need local state to manage the form inputs before saving.
  const [config, setConfig] = useState({});
  const [initialConfig, setInitialConfig] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // --- Effect to sync fetched data to local form state on initial load ---
  // This replaces your original useEffect for fetching
  useEffect(() => {
    if (fetchedConfig) {
      // Only update if fetchedConfig is different or if local config is empty
      if (JSON.stringify(config) !== JSON.stringify(fetchedConfig)) {
        setConfig(fetchedConfig);
        setInitialConfig(fetchedConfig);
        setHasChanges(false);
      }
    }
  }, [fetchedConfig]); // Depend on fetchedConfig from useQuery

  // --- Check for changes whenever local config updates ---
  useEffect(() => {
    // Only compare if initialConfig has been loaded
    if (initialConfig && config) {
      setHasChanges(JSON.stringify(config) !== JSON.stringify(initialConfig));
    }
  }, [config, initialConfig]);


  // --- Handles changes to any input field ---
  const handleConfigChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    // setHasChanges(true) is handled by the useEffect above
  };

  // --- Triggers the mutation to send updated configuration to the backend ---
  const handleSave = () => {
    saveConfig(config); // Call the mutate function from useMutation
  };

  // --- Reverts any local changes back to the last saved state ---
  const handleReset = () => {
    setConfig(initialConfig);
    setHasChanges(false);
  };

  // --- Reusable Component for section layout (no changes needed) ---
  const ConfigSection = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );

  // --- Reusable Component for a text/number input field (no changes needed) ---
  const ConfigInput = ({ label, description, type = 'text', value, onChange, suffix, min, max }) => (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      {description && <p className="text-sm text-gray-600 mb-2">{description}</p>}
      <div className="flex items-center space-x-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          min={min}
          max={max}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  );

  // --- Reusable Component for a toggle switch (no changes needed) ---
  const ConfigToggle = ({ label, description, value, onChange }) => (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
        {description && <p className="text-sm text-gray-600">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          value ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );

  // --- Conditional Rendering based on React Query states ---
  if (isLoading) return <div className="text-center py-10">Loading system configuration...</div>;
  if (isError) return <div className="text-center py-10 text-red-500">Error: {fetchError?.message || 'Failed to load configuration.'}</div>;

  // The rest of your JSX remains largely the same, but 'config' is now sourced from local state
  // which is initialized and updated by React Query's fetched data.
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Configuration</h1>
          <p className="text-gray-600 mt-1">Manage service limits, security settings, and system behavior</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleReset}
            disabled={!hasChanges || isSaving} // Disable reset if no changes or saving
            className="flex items-center space-x-2 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving} // Disable save if no changes or saving
            className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
              hasChanges && !isSaving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> {/* Spinner for saving */}
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800">
            You have unsaved changes. Make sure to save your configuration before leaving this page.
          </p>
        </div>
      )}

      {/* Render sections using the 'config' local state */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConfigSection title="File Processing Limits" icon={Database}>
          <ConfigInput
            label="Free User Max File Size"
            description="Maximum file size allowed for free users"
            type="number"
            value={config.freeUserMaxFileSize ?? ''} // Use nullish coalescing for empty
            onChange={(value) => handleConfigChange('freeUserMaxFileSize', value)}
            suffix="MB"
            min="1"
            max="1000"
          />
          <ConfigInput
            label="Pro User Max File Size"
            description="Maximum file size allowed for pro users"
            type="number"
            value={config.proUserMaxFileSize ?? ''}
            onChange={(value) => handleConfigChange('proUserMaxFileSize', value)}
            suffix="MB"
            min="1"
            max="5000"
          />
          <ConfigInput
            label="Max Jobs Per Hour"
            description="Maximum number of jobs a user can submit per hour"
            type="number"
            value={config.maxJobsPerHour ?? ''}
            onChange={(value) => handleConfigChange('maxJobsPerHour', value)}
            suffix="jobs"
            min="1"
            max="1000"
          />
          <ConfigInput
            label="Max Processing Time"
            description="Maximum time allowed for processing a single job"
            type="number"
            value={config.maxProcessingTime ?? ''}
            onChange={(value) => handleConfigChange('maxProcessingTime', value)}
            suffix="seconds"
            min="30"
            max="3600"
          />
        </ConfigSection>

        <ConfigSection title="System Settings" icon={Globe}>
          <ConfigInput
            label="Max Concurrent Jobs"
            description="Maximum number of jobs that can be processed simultaneously"
            type="number"
            value={config.maxConcurrentJobs ?? ''}
            onChange={(value) => handleConfigChange('maxConcurrentJobs', value)}
            suffix="jobs"
            min="1"
            max="100"
          />
          <ConfigInput
            label="Cleanup Interval"
            description="How often to clean up temporary files"
            type="number"
            value={config.cleanupInterval ?? ''}
            onChange={(value) => handleConfigChange('cleanupInterval', value)}
            suffix="hours"
            min="1"
            max="168"
          />
          <ConfigInput
            label="Log Retention"
            description="How long to keep system logs"
            type="number"
            value={config.logRetentionDays ?? ''}
            onChange={(value) => handleConfigChange('logRetentionDays', value)}
            suffix="days"
            min="1"
            max="365"
          />
          <ConfigInput
            label="Temp File Retention"
            description="How long to keep temporary files"
            type="number"
            value={config.tempFileRetention ?? ''}
            onChange={(value) => handleConfigChange('tempFileRetention', value)}
            suffix="hours"
            min="1"
            max="72"
          />
        </ConfigSection>

        <ConfigSection title="Security Settings" icon={Shield}>
          <ConfigToggle
            label="Enable Rate Limiting"
            description="Limit the number of requests from a single IP"
            value={config.enableRateLimit ?? false}
            onChange={(value) => handleConfigChange('enableRateLimit', value)}
          />
          <ConfigInput
            label="Max Requests Per Minute"
            description="Maximum requests allowed per IP per minute"
            type="number"
            value={config.maxRequestsPerMinute ?? ''}
            onChange={(value) => handleConfigChange('maxRequestsPerMinute', value)}
            suffix="requests"
            min="1"
            max="1000"
          />
          <ConfigToggle
            label="File Type Validation"
            description="Validate uploaded file types against whitelist"
            value={config.enableFileTypeValidation ?? false}
            onChange={(value) => handleConfigChange('enableFileTypeValidation', value)}
          />
          <ConfigInput
            label="Allowed File Types"
            description="Comma-separated list of allowed file extensions"
            value={config.allowedFileTypes ?? ''}
            onChange={(value) => handleConfigChange('allowedFileTypes', value)}
          />
        </ConfigSection>

        <ConfigSection title="Notifications & Alerts" icon={Bell}>
          <ConfigToggle
            label="Email Notifications"
            description="Send email alerts for system events"
            value={config.enableEmailNotifications ?? false}
            onChange={(value) => handleConfigChange('enableEmailNotifications', value)}
          />
          <ConfigToggle
            label="Slack Alerts"
            description="Send alerts to Slack channel"
            value={config.enableSlackAlerts ?? false}
            onChange={(value) => handleConfigChange('enableSlackAlerts', value)}
          />
          <ConfigInput
            label="Alert Threshold"
            description="CPU/Memory threshold for alerts"
            type="number"
            value={config.alertThreshold ?? ''}
            onChange={(value) => handleConfigChange('alertThreshold', value)}
            suffix="%"
            min="1"
            max="100"
          />
          <ConfigInput
            label="Max Storage"
            description="Maximum storage allowed for the system"
            type="number"
            value={config.maxStorageGB ?? ''}
            onChange={(value) => handleConfigChange('maxStorageGB', value)}
            suffix="GB"
            min="10"
            max="10000"
          />
        </ConfigSection>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
            <span className="text-blue-600 text-sm font-medium">i</span>
          </div>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Configuration Notes</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Changes to file size limits will apply to new uploads immediately</li>
              <li>• Rate limiting changes require service restart to take effect</li>
              <li>• Storage and cleanup settings are checked hourly</li>
              <li>• Alert thresholds are evaluated every 5 minutes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;