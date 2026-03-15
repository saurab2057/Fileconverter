import mongoose from 'mongoose';

const FileHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // ✅ Add index for user lookups
  },
  filename: {
    type: String,
    required: true,
  },
  format: {
    type: String, 
  },
  sizeInBytes: {
    type: Number,
  },
  processedAt: {
    type: Date,
    default: Date.now,
    index: true // ✅ Add index for sorting
  },
});

// ✅ Compound index for user history queries
FileHistorySchema.index({ userId: 1, processedAt: -1 });

const FileHistory = mongoose.model('FileHistory', FileHistorySchema);
export default FileHistory;