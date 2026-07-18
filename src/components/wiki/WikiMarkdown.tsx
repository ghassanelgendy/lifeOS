import { useCallback, useMemo } from 'react';
import { Marked } from 'marked';
import { cn } from '../../lib/utils';

interface WikiMarkdownProps {
  content: string;
  className?: string;
  onNavigate?: (title: string) => void;
}

/* Custom renderer extension for [[Wiki Links]] */
function wikiLinkExtension() {
  return {
    name: 'wikiLink',
    level: 'inline' as const,
    start(src: string) {
      return src.match(/\[\[/)?.index;
    },
    tokenizer(src: string) {
      const match = /^\[\[([^\]]+)\]\]/.exec(src);
      if (!match) return undefined;
      return {
        type: 'wikiLink',
        raw: match[0],
        text: match[1].trim(),
      };
    },
    renderer(token: { type: string; raw: string; text: string }) {
      const safe = token.text.replace(/"/g, '"');
      return `<a href="#" class="wiki-link text-primary hover:underline font-medium" data-title="${safe}">${safe}</a>`;
    },
  };
}

export default function WikiMarkdown({ content, className, onNavigate }: WikiMarkdownProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('wiki-link')) {
        e.preventDefault();
        const title = target.getAttribute('data-title');
        if (title && onNavigate) onNavigate(title);
      }
    },
    [onNavigate]
  );

  // Memoize the isolated Marked instance to prevent memory leaks and configuration overrides
  const parser = useMemo(() => {
    return new Marked({
      extensions: [wikiLinkExtension() as any],
      renderer: {
        heading(this: any, token: any) {
          // Render inline markdown elements inside the heading
          const text = this.parser.parseInline(token.tokens);
          const slug = token.text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
          
          let sizeClass = 'text-xl';
          if (token.depth === 1) sizeClass = 'text-3xl font-extrabold border-b border-border/40 pb-2 mb-6';
          else if (token.depth === 2) sizeClass = 'text-2xl font-bold border-b border-border/20 pb-1 mt-8 mb-4';
          else if (token.depth === 3) sizeClass = 'text-xl font-semibold mt-6 mb-3';
          else sizeClass = 'text-lg font-medium mt-4 mb-2';

          return `<h${token.depth} id="${slug}" class="scroll-mt-24 group relative ${sizeClass}">${text}</h${token.depth}>`;
        }
      }
    });
  }, []);

  const html = parser.parse(content) as string;

  return (
    <div
      className={cn('wiki-markdown prose dark:prose-invert max-w-none prose-headings:scroll-mt-24', className)}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
