import * as React from "react"

export interface ToastProps {
  id?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
}

export const ToastContext = React.createContext<{
  toasts: ToastProps[];
  toast: (props: ToastProps) => void;
  dismiss: (id: string) => void;
}>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

export const useToast = () => React.useContext(ToastContext);

export const Toaster = () => {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all ${
            t.variant === "destructive"
              ? "destructive group border-destructive bg-destructive text-destructive-foreground"
              : "border bg-background text-foreground"
          } mt-4 sm:mt-0 sm:mb-4`}
        >
          <div className="grid gap-1">
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            {t.description && (
              <div className="text-sm opacity-90">{t.description}</div>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id!)}
            className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
};
