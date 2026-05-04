import CloudConvert from "cloudconvert";
import FileHistory from "../models/FileHistory.js";
import User from "../models/User.js";
import { validateFileSecurity, sanitizeFilename } from "../utils/fileSecurity.js";

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

export const batchConvert = async (req, res) => {

    const cloudConvert = getCloudConvert();

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files were uploaded." });
    }

    const { toFormat } = req.body;

    if (!toFormat) {
        return res.status(400).json({ message: "Target output format was not specified." });
    }

    for (const file of req.files) {
        const validationError = await validateFileSecurity(file, req.user.id);
        if (validationError) {
            return res.status(400).json({ message: validationError.message });
        }
    }

    let settingsArray = [];
    if (req.body.settings) {
        try {
            settingsArray = JSON.parse(req.body.settings);
        } catch (_) {
            return res.status(400).json({ message: 'Invalid settings JSON format.' });
        }
    }
    const settingsMap = new Map(settingsArray.map(s => [s.originalName, s.settings]));

    const conversionPromises = req.files.map(async (file) => {

        const safeOriginalName = sanitizeFilename(file.originalname);
        const fileSettings = settingsMap.get(file.originalname) || {};
        const fromFormat = file.originalname.split(".").pop().toLowerCase();

        let job;

        try {
            console.log(`[CloudConvert] ${safeOriginalName}: ${fromFormat} -> ${toFormat}`);

            let conversionTask = {
                operation: "convert",
                input: "import-1",
                output_format: toFormat
            };

            // ─────────────────────────────────────────────────────────
            // ✅ FIX #1: Check toFormat (not fromFormat) for video branch
            // Old bug: checking fromFormat caused mp4→mp3 to hit video
            // branch → sent video_codec:x264 + output_format:mp3 → failed
            // ─────────────────────────────────────────────────────────
            const videoOutputFormats = ["mp4", "webm", "mkv", "mov", "avi"];

            if (videoOutputFormats.includes(toFormat)) {
                // ─────────────────────────────────────────────────────
                // VIDEO → VIDEO CONVERSION
                // ─────────────────────────────────────────────────────
                console.log("Using VIDEO conversion recipe...");

                conversionTask.engine = "ffmpeg";
                conversionTask.video_codec = "x264";

                if (fileSettings.removeAudio) {
                    conversionTask.audio_codec = "none";
                } else {
                    conversionTask.audio_codec = "copy";
                }

                const qualityMap = { high: 18, medium: 23, low: 28 };
                conversionTask.crf = qualityMap[fileSettings.video_quality] || 23;

                if (fileSettings.resolution && fileSettings.resolution !== "original") {
                    const [w, h] = fileSettings.resolution.split("x");
                    conversionTask.width = parseInt(w);
                    conversionTask.height = parseInt(h);
                }

                // ✅ FIX #5: Trim was in old code but missing from new — restored
                if (fileSettings.trimStart && fileSettings.trimEnd) {
                    conversionTask.video_start_time = fileSettings.trimStart;
                    conversionTask.video_end_time = fileSettings.trimEnd;
                }
            }

            else if (["mp3", "wav", "aac", "flac"].includes(toFormat)) {
                // ─────────────────────────────────────────────────────
                // AUDIO CONVERSION
                // ─────────────────────────────────────────────────────
                console.log("Using AUDIO conversion recipe...");

                conversionTask.engine = "ffmpeg";

                // ─────────────────────────────────────────────────────
                // UPDATED: Only set audio_codec for formats that are actual codec names.
                // WAV is a container – CloudConvert should pick the best PCM codec.
                // ─────────────────────────────────────────────────────
                const AUDIO_CODEC_MAP = {
                    mp3: "mp3",
                    aac: "aac",
                    flac: "flac",
                    // wav omitted on purpose
                };
                conversionTask.audio_codec = AUDIO_CODEC_MAP[toFormat] || undefined;

                // ✅ FIX #2: audioRateControl — apply VBR or CBR properly
                if (fileSettings.audioRateControl === "vbr") {
                    conversionTask.audio_qscale = 2;
                } else if (fileSettings.audioRateControl === "cbr" && fileSettings.bitrate) {
                    // ✅ FIX #3: Only apply bitrate when CBR is selected
                    conversionTask.audio_bitrate = parseInt(fileSettings.bitrate) * 1000;
                }

                // ✅ FIX #4: Guard against 'auto' — parseInt('auto') = NaN
                if (
                    fileSettings.audioSampleRate &&
                    fileSettings.audioSampleRate !== "auto" &&
                    !isNaN(parseInt(fileSettings.audioSampleRate))
                ) {
                    conversionTask.audio_sample_rate = parseInt(fileSettings.audioSampleRate);
                }

                // Audio channels: 'nochange' → skip, 'mono'→1, 'stereo'→2
                const channelMap = { mono: 1, stereo: 2 };
                if (channelMap[fileSettings.audioChannels]) {
                    conversionTask.audio_channels = channelMap[fileSettings.audioChannels];
                }

                // Volume: only send when not 100%
                if (fileSettings.volume && fileSettings.volume !== 100) {
                    conversionTask.audio_volume = (fileSettings.volume / 100).toFixed(2);
                }

                // ✅ FIX #5: Trim audio — was missing entirely
                if (fileSettings.trimStart && fileSettings.trimEnd) {
                    conversionTask.audio_start_time = fileSettings.trimStart;
                    conversionTask.audio_end_time = fileSettings.trimEnd;
                }
            }

            else if (fromFormat === "png" && toFormat === "svg") {
                // ─────────────────────────────────────────────────────
                // PNG → SVG (Vectorization via Potrace)
                // ─────────────────────────────────────────────────────
                console.log("Using PNG → SVG (Potrace) recipe...");

                conversionTask.engine = "potrace";

                if (fileSettings.colorMode) {
                    conversionTask.colormode = fileSettings.colorMode; // 'color' | 'grey' | 'black'
                }

                if (fileSettings.colorMode === "black" && fileSettings.threshold !== undefined) {
                    conversionTask.threshold = parseInt(fileSettings.threshold);
                }

                if (fileSettings.background) {
                    conversionTask.background = fileSettings.background;
                }

                if (fileSettings.detail) {
                    const map = { high: 2, medium: 5, low: 10 };
                    conversionTask.turdsize = map[fileSettings.detail] || 5;
                }
            }

            else if (toFormat === "gif") {
                // ─────────────────────────────────────────────────────
                // VIDEO → GIF
                // ─────────────────────────────────────────────────────
                console.log("Using VIDEO → GIF recipe...");

                conversionTask.engine = "ffmpeg";
                conversionTask.video_codec = "gif";

                if (fileSettings.trimStart && fileSettings.trimEnd) {
                    conversionTask.video_start_time = fileSettings.trimStart;
                    conversionTask.video_end_time = fileSettings.trimEnd;
                }
            }

            else if (fromFormat === "pdf" && toFormat === "jpg") {
                // ─────────────────────────────────────────────────────
                // PDF → JPG (Poppler)
                // ─────────────────────────────────────────────────────
                console.log("Using PDF → JPG recipe (poppler)...");

                conversionTask.engine = "poppler";
                conversionTask.pages = "1";
            }

            else if (["png", "jpg", "webp", "svg"].includes(toFormat)) {
                // ─────────────────────────────────────────────────────
                // IMAGE CONVERSION (ImageMagick)
                // ─────────────────────────────────────────────────────
                console.log("Using IMAGE conversion recipe (imagemagick)...");

                conversionTask.engine = "imagemagick";

                if (fileSettings.quality) {
                    conversionTask.quality = parseInt(fileSettings.quality);
                }
            }

            else {
                throw new Error(`Unsupported conversion: ${fromFormat} → ${toFormat}`);
            }

            console.log("Conversion Task:", JSON.stringify(conversionTask, null, 2));

            // ─────────────────────────────────────────────────────────
            // Create job → upload → wait → export
            // ─────────────────────────────────────────────────────────
            job = await cloudConvert.jobs.create({
                tag: `${fromFormat}-to-${toFormat}`,
                tasks: {
                    "import-1": { operation: "import/upload" },
                    "convert-1": conversionTask,
                    "export-1": { operation: "export/url", input: "convert-1" }
                }
            });

            const uploadTask = job.tasks.find(t => t.name === "import-1");
            await cloudConvert.tasks.upload(uploadTask, file.buffer, safeOriginalName);

            const awaitedJob = await cloudConvert.jobs.wait(job.id);

            const exportTask = awaitedJob.tasks.find(
                t => t.operation === "export/url" && t.status === "finished"
            );

            if (!exportTask?.result?.files?.length) {
                console.log("Full Job Details:", JSON.stringify(awaitedJob, null, 2));
                throw new Error("Conversion did not produce output file.");
            }

            const outputFile = exportTask.result.files[0];
            const downloadUrl = outputFile.url;

            if (!downloadUrl.startsWith("https://")) {
                throw new Error("Invalid download URL.");
            }

            // Save to history
            try {
                const historyRecord = new FileHistory({
                    userId: req.user.id,
                    filename: outputFile.filename,
                    format: toFormat,
                    sizeInBytes: outputFile.size
                });
                await historyRecord.save();
                await User.findByIdAndUpdate(req.user.id, {
                    $push: { fileHistory: historyRecord._id }
                });
                console.log(`[DB] Saved history: ${outputFile.filename}`);
            } catch (dbError) {
                console.error("[DB ERROR] Could not save history:", dbError);
            }

            console.log(`[CloudConvert] Finished: ${safeOriginalName}`);

            return {
                originalName: file.originalname,
                success: true,
                downloadUrl
            };

        } catch (error) {
            console.error(`[CloudConvert] Error converting ${safeOriginalName}:`, error);

            // ─────────────────────────────────────────────────────────
            // UPDATED: Extract real CloudConvert error if available
            // ─────────────────────────────────────────────────────────
            let message = "Conversion failed. Please check your file and try again.";

            if (job) {
                try {
                    const failedJob = await cloudConvert.jobs.get(job.id);
                    if (failedJob && failedJob.status === 'error') {
                        const failedTask = failedJob.tasks.find(
                            t => t.status === 'error' && t.message
                        );
                        if (failedTask) {
                            message = `Conversion failed: ${failedTask.message} (code: ${failedTask.code})`;
                        }
                    }
                } catch (_) {
                    // ignore – keep default message
                }
            }

            return {
                originalName: file.originalname,
                success: false,
                message
            };
        }
    });

    try {
        const results = await Promise.all(conversionPromises);
        res.json(results);
    } catch (error) {
        console.error("Critical batch error:", error);
        res.status(500).json({ message: "A critical error occurred during batch processing." });
    }
};