import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  /** Optional Space Mono caps line under the title, e.g. "TRIP TO GOA LEDGER". */
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  lg: "max-w-2xl",
};

// Generic overlay used for New Group and Add Expense — reuses one
// backdrop/close-handling implementation instead of each modal rolling its own.
export function Modal({ title, subtitle, onClose, children, size = "sm" }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 px-4"
      onClick={onClose}
    >
      <div
        className={`hard-shadow w-full ${SIZE_CLASSES[size]} max-h-[90vh] overflow-y-auto border-2 border-on-surface bg-surface`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-on-surface bg-surface-container-high px-6 py-4">
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">{title}</h2>
            {subtitle && (
              <p className="label-caps mt-1.5 text-on-surface-variant opacity-80">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant transition-colors hover:text-error"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
