// src/features/conversion/pages/DynamicConverterPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import FileProcessingPage from '@/components/common/FileProcessingPage';
import NotFound from '@/components/common/NotFound';
import { getConversionTool } from '@/lib/toolRegistry';

// Lazy load settings components dynamically
const settingsComponents = {
  Mp4toMp3Setting:  React.lazy(() => import('@/features/conversion/settings/Mp4toMp3Setting')),
  MovtoMp4Setting:  React.lazy(() => import('@/features/conversion/settings/MovtoMp4Setting')),
  VideoToGifSetting: React.lazy(() => import('@/features/conversion/settings/VideoToGifSetting')),
  WebpToPngSetting: React.lazy(() => import('@/features/conversion/settings/WebpToPngSetting')),
  WebpToJpgSetting: React.lazy(() => import('@/features/conversion/settings/WebpToJpgSetting')),
  JfifToPngSetting: React.lazy(() => import('@/features/conversion/settings/JfifToPngSetting')),
  PngtoSvgSetting:  React.lazy(() => import('@/features/conversion/settings/PngtoSvgSetting')),
};

const DynamicConverterPage = () => {
  const { from, to } = useParams();
  const tool = getConversionTool(from, to);

  if (!tool) return <NotFound />;

  const SettingsComponent = tool.settingsComponent
    ? settingsComponents[tool.settingsComponent]
    : null;

  return (
    <React.Suspense fallback={null}>
      <FileProcessingPage
        mode="convert"
        fromFormat={tool.fromFormat}
        toFormat={tool.toFormat}
        title={tool.title}
        description={tool.description}
        settingsComponent={SettingsComponent}
        defaultSettings={tool.defaultSettings}
      />
    </React.Suspense>
  );
};

export default DynamicConverterPage;
