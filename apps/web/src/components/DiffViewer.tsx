import React from 'react';
import * as diff from 'diff';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldText,
  newText,
  oldLabel = 'Previous Version',
  newLabel = 'Current Version',
}) => {
  const lineDiffs = diff.diffLines(oldText || '', newText || '');

  return (
    <div className="rounded-lg border border-border bg-[#0d131f] overflow-hidden text-sm font-mono">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-border text-xs text-text-secondary">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
          <span>{oldLabel} (Deletions)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          <span>{newLabel} (Additions)</span>
        </div>
      </div>
      <div className="p-3 max-h-96 overflow-y-auto space-y-0.5 select-text">
        {lineDiffs.map((part, index) => {
          const isAdded = part.added;
          const isRemoved = part.removed;

          let bgClass = 'text-slate-300';
          let prefix = '  ';
          if (isAdded) {
            bgClass = 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500 pl-2';
            prefix = '+ ';
          } else if (isRemoved) {
            bgClass = 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500 pl-2 line-through';
            prefix = '- ';
          }

          return (
            <div key={index} className={`py-0.5 whitespace-pre-wrap ${bgClass}`}>
              <span className="opacity-50 select-none">{prefix}</span>
              {part.value}
            </div>
          );
        })}
      </div>
    </div>
  );
};
