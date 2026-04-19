// src/lib/toolRegistry.js

// ─────────────────────────────────────────────────────────────
// SETTINGS COMPONENTS & DEFAULTS (lazy imports to avoid circular deps)
// ─────────────────────────────────────────────────────────────

// We'll use dynamic imports in the config, but for now we can reference
// the components via strings that will be resolved by the page components.
// This registry only stores metadata; actual components are imported where used.

import { defaultMp4toMp3Settings } from '@/features/conversion/settings/Mp4toMp3Setting';
import { defaultMovtoMp4Settings } from '@/features/conversion/settings/MovtoMp4Setting';
import { defaultVideoToGifSettings } from '@/features/conversion/settings/VideoToGifSetting';
import { defaultWebpToPngSettings } from '@/features/conversion/settings/WebpToPngSetting';
import { defaultWebpToJpgSettings } from '@/features/conversion/settings/WebpToJpgSetting';
import { defaultJfifToPngSettings } from '@/features/conversion/settings/JfifToPngSetting';
import { defaultPngtoSvgSettings } from '@/features/conversion/settings/PngtoSvgSetting';
import { defaultImageCompressorSettings } from '@/features/compression/settings/ImageCompressorSetting';
import { defaultVideoCompressorSettings } from '@/features/compression/settings/VideoCompressorSetting';
import { defaultGifCompressorSettings } from '@/features/compression/settings/GifCompressorSetting';

// ─────────────────────────────────────────────────────────────
// CONVERSION TOOLS CONFIGURATION
// ─────────────────────────────────────────────────────────────

