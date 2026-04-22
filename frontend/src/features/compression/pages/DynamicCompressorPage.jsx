// src/features/compression/pages/DynamicCompressorPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import CompressorPage from '@/components/common/CompressorPage';
import NotFound from '@/components/common/NotFound';
import { getCompressionTool } from '@/lib/toolRegistry';

// Lazy load settings components dynamically (matching the component names from toolRegistry)
const settingsComponents = {
  ImageCompressorSetting: React.lazy(() => import('@/features/compression/settings/ImageCompressorSetting')),
  VideoCompressorSetting: React.lazy(() => import('@/features/compression/settings/VideoCompressorSetting')),
  GifCompressorSetting:   React.lazy(() => import('@/features/compression/settings/GifCompressorSetting')),
};

const DynamicCompressorPage = () => {
  const { type } = useParams();
  const tool = getCompressionTool(type);

  // Unknown type → show 404
  if (!tool) return <NotFound />;

  const SettingsComponent = tool.settingsComponent
    ? settingsComponents[tool.settingsComponent]
    : null;

  // BUG FIX: React.lazy requires a <Suspense> boundary somewhere in the tree.
  // Without it, the app throws "A React component suspended while rendering,
  // but no fallback UI was specified" the moment any settings modal opens.
  // Wrapping here guarantees coverage regardless of what CompressorPage does internally.
  return (
    <React.Suspense fallback={null}>
      <CompressorPage
        acceptedFormats={tool.acceptedFormats}
        title={tool.title}
        description={tool.description}
        settingsComponent={SettingsComponent}
        defaultSettings={tool.defaultSettings}
      />
    </React.Suspense>
  );
};

export default DynamicCompressorPage;