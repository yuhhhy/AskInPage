import { Info } from 'lucide-react';

interface InfoHintProps {
  text: string;
}

export function InfoHint({ text }: InfoHintProps) {
  return (
    <span
      className="info-hint"
      tabIndex={0}
      aria-label={text}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <Info size={15} strokeWidth={2} aria-hidden="true" />
      <span className="info-tooltip" role="tooltip">{text}</span>
    </span>
  );
}
