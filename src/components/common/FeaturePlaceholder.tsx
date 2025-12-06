import type { ReactNode } from 'react';

interface FeaturePlaceholderProps {
  /** Optional icon rendered above the title */
  icon?: ReactNode;
  /** Short title explaining what this area does */
  title: string;
  /** Extra context for the user */
  description: string;
  /** Optional action buttons */
  actions?: ReactNode;
}

/**
 * Generic placeholder used for routes that are not fully implemented yet.
 * Keeps the layout consistent and avoids showing a completely blank page.
 */
function FeaturePlaceholder({ icon, title, description, actions }: FeaturePlaceholderProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary/30 text-primary shadow-inner">
        {icon ?? (
          <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-primary">{title}</h2>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>

      {actions && <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  );
}

export default FeaturePlaceholder;
