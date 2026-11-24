"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Tone = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  show: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export const useToast = () => useContext(ToastContext);

const VISIBLE_MS = 4200;

/** Small slide-in toasts at the bottom of the screen. Lives in the host layout so it survives navigation. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), VISIBLE_MS);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence initial={false}>
          {items.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              role="status"
              data-testid="toast"
              initial={{ opacity: 0, y: 28, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="pointer-events-auto relative flex min-h-12 w-full max-w-sm items-center gap-3 overflow-hidden rounded-full border border-gold bg-primary py-2 pr-2 pl-4 text-primary-foreground shadow-xl"
            >
              {toast.tone === "success" ? (
                <CheckCircle2 size={20} className="shrink-0 text-gold" aria-hidden="true" />
              ) : (
                <CircleAlert size={20} className="shrink-0 text-gold" aria-hidden="true" />
              )}
              <span className="flex-1 text-sm font-semibold">{toast.message}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="grid size-8 place-items-center rounded-full text-primary-foreground/80 hover:bg-white/10"
              >
                <X size={16} aria-hidden="true" />
              </button>
              <motion.span
                aria-hidden="true"
                className="absolute bottom-0 left-0 h-0.5 bg-gold"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: VISIBLE_MS / 1000, ease: "linear" }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
