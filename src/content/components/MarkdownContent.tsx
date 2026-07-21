import Markdown from 'markdown-to-jsx/react';

interface MarkdownContentProps {
  content: string;
  streaming: boolean;
}

const CODE_SEGMENT_PATTERN = /(```[\s\S]*?(?:```|$)|`[^`\n]*(?:`|$))/g;
const STRONG_BOUNDARY_AFTER_PUNCTUATION = /(\*\*(?=\S)(?:(?!\*\*)[\s\S])*?[\p{P}\p{S}]\*\*)(?=[\p{L}\p{N}])/gu;
const ZERO_WIDTH_SPACE_ENTITY = '&#8203;';

function normalizeStrongBoundaries(content: string): string {
  return content
    .split(CODE_SEGMENT_PATTERN)
    .map((segment) => {
      if (segment.startsWith('`')) return segment;
      return segment.replace(STRONG_BOUNDARY_AFTER_PUNCTUATION, `$1${ZERO_WIDTH_SPACE_ENTITY}`);
    })
    .join('');
}

export function MarkdownContent({ content, streaming }: MarkdownContentProps) {
  return (
    <Markdown
      options={{
        disableParsingRawHTML: true,
        tagfilter: true,
        optimizeForStreaming: streaming,
        overrides: {
          a: {
            props: {
              target: '_blank',
              rel: 'noreferrer noopener'
            }
          }
        }
      }}
    >
      {normalizeStrongBoundaries(content)}
    </Markdown>
  );
}