export const conversionTools = [
  // ── Video & Audio ──────────────────────────────────────────
  {
    id: 'mp4-mp3',
    category: 'video-audio',
    fromFormat: 'mp4',
    toFormat: 'mp3',
    title: 'MP4 to MP3 Converter',
    description: 'Extract and convert audio from MP4 videos to MP3 format quickly and easily.',
    icon: '🎵',
    settingsComponent: 'Mp4toMp3Setting',
    defaultSettings: defaultMp4toMp3Settings,
    acceptedFormats: ['mp4'],
  },
  {
    id: 'mp3-wav',
    category: 'video-audio',
    fromFormat: 'mp3',
    toFormat: 'wav',
    title: 'MP3 to WAV Converter',
    description: 'Convert MP3 audio files to uncompressed WAV format for higher quality editing.',
    icon: '🎵',
    settingsComponent: 'Mp4toMp3Setting',
    defaultSettings: defaultMp4toMp3Settings,
    acceptedFormats: ['mp3'],
  },
  {
    id: 'mp4-aac',
    category: 'video-audio',
    fromFormat: 'mp4',
    toFormat: 'aac',
    title: 'Video to AAC Converter',
    description: 'Extract and convert audio from your video files to AAC format. Great for Apple devices.',
    icon: '🎧',
    settingsComponent: 'Mp4toMp3Setting',
    defaultSettings: defaultMp4toMp3Settings,
    acceptedFormats: ['mp4'],
  },
  {
    id: 'mov-mp4',
    category: 'video-audio',
    fromFormat: 'mov',
    toFormat: 'mp4',
    title: 'MOV to MP4 Converter',
    description: 'Convert MOV video files from Apple devices to the universally supported MP4 format.',
    icon: '🎬',
    settingsComponent: 'MovtoMp4Setting',
    defaultSettings: defaultMovtoMp4Settings,
    acceptedFormats: ['mov'],
  },
  {
    id: 'mp4-webm',
    category: 'video-audio',
    fromFormat: 'mp4',
    toFormat: 'webm',
    title: 'MP4 to WebM Converter',
    description: 'Convert MP4 videos to WebM format for better web browser compatibility and streaming.',
    icon: '🎬',
    settingsComponent: 'MovtoMp4Setting',
    defaultSettings: defaultMovtoMp4Settings,
    acceptedFormats: ['mp4'],
  },
  {
    id: 'mkv-mp4',
    category: 'video-audio',
    fromFormat: 'mkv',
    toFormat: 'mp4',
    title: 'MKV to MP4 Converter',
    description: 'Convert MKV video files to the widely supported MP4 format for easy playback anywhere.',
    icon: '🎬',
    settingsComponent: 'MovtoMp4Setting',
    defaultSettings: defaultMovtoMp4Settings,
    acceptedFormats: ['mkv'],
  },
  {
    id: 'gif-mp4',
    category: 'video-audio',
    fromFormat: 'gif',
    toFormat: 'mp4',
    title: 'GIF to MP4 Converter',
    description: 'Convert animated GIFs to MP4 video files for smaller size and smoother playback.',
    icon: '🎬',
    settingsComponent: 'MovtoMp4Setting',
    defaultSettings: defaultMovtoMp4Settings,
    acceptedFormats: ['gif'],
  },

  // ── GIF ────────────────────────────────────────────────────
  {
    id: 'mp4-gif',
    category: 'gif',
    fromFormat: 'mp4',
    toFormat: 'gif',
    title: 'MP4 to GIF Converter',
    description: 'Convert MP4 video clips into animated GIFs quickly and easily.',
    icon: '🖼️',
    settingsComponent: 'VideoToGifSetting',
    defaultSettings: defaultVideoToGifSettings,
    acceptedFormats: ['mp4'],
  },
  {
    id: 'mov-gif',
    category: 'gif',
    fromFormat: 'mov',
    toFormat: 'gif',
    title: 'Video to GIF Converter',
    description: 'Turn your video clips into animated GIFs. Perfect for sharing short moments anywhere.',
    icon: '🖼️',
    settingsComponent: 'VideoToGifSetting',
    defaultSettings: defaultVideoToGifSettings,
    acceptedFormats: ['mov'],
  },
  {
    id: 'webm-gif',
    category: 'gif',
    fromFormat: 'webm',
    toFormat: 'gif',
    title: 'WebM to GIF Converter',
    description: 'Convert WebM videos into animated GIFs for easy sharing on any platform.',
    icon: '🖼️',
    settingsComponent: 'VideoToGifSetting',
    defaultSettings: defaultVideoToGifSettings,
    acceptedFormats: ['webm'],
  },

  // ── Image ──────────────────────────────────────────────────
  {
    id: 'webp-png',
    category: 'image',
    fromFormat: 'webp',
    toFormat: 'png',
    title: 'WEBP to PNG Converter',
    description: 'Convert WEBP images to lossless PNG format with full transparency support.',
    icon: '🖼️',
    settingsComponent: 'WebpToPngSetting',
    defaultSettings: defaultWebpToPngSettings,
    acceptedFormats: ['webp'],
  },
  {
    id: 'webp-jpg',
    category: 'image',
    fromFormat: 'webp',
    toFormat: 'jpg',
    title: 'WEBP to JPG Converter',
    description: 'Convert WEBP images to widely supported JPG format for sharing and compatibility.',
    icon: '🖼️',
    settingsComponent: 'WebpToJpgSetting',
    defaultSettings: defaultWebpToJpgSettings,
    acceptedFormats: ['webp'],
  },
  {
    id: 'jfif-png',
    category: 'image',
    fromFormat: 'jfif',
    toFormat: 'png',
    title: 'JFIF to PNG Converter',
    description: 'Convert JFIF images to lossless PNG format with transparency support.',
    icon: '🖼️',
    settingsComponent: 'JfifToPngSetting',
    defaultSettings: defaultJfifToPngSettings,
    acceptedFormats: ['jfif'],
  },
  {
    id: 'png-svg',
    category: 'image',
    fromFormat: 'png',
    toFormat: 'svg',
    title: 'PNG to SVG Converter',
    description: 'Vectorize your PNG images into scalable SVG format. Perfect for logos and icons.',
    icon: '✏️',
    settingsComponent: 'PngtoSvgSetting',
    defaultSettings: defaultPngtoSvgSettings,
    acceptedFormats: ['png'],
  },

  // ── PDF ────────────────────────────────────────────────────
  {
    id: 'pdf-jpg',
    category: 'pdf',
    fromFormat: 'pdf',
    toFormat: 'jpg',
    title: 'PDF to JPG Converter',
    description: 'Convert PDF pages to JPG images. Each page is exported as a separate image file.',
    icon: '🖼️',
    settingsComponent: null,
    defaultSettings: {},
    acceptedFormats: ['pdf'],
  },
];

// ─────────────────────────────────────────────────────────────
// COMPRESSION TOOLS CONFIGURATION
// ─────────────────────────────────────────────────────────────

