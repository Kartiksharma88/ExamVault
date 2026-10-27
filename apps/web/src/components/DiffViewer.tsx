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
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden text-xs font-mono shadow-xs">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
          <span>{oldLabel} (Deletions)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
          <span>{newLabel} (Additions)</span>
        </div>
      </div>
      <div className="p-3 max-h-96 overflow-y-auto space-y-0.5 select-text">
        {lineDiffs.map((part, index) => {
          const isAdded = part.added;
          const isRemoved = part.removed;

          let bgClass = 'text-slate-800';
          let prefix = '  ';
          if (isAdded) {
            bgClass = 'bg-emerald-50 text-emerald-800 border-l-2 border-emerald-600 pl-2 font-medium';
            prefix = '+ ';
          } else if (isRemoved) {
            bgClass = 'bg-red-50 text-red-800 border-l-2 border-red-600 pl-2 line-through font-medium';
            prefix = '- ';
          }

          return (
            <div key={index} className={`py-1 whitespace-pre-wrap ${bgClass}`}>
              <span className="opacity-50 select-none">{prefix}</span>
              {part.value}
            </div>
          );
        })}
      </div>
    </div>
  );
};
