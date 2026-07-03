import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

export const StoreBagIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d="M7 8a5 5 0 0 1 10 0" />
        <path d="M5.5 8h13l1 12h-15l1-12Z" />
        <path d="M12 11v5" />
        <path d="m9.8 13.8 2.2 2.2 2.2-2.2" />
      </svg>
    );
  },
);

StoreBagIcon.displayName = "StoreBagIcon";
