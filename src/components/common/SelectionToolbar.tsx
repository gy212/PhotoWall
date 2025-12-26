import React from 'react';
import clsx from 'clsx';

interface SelectionToolbarProps {
  selectedCount: number;
  children: React.ReactNode;
  className?: string;
  onClear: () => void;
}

export function SelectionToolbar({
  selectedCount,
  children,
  className,
  onClear,
}: SelectionToolbarProps) {
  return (
    <div
      className={clsx(
        'absolute bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-on-surface/90 backdrop-blur-xl px-4 py-2 text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300',
        className
      )}
    >
      <div className="px-3 py-1 bg-white/10 rounded-xl mr-2">
        <span className="text-sm font-bold tracking-tight whitespace-nowrap">
          已选择 {selectedCount} 项
        </span>
      </div>

      {children}

      <div className="w-px h-8 bg-white/20 mx-1" />

      <button
        onClick={onClear}
        className="group flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-white/10 transition-all active:scale-90"
        title="取消选择"
      >
        <span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform">
          close
        </span>
        <span className="text-[10px] font-medium mt-0.5">取消</span>
      </button>
    </div>
  );
}

interface SelectionActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  iconClassName?: string;
  labelClassName?: string;
}

export function SelectionAction({
  icon,
  label,
  className,
  iconClassName,
  labelClassName,
  children,
  ...props
}: SelectionActionProps & { children?: React.ReactNode }) {
  return (
    <button
      className={clsx(
        'group flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-white/10 transition-all active:scale-90 disabled:opacity-50 relative',
        className
      )}
      {...props}
    >
      <span
        className={clsx(
          'material-symbols-outlined text-2xl group-hover:scale-110 transition-transform',
          iconClassName
        )}
      >
        {icon}
      </span>
      <span className={clsx('text-[10px] font-medium mt-0.5', labelClassName)}>{label}</span>
      {children}
    </button>
  );
}

export function SelectionDivider() {
  return <div className="w-px h-8 bg-white/20 mx-1" />;
}