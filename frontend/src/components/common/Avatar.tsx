import type { ReactNode } from "react";

const AVATAR_COLORS = [
  "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300",
  "bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-900 dark:text-terracotta-300",
  "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-200",
];

export function Avatar({
  seed,
  className = "w-10 h-10 rounded-xl text-sm",
  children,
}: {
  seed: string;
  className?: string;
  children: ReactNode;
}) {
  const colorIndex =
    seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    AVATAR_COLORS.length;
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 font-semibold ${AVATAR_COLORS[colorIndex]} ${className}`}
    >
      {children}
    </div>
  );
}