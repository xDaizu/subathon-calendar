import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  undo?: () => Promise<void> | void;
  tone?: 'default' | 'error';
}

interface ToastCtx {
  show: (message: string, opts?: { undo?: ToastItem['undo']; tone?: ToastItem['tone'] }) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ undoLabel, children }: { undoLabel: string; children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastCtx['show']>(
    (message, opts) => {
      const id = ++seq.current;
      // Keep only the latest toast: the streamer only cares about the last action.
      setItems([{ id, message, ...opts }]);
      setTimeout(() => dismiss(id), opts?.undo ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className={`pointer-events-auto flex min-h-14 w-full max-w-md items-center gap-3 rounded-2xl px-4 py-2 shadow-2xl ring-1 backdrop-blur-xl ${
                t.tone === 'error' ? 'bg-red-950/90 ring-red-400/30' : 'bg-ink-700/95 ring-white/10'
              }`}
            >
              <span className="flex-1 text-sm font-medium">{t.message}</span>
              {t.undo && (
                <button
                  className="h-10 rounded-xl bg-white/10 px-4 text-sm font-bold text-white transition active:scale-95"
                  onClick={async () => {
                    dismiss(t.id);
                    await t.undo?.();
                  }}
                >
                  ↶ {undoLabel}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast outside ToastProvider');
  return c;
}
