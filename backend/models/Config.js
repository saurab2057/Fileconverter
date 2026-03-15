import mongoose from 'mongoose';

const ConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'main_config',
    unique: true,
    index: true // ✅ Add index for singleton lookups
  },
  freeUserMaxFileSize: { type: Number, default: 50 },
  proUserMaxFileSize: { type: Number, default: 500 },
  maxJobsPerHour: { type: Number, default: 20 },
  maxProcessingTime: { type: Number, default: 300 },
  maxConcurrentJobs: { type: Number, default: 10 },
  cleanupInterval: { type: Number, default: 24 },
  logRetentionDays: { type: Number, default: 30 },
  enableRateLimit: { type: Boolean, default: true },
  maxRequestsPerMinute: { type: Number, default: 60 },
  enableFileTypeValidation: { type: Boolean, default: true },
  allowedFileTypes: { type: String, default: 'pdf,doc,docx,jpg,jpeg,png,mp4,avi,zip' },
  enableEmailNotifications: { type: Boolean, default: true },
  enableSlackAlerts: { type: Boolean, default: false },
  alertThreshold: { type: Number, default: 80 },
  tempFileRetention: { type: Number, default: 1 },
  maxStorageGB: { type: Number, default: 100 },
  enableAutoBackup: { type: Boolean, default: true },
}, { 
  timestamps: true 
});

ConfigSchema.statics.initialize = async function() {
  const existing = await this.findOne({ key: 'main_config' });
  if (!existing) {
    console.log('Initializing default system configuration...');
    await this.create({ key: 'main_config' });
  }
};

const Config = mongoose.model('Config', ConfigSchema);
export default Config;