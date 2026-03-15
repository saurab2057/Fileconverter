import CloudConvert from 'cloudconvert';
import FileHistory from '../models/FileHistory.js';
import User from '../models/User.js';
import { validateFileSecurity, sanitizeFilename } from '../utils/fileSecurity.js';

/*
─────────────────────────────────────────────────────────
CloudConvert Client (Singleton)
─────────────────────────────────────────────────────────
Second parameter `false` disables the sync API.
This prevents: ERR_TLS_CERT_ALTNAME_INVALID
─────────────────────────────────────────────────────────
*/
let cloudConvertClient = null;

const getCloudConvert = () => {
    if (!cloudConvertClient) {
        cloudConvertClient = new CloudConvert(
            process.env.CLOUDCONVERT_API_KEY,
            false
        );
    }
    return cloudConvertClient;
};

export const setCloudConvertClient = (client) => {
    cloudConvertClient = client;
};


export const batchCompress = async (req, res) => {

    const cloudConvert = getCloudConvert();

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files were uploaded.' });
    }

    for (const file of req.files) {
        const validationError = await validateFileSecurity(file, req.user.id);
        if (validationError) {
            return res.status(400).json({ message: validationError.message });
        }
    }

    const settingsArray = req.body.settings ? JSON.parse(req.body.settings) : [];
    const settingsMap = new Map(settingsArray.map(s => [s.originalName, s.settings]));

    const compressionPromises = req.files.map(async (file) => {

        const safeOriginalName = sanitizeFilename(file.originalname);
        const originalSize     = file.size;

        let job;

        try {
            const fileSettings = settingsMap.get(file.originalname) || {};
            const fromFormat   = file.originalname.split('.').pop().toLowerCase();

            console.log(`[CloudConvert] Compressing ${safeOriginalName} (${fromFormat})`);

            let compressionTask;

            // ─────────────────────────────────────────────────────────
            // JPEG (mozjpeg)
            // ─────────────────────────────────────────────────────────
            if (['jpg', 'jpeg'].includes(fromFormat)) {
                console.log('Using JPEG compression (mozjpeg)...');
                compressionTask = {
                    operation: 'optimize',
                    input:     'import-1',
                    engine:    'mozjpeg',
                    quality:   parseInt(fileSettings.quality, 10) || 80,
                };
            }

            // ─────────────────────────────────────────────────────────
            // PNG (pngquant)
            // ─────────────────────────────────────────────────────────
            else if (fromFormat === 'png') {
                console.log('Using PNG compression (pngquant)...');
                compressionTask = {
                    operation: 'optimize',
                    input:     'import-1',
                    engine:    'pngquant',
                    quality:   parseInt(fileSettings.quality, 10) || 80,
                };
            }

            // ─────────────────────────────────────────────────────────
            // WEBP (imagemagick)
            // ─────────────────────────────────────────────────────────
            else if (fromFormat === 'webp') {
                console.log('Using WEBP compression (imagemagick)...');
                compressionTask = {
                    operation:     'convert',
                    input:         'import-1',
                    output_format: 'webp',
                    engine:        'imagemagick',
                    quality:       parseInt(fileSettings.quality, 10) || 80,
                };
            }

            // ─────────────────────────────────────────────────────────
            // GIF (gifsicle — palette reduction)
            // ─────────────────────────────────────────────────────────
            else if (fromFormat === 'gif') {
                console.log('Using GIF compression (gifsicle)...');
                compressionTask = {
                    operation: 'optimize',
                    input:     'import-1',
                    engine:    'gifsicle',
                    colors:    parseInt(fileSettings.colors, 10) || 128,
                };
            }

            // ─────────────────────────────────────────────────────────
            // VIDEO (ffmpeg)
            // quality: high=CRF23, medium=CRF28, low=CRF35
            // resolution: downscales on top of CRF if set
            // audio: copied as-is (no re-encode) to save time
            // ─────────────────────────────────────────────────────────
            else if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(fromFormat)) {
                console.log('Using VIDEO compression (ffmpeg)...');

                const qualityMap = { high: 23, medium: 28, low: 35 };
                const resolutionMap = {
                    '1080p': { width: 1920, height: 1080 },
                    '720p':  { width: 1280, height: 720  },
                    '480p':  { width: 854,  height: 480  },
                    '360p':  { width: 640,  height: 360  },
                };

                compressionTask = {
                    operation:     'convert',
                    input:         'import-1',
                    output_format: fromFormat,
                    engine:        'ffmpeg',
                    video_codec:   'x264',
                    audio_codec:   'copy',
                    crf:           qualityMap[fileSettings.quality] || 28,
                };

                if (fileSettings.resolution && resolutionMap[fileSettings.resolution]) {
                    compressionTask.width  = resolutionMap[fileSettings.resolution].width;
                    compressionTask.height = resolutionMap[fileSettings.resolution].height;
                }
            }

            // ─────────────────────────────────────────────────────────
            // AUDIO (ffmpeg)
            // quality: high=192kbps, medium=128kbps, low=96kbps
            // ─────────────────────────────────────────────────────────
            else if (['mp3', 'wav', 'aac', 'flac'].includes(fromFormat)) {
                console.log('Using AUDIO compression (ffmpeg)...');

                const bitrateMap = { high: 192, medium: 128, low: 96 };

                compressionTask = {
                    operation:     'convert',
                    input:         'import-1',
                    output_format: fromFormat,
                    engine:        'ffmpeg',
                    audio_codec:   fromFormat,
                    audio_bitrate: (bitrateMap[fileSettings.quality] || 128) * 1000,
                };
            }

            else {
                throw new Error(`Unsupported compression format: .${fromFormat}`);
            }

            console.log('Compression Task:', JSON.stringify(compressionTask, null, 2));

            // ─────────────────────────────────────────────────────────
            // Create job → upload → wait → export
            // ─────────────────────────────────────────────────────────
            job = await cloudConvert.jobs.create({
                tag: `compress-${fromFormat}`,
                tasks: {
                    'import-1':   { operation: 'import/upload' },
                    'compress-1': compressionTask,
                    'export-1':   { operation: 'export/url', input: 'compress-1' }
                }
            });

            const uploadTask = job.tasks.find(task => task.name === 'import-1');
            await cloudConvert.tasks.upload(uploadTask, file.buffer, safeOriginalName);

            const awaitedJob = await cloudConvert.jobs.wait(job.id);

            const exportTask = awaitedJob.tasks.find(
                task => task.operation === 'export/url' && task.status === 'finished'
            );

            if (!exportTask?.result?.files?.length) {
                console.log('Full Job Details:', JSON.stringify(awaitedJob, null, 2));
                throw new Error('Compression did not produce an output file.');
            }

            const outputFile     = exportTask.result.files[0];
            const downloadUrl    = outputFile.url;
            const compressedSize = outputFile.size;
            const savedBytes     = originalSize - compressedSize;
            const savedPercent   = originalSize > 0
                ? Math.round((savedBytes / originalSize) * 100)
                : 0;

            if (!downloadUrl.startsWith('https://')) {
                throw new Error('Invalid download URL: only HTTPS allowed.');
            }

            console.log(
                `[CloudConvert] Done: ${safeOriginalName} | ` +
                `${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB ` +
                `(${savedPercent}% saved)`
            );

            // Save to history
            try {
                const historyRecord = new FileHistory({
                    userId:      req.user.id,
                    filename:    outputFile.filename,
                    format:      fromFormat,
                    sizeInBytes: compressedSize,
                });
                await historyRecord.save();
                await User.findByIdAndUpdate(req.user.id, {
                    $push: { fileHistory: historyRecord._id }
                });
                console.log(`[DB] Saved compression history: ${outputFile.filename}`);
            } catch (dbError) {
                console.error('[DB ERROR] Could not save history:', dbError);
            }

            return {
                originalName:    file.originalname,
                success:         true,
                downloadUrl,
                originalSize,       // bytes — frontend uses for "X MB → Y MB"
                compressedSize,     // bytes
                savedBytes,         // bytes saved
                savedPercent,       // e.g. 45 → "45% smaller"
            };

        } catch (error) {
            console.error(`[CloudConvert] Error compressing ${safeOriginalName}:`, error);
            return {
                originalName: file.originalname,
                success:      false,
                message:      'Compression failed. Please check your file and try again.'
            };
        }
    });

    try {
        const results = await Promise.all(compressionPromises);
        res.json(results);
    } catch (error) {
        console.error('Critical batch compression error:', error);
        res.status(500).json({ message: 'A critical error occurred during batch compression.' });
    }
};