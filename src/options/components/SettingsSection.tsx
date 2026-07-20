import type { ReactNode } from 'react';

interface SettingsSectionProps {
  index: string;
  title: string;
  titleId: string;
  children: ReactNode;
}

export function SettingsSection({ index, title, titleId, children }: SettingsSectionProps) {
  return (
    <section className="settings-section" aria-labelledby={titleId}>
      <div className="section-heading">
        <span>{index}</span>
        <h2 id={titleId}>{title}</h2>
      </div>
      {children}
    </section>
  );
}
