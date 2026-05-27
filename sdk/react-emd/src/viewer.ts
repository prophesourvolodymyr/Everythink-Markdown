import React from 'react';

export interface EmdViewerProps {
  value?: string;
  className?: string;
}

export function EmdViewer(_props: EmdViewerProps): React.ReactElement {
  return React.createElement('div', { className: 'emd-viewer-placeholder' }, 'EmdViewer — coming soon');
}
