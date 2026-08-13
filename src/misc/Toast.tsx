import { createContext, useCallback, useContext, useState } from "react";
import { Check, CircleAlert, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2 rounded shadow-lg text-sm pointer-events-auto ${
              t.type === "success"
                ? "bg-success text-success-content"
                : t.type === "error"
                  ? "bg-error text-error-content"
                  : "bg-info text-info-content"
            }`}
            data-motion-state="enter"
            role={t.type === "error" ? "alert" : "status"}
            aria-live={t.type === "error" ? undefined : "polite"}
          >
            {t.type === "success" ? <Check aria-hidden="true" size={16} /> : null}
            {t.type === "error" ? <CircleAlert aria-hidden="true" size={16} /> : null}
            {t.type === "info" ? <Info aria-hidden="true" size={16} /> : null}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
