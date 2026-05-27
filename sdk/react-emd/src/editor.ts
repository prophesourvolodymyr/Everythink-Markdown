import React from 'react';

export interface EmdEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function EmdEditor(_props: EmdEditorProps): React.ReactElement {
  return React.createElement('div', { className: 'emd-editor-placeholder' }, 'EmdEditor — coming soon');
}
