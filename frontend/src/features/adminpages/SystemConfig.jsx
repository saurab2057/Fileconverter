// src/features/adminpages/SystemConfig.jsx
import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, RefreshCw, Shield, Database, Globe, Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { configUpdateSchema } from '@/utils/validationSchemas';
import { useToast } from '@/context/ToastContext';

// Fetch config
const fetchSystemConfig = async () => {
  const { data } = await apiClient.get('/api/admin/config');
  return data;
};

// Update config
const updateSystemConfig = async (newConfigData) => {
  const { data } = await apiClient.put('/api/admin/config', newConfigData);
  return data;
};

// Reusable Components
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

const ConfigInput = ({ label, description, type = 'text', value, onChange, suffix, min, max, error }) => (
  <div>
    <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
    {description && <p className="text-sm text-gray-600 mb-2">{description}</p>}
    <div className="flex items-center space-x-2">
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange}
        min={min}
        max={max}
        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      />
      {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
    </div>
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

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

const SystemConfig = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    data: config,
    isLoading,
    isError,
    error: fetchError,
  } = useQuery({
    queryKey: ['systemConfig'],
    queryFn: fetchSystemConfig,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(configUpdateSchema),
    values: config,
  });

  const saveMutation = useMutation({
    mutationFn: updateSystemConfig,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
      reset(data);
      toast.success('Configuration saved successfully!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save configuration.');
    },
  });

  const onSubmit = (data) => {
    saveMutation.mutate(data);
  };

  const handleReset = () => {
    reset(config);
  };

  if (isLoading) return <div className="text-center py-10">Loading system configuration...</div>;
  if (isError) return <div className="text-center py-10 text-red-500">Error: {fetchError?.message || 'Failed to load configuration.'}</div>;

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
            disabled={!isDirty || isSubmitting}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty || isSubmitting}
            className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
              isDirty && !isSubmitting
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
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

      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800">You have unsaved changes.</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConfigSection title="File Processing Limits" icon={Database}>
            <Controller
              name="freeUserMaxFileSize"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Free User Max File Size"
                  description="Maximum file size allowed for free users"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="MB"
                  min="1"
                  max="1000"
                  error={errors.freeUserMaxFileSize?.message}
                />
              )}
            />
            <Controller
              name="proUserMaxFileSize"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Pro User Max File Size"
                  description="Maximum file size allowed for pro users"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="MB"
                  min="1"
                  max="5000"
                  error={errors.proUserMaxFileSize?.message}
                />
              )}
            />
            <Controller
              name="maxJobsPerHour"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Max Jobs Per Hour"
                  description="Maximum number of jobs a user can submit per hour"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="jobs"
                  min="1"
                  max="1000"
                  error={errors.maxJobsPerHour?.message}
                />
              )}
            />
            <Controller
              name="maxProcessingTime"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Max Processing Time"
                  description="Maximum time allowed for processing a single job"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="seconds"
                  min="30"
                  max="3600"
                  error={errors.maxProcessingTime?.message}
                />
              )}
            />
          </ConfigSection>

          <ConfigSection title="System Settings" icon={Globe}>
            <Controller
              name="maxConcurrentJobs"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Max Concurrent Jobs"
                  description="Maximum number of jobs that can be processed simultaneously"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="jobs"
                  min="1"
                  max="100"
                  error={errors.maxConcurrentJobs?.message}
                />
              )}
            />
            <Controller
              name="cleanupInterval"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Cleanup Interval"
                  description="How often to clean up temporary files"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="hours"
                  min="1"
                  max="168"
                  error={errors.cleanupInterval?.message}
                />
              )}
            />
            <Controller
              name="logRetentionDays"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Log Retention"
                  description="How long to keep system logs"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="days"
                  min="1"
                  max="365"
                  error={errors.logRetentionDays?.message}
                />
              )}
            />
            <Controller
              name="tempFileRetention"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Temp File Retention"
                  description="How long to keep temporary files"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="hours"
                  min="1"
                  max="72"
                  error={errors.tempFileRetention?.message}
                />
              )}
            />
          </ConfigSection>

          <ConfigSection title="Security Settings" icon={Shield}>
            <Controller
              name="enableRateLimit"
              control={control}
              render={({ field }) => (
                <ConfigToggle
                  label="Enable Rate Limiting"
                  description="Limit the number of requests from a single IP"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="maxRequestsPerMinute"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Max Requests Per Minute"
                  description="Maximum requests allowed per IP per minute"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="requests"
                  min="1"
                  max="1000"
                  error={errors.maxRequestsPerMinute?.message}
                />
              )}
            />
            <Controller
              name="enableFileTypeValidation"
              control={control}
              render={({ field }) => (
                <ConfigToggle
                  label="File Type Validation"
                  description="Validate uploaded file types against whitelist"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="allowedFileTypes"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Allowed File Types"
                  description="Comma-separated list of allowed file extensions"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.allowedFileTypes?.message}
                />
              )}
            />
          </ConfigSection>

          <ConfigSection title="Notifications & Alerts" icon={Bell}>
            <Controller
              name="enableEmailNotifications"
              control={control}
              render={({ field }) => (
                <ConfigToggle
                  label="Email Notifications"
                  description="Send email alerts for system events"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="enableSlackAlerts"
              control={control}
              render={({ field }) => (
                <ConfigToggle
                  label="Slack Alerts"
                  description="Send alerts to Slack channel"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="alertThreshold"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Alert Threshold"
                  description="CPU/Memory threshold for alerts"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="%"
                  min="1"
                  max="100"
                  error={errors.alertThreshold?.message}
                />
              )}
            />
            <Controller
              name="maxStorageGB"
              control={control}
              render={({ field }) => (
                <ConfigInput
                  label="Max Storage"
                  description="Maximum storage allowed for the system"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  suffix="GB"
                  min="10"
                  max="10000"
                  error={errors.maxStorageGB?.message}
                />
              )}
            />
          </ConfigSection>
        </div>
      </form>

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