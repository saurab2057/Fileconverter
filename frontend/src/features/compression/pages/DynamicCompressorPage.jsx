// @/features/compression/pages/DynamicCompressorPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';

import CompressorPage from '@/components/common/CompressorPage';
import NotFound from '@/components/common/NotFound';

// Settings components + their defaults
import ImageCompressorSetting, { defaultImageCompressorSettings } from '@/features/compression/settings/ImageCompressorSetting';
import VideoCompressorSetting, { defaultVideoCompressorSettings } from '@/features/compression/settings/VideoCompressorSetting';
import GifCompressorSetting,   { defaultGifCompressorSettings }   from '@/features/compression/settings/GifCompressorSetting';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG MAP
// key: the URL param — /compress/:type
// Adding a new compressor = add one entry here + one link in Header. That's it.
// ─────────────────────────────────────────────────────────────────────────────
const compressorConfig = {

  // ── Image ──────────────────────────────────────────────────────────────────
  'image': {
    title: 'Image Compressor',
    description: 'Reduce the file size of your JPG, PNG and WEBP images without losing visible quality.',
    acceptedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    settingsComponent: ImageCompressorSetting,
    defaultSettings: defaultImageCompressorSettings,
  },
  'jpeg': {
    title: 'JPEG Compressor',
    description: 'Compress your JPEG and JPG images using mozjpeg engine for best quality-to-size ratio.',
    acceptedFormats: ['jpg', 'jpeg'],
    settingsComponent: ImageCompressorSetting,
    defaultSettings: defaultImageCompressorSettings,
  },
  'png': {
    title: 'PNG Compressor',
    description: 'Compress your PNG images using pngquant engine while preserving transparency.',
    acceptedFormats: ['png'],
    settingsComponent: ImageCompressorSetting,
    defaultSettings: defaultImageCompressorSettings,
  },

  // ── Video ──────────────────────────────────────────────────────────────────
  'video': {
    title: 'Video Compressor',
    description: 'Compress your MP4, MOV, MKV and other video files. Reduce size while keeping good quality.',
    acceptedFormats: ['mp4', 'mov', 'mkv', 'avi', 'webm'],
    settingsComponent: VideoCompressorSetting,
    defaultSettings: defaultVideoCompressorSettings,
  },

  // ── Audio ──────────────────────────────────────────────────────────────────
  'mp3': {
    title: 'MP3 Compressor',
    description: 'Reduce MP3 file size by lowering the bitrate while keeping acceptable audio quality.',
    acceptedFormats: ['mp3'],
    settingsComponent: VideoCompressorSetting, // reuses quality: high/medium/low → maps to bitrate
    defaultSettings: defaultVideoCompressorSettings,
  },
  'wav': {
    title: 'WAV Compressor',
    description: 'Compress large WAV audio files by reducing bitrate for easier storage and sharing.',
    acceptedFormats: ['wav'],
    settingsComponent: VideoCompressorSetting, // reuses quality: high/medium/low → maps to bitrate
    defaultSettings: defaultVideoCompressorSettings,
  },

  // ── GIF ────────────────────────────────────────────────────────────────────
  'gif': {
    title: 'GIF Compressor',
    description: 'Shrink your GIF files by reducing the color palette. Smaller size, smooth animations.',
    acceptedFormats: ['gif'],
    settingsComponent: GifCompressorSetting,
    defaultSettings: defaultGifCompressorSettings,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
const DynamicCompressorPage = () => {
  const { type } = useParams();
  const config = compressorConfig[type];

  // Unknown type → show 404
  if (!config) return <NotFound />;

  return (
    <CompressorPage
      acceptedFormats={config.acceptedFormats}
      title={config.title}
      description={config.description}
      settingsComponent={config.settingsComponent}
      defaultSettings={config.defaultSettings}
    />
  );
};

export default DynamicCompressorPage;