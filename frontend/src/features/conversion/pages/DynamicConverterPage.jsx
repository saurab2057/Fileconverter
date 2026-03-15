// @/features/conversion/pages/DynamicConverterPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';

import ConverterPage from '@/components/common/ConverterPage';
import NotFound from '@/components/common/NotFound';

// Settings components + their defaults
import Mp4toMp3Setting,   { defaultMp4toMp3Settings }   from '@/features/conversion/settings/Mp4toMp3Setting';
import MovtoMp4Setting,   { defaultMovtoMp4Settings }   from '@/features/conversion/settings/MovtoMp4Setting';
import VideoToGifSetting, { defaultVideoToGifSettings } from '@/features/conversion/settings/VideoToGifSetting';
import WebpToPngSetting,  { defaultWebpToPngSettings }  from '@/features/conversion/settings/WebpToPngSetting';
import WebpToJpgSetting,  { defaultWebpToJpgSettings }  from '@/features/conversion/settings/WebpToJpgSetting';
import JfifToPngSetting,  { defaultJfifToPngSettings }  from '@/features/conversion/settings/JfifToPngSetting';
import PngtoSvgSetting,   { defaultPngtoSvgSettings }   from '@/features/conversion/settings/PngtoSvgSetting';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG MAP
// key format: "fromFormat-toFormat"
// Adding a new converter = add one entry here + one link in Header. That's it.
// ─────────────────────────────────────────────────────────────────────────────
const converterConfig = {

  // ── Video & Audio ──────────────────────────────────────────────────────────
  'mp4-mp3': {
    title: 'MP4 to MP3 Converter',
    description: 'Extract and convert audio from MP4 videos to MP3 format quickly and easily.',
    settingsComponent: Mp4toMp3Setting,
    defaultSettings: defaultMp4toMp3Settings,
  },
  'mp3-wav': {
    title: 'MP3 to WAV Converter',
    description: 'Convert MP3 audio files to uncompressed WAV format for higher quality editing.',
    settingsComponent: Mp4toMp3Setting,
    defaultSettings: defaultMp4toMp3Settings,
  },
  'mp4-aac': {
    title: 'Video to AAC Converter',
    description: 'Extract and convert audio from your video files to AAC format. Great for Apple devices.',
    settingsComponent: Mp4toMp3Setting,
    defaultSettings: defaultMp4toMp3Settings,
  },
  'mov-mp4': {
    title: 'MOV to MP4 Converter',
    description: 'Convert MOV video files from Apple devices to the universally supported MP4 format.',
    settingsComponent: MovtoMp4Setting,
    defaultSettings: defaultMovtoMp4Settings,
  },
  'mp4-webm': {
    title: 'MP4 to WebM Converter',
    description: 'Convert MP4 videos to WebM format for better web browser compatibility and streaming.',
    settingsComponent: MovtoMp4Setting,
    defaultSettings: defaultMovtoMp4Settings,
  },
  'mkv-mp4': {
    title: 'MKV to MP4 Converter',
    description: 'Convert MKV video files to the widely supported MP4 format for easy playback anywhere.',
    settingsComponent: MovtoMp4Setting,
    defaultSettings: defaultMovtoMp4Settings,
  },
  'gif-mp4': {
    title: 'GIF to MP4 Converter',
    description: 'Convert animated GIFs to MP4 video files for smaller size and smoother playback.',
    settingsComponent: MovtoMp4Setting,
    defaultSettings: defaultMovtoMp4Settings,
  },

  // ── GIF ────────────────────────────────────────────────────────────────────
  'mp4-gif': {
    title: 'MP4 to GIF Converter',
    description: 'Convert MP4 video clips into animated GIFs quickly and easily.',
    settingsComponent: VideoToGifSetting,
    defaultSettings: defaultVideoToGifSettings,
  },
  'mov-gif': {
    title: 'Video to GIF Converter',
    description: 'Turn your video clips into animated GIFs. Perfect for sharing short moments anywhere.',
    settingsComponent: VideoToGifSetting,
    defaultSettings: defaultVideoToGifSettings,
  },
  'webm-gif': {
    title: 'WebM to GIF Converter',
    description: 'Convert WebM videos into animated GIFs for easy sharing on any platform.',
    settingsComponent: VideoToGifSetting,
    defaultSettings: defaultVideoToGifSettings,
  },

  // ── Image ──────────────────────────────────────────────────────────────────
  'webp-png': {
    title: 'WEBP to PNG Converter',
    description: 'Convert WEBP images to lossless PNG format with full transparency support.',
    settingsComponent: WebpToPngSetting,
    defaultSettings: defaultWebpToPngSettings,
  },
  'webp-jpg': {
    title: 'WEBP to JPG Converter',
    description: 'Convert WEBP images to widely supported JPG format for sharing and compatibility.',
    settingsComponent: WebpToJpgSetting,
    defaultSettings: defaultWebpToJpgSettings,
  },
  'jfif-png': {
    title: 'JFIF to PNG Converter',
    description: 'Convert JFIF images to lossless PNG format with transparency support.',
    settingsComponent: JfifToPngSetting,
    defaultSettings: defaultJfifToPngSettings,
  },
  'png-svg': {
    title: 'PNG to SVG Converter',
    description: 'Vectorize your PNG images into scalable SVG format. Perfect for logos and icons.',
    settingsComponent: PngtoSvgSetting,
    defaultSettings: defaultPngtoSvgSettings,
  },

  // ── PDF ────────────────────────────────────────────────────────────────────
  'pdf-jpg': {
    title: 'PDF to JPG Converter',
    description: 'Convert PDF pages to JPG images. Each page is exported as a separate image file.',
    settingsComponent: null,
    defaultSettings: {},
  },
};

// ─────────────────────────────────────────────────────────────────────────────
const DynamicConverterPage = () => {
  const { from, to } = useParams();
  const key = `${from}-${to}`;
  const config = converterConfig[key];

  // Unknown from-to combo → show 404
  if (!config) return <NotFound />;

  return (
    <ConverterPage
      fromFormat={from}
      toFormat={to}
      title={config.title}
      description={config.description}
      settingsComponent={config.settingsComponent}
      defaultSettings={config.defaultSettings}
    />
  );
};

export default DynamicConverterPage;