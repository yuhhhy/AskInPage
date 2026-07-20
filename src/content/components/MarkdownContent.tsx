import Markdown from 'markdown-to-jsx/react';

interface MarkdownContentProps {
  content: string;
  streaming: boolean;
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
      {content}
    </Markdown>
  );
}
