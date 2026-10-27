import React, { useMemo } from 'react';
import katex from 'katex';

interface KaTeXPreviewProps {
  content: string;
  className?: string;
}

export const KaTeXPreview: React.FC<KaTeXPreviewProps> = ({ content, className = '' }) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '<p class="text-slate-400 italic">No content to preview</p>';

    // Parse block math $$...$$ first, then inline math $...$
    // Replace $$ math $$ with unique block tokens
    const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;
    const inlineMathRegex = /\$([^\$\n]+?)\$/g;

    const blockTokens: string[] = [];
    let processed = content.replace(blockMathRegex, (_, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        const index = blockTokens.length;
        blockTokens.push(`<div class="my-3 overflow-x-auto text-slate-900">${rendered}</div>`);
        return `___BLOCK_MATH_${index}___`;
      } catch (err) {
        return `<pre class="text-red-600 p-2 text-xs bg-red-50 rounded border border-red-200">${String(err)}</pre>`;
      }
    });

    // Replace inline math $...$
    const inlineTokens: string[] = [];
    processed = processed.replace(inlineMathRegex, (_, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
        const index = inlineTokens.length;
        inlineTokens.push(rendered);
        return `___INLINE_MATH_${index}___`;
      } catch (err) {
        return `<code class="text-red-600">${math}</code>`;
      }
    });

    // Basic Markdown transformations (bold, italic, code, linebreaks, headings, lists)
    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Split lines and process markdown
    const lines = processed.split('\n');
    const formattedLines = lines.map((line) => {
      const segments = line.split(/(___BLOCK_MATH_\d+___|___INLINE_MATH_\d+___)/g);
      return segments
        .map((seg) => {
          if (seg.startsWith('___BLOCK_MATH_') || seg.startsWith('___INLINE_MATH_')) {
            return seg;
          }
          let escaped = escapeHtml(seg);
          // Bold
          escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
          // Italic
          escaped = escaped.replace(/\*(.*?)\*/g, '<em class="italic text-slate-800">$1</em>');
          // Inline code
          escaped = escaped.replace(
            /`([^`]+)`/g,
            '<code class="px-1.5 py-0.5 rounded bg-slate-100 text-red-700 font-mono text-xs border border-slate-200 font-semibold">$1</code>',
          );
          return escaped;
        })
        .join('');
    });

    let finalHtml = formattedLines.join('<br />');

    // Substitute tokens back
    blockTokens.forEach((rendered, i) => {
      finalHtml = finalHtml.replace(`___BLOCK_MATH_${i}___`, rendered);
    });
    inlineTokens.forEach((rendered, i) => {
      finalHtml = finalHtml.replace(`___INLINE_MATH_${i}___`, rendered);
    });

    return finalHtml;
  }, [content]);

  return (
    <div
      className={`max-w-none text-slate-900 leading-relaxed break-words font-sans text-sm ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