export const compressionTools = [
  {
    id: 'image-compress',
    type: 'image',
    category: 'image',
    title: 'Image Compressor',
    description: 'Reduce the file size of your JPG, PNG and WEBP images without losing visible quality.',
    icon: '📦',
    settingsComponent: 'ImageCompressorSetting',
    defaultSettings: defaultImageCompressorSettings,
    acceptedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  },
  {
    id: 'jpeg-compress',
    type: 'jpeg',
    category: 'image',
    title: 'JPEG Compressor',
    description: 'Compress your JPEG and JPG images using mozjpeg engine for best quality-to-size ratio.',
    icon: '📦',
    settingsComponent: 'ImageCompressorSetting',
    defaultSettings: defaultImageCompressorSettings,
    acceptedFormats: ['jpg', 'jpeg'],
  },
  {
    id: 'png-compress',
    type: 'png',
    category: 'image',
    title: 'PNG Compressor',
    description: 'Compress your PNG images using pngquant engine while preserving transparency.',
    icon: '📦',
    settingsComponent: 'ImageCompressorSetting',
    defaultSettings: defaultImageCompressorSettings,
    acceptedFormats: ['png'],
  },
  {
    id: 'video-compress',
    type: 'video',
    category: 'video',
    title: 'Video Compressor',
    description: 'Compress your MP4, MOV, MKV and other video files. Reduce size while keeping good quality.',
    icon: '📦',
    settingsComponent: 'VideoCompressorSetting',
    defaultSettings: defaultVideoCompressorSettings,
    acceptedFormats: ['mp4', 'mov', 'mkv', 'avi', 'webm'],
  },
  {
    id: 'mp3-compress',
    type: 'mp3',
    category: 'audio',
    title: 'MP3 Compressor',
    description: 'Reduce MP3 file size by lowering the bitrate while keeping acceptable audio quality.',
    icon: '📦',
    settingsComponent: 'VideoCompressorSetting',
    defaultSettings: defaultVideoCompressorSettings,
    acceptedFormats: ['mp3'],
  },
  {
    id: 'wav-compress',
    type: 'wav',
    category: 'audio',
    title: 'WAV Compressor',
    description: 'Compress large WAV audio files by reducing bitrate for easier storage and sharing.',
    icon: '📦',
    settingsComponent: 'VideoCompressorSetting',
    defaultSettings: defaultVideoCompressorSettings,
    acceptedFormats: ['wav'],
  },
  {
    id: 'gif-compress',
    type: 'gif',
    category: 'gif',
    title: 'GIF Compressor',
    description: 'Shrink your GIF files by reducing the color palette. Smaller size, smooth animations.',
    icon: '📦',
    settingsComponent: 'GifCompressorSetting',
    defaultSettings: defaultGifCompressorSettings,
    acceptedFormats: ['gif'],
  },
];

// ─────────────────────────────────────────────────────────────
// CATEGORIES FOR UI ORGANIZATION
// ─────────────────────────────────────────────────────────────

export const conversionCategories = [
  { id: 'video-audio', label: 'Video & Audio', icon: 'Video' },
  { id: 'image', label: 'Image', icon: 'Image' },
  { id: 'gif', label: 'GIF', icon: 'Image' },
  { id: 'pdf', label: 'PDF & Documents', icon: 'FileText' },
];

export const compressionCategories = [
  { id: 'video', label: 'Video & Audio', icon: 'Video' },
  { id: 'image', label: 'Image', icon: 'Image' },
  { id: 'gif', label: 'GIF', icon: 'Image' },
];

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

export const getConversionTool = (from, to) => {
  return conversionTools.find(t => t.fromFormat === from && t.toFormat === to);
};

export const getCompressionTool = (type) => {
  return compressionTools.find(t => t.type === type);
};

export const getToolsByCategory = (category) => {
  return conversionTools.filter(t => t.category === category);
};

export const getCompressionByCategory = (category) => {
  return compressionTools.filter(t => t.category === category);
};

// Format to available actions (used in HomePage format modal)
export const getFormatActions = (extension) => {
  const ext = extension.toLowerCase();
  const actions = [];

  // Find conversion tools where this extension is the source
  const convertActions = conversionTools.filter(t => t.fromFormat === ext);
  convertActions.forEach(tool => {
    actions.push({
      label: `Convert to ${tool.toFormat.toUpperCase()}`,
      icon: tool.icon,
      route: `/convert/${tool.fromFormat}/${tool.toFormat}`,
      settings: tool.defaultSettings,
    });
  });

  // Find compression tools that accept this extension
  const compressActions = compressionTools.filter(t => t.acceptedFormats.includes(ext));
  compressActions.forEach(tool => {
    actions.push({
      label: `Compress ${tool.title}`,
      icon: '📦',
      route: `/compress/${tool.type}`,
      settings: tool.defaultSettings,
    });
  });

  return actions;
};