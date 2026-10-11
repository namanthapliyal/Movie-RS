'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

type ToastVariant = 'default' | 'destructive' | 'success';

interface ToastProps {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

type ToastEvent =
  | { type: 'add'; toast: ToastProps }
  | { type: 'remove'; id: string };

const toastListeners = new Set<(event: ToastEvent) => void>();
let nextToastId = 0;

export function toast({ title, description, variant = 'default' }: Omit<ToastProps, 'id'>) {
  const id = `toast-${++nextToastId}`;
  const newToast: ToastProps = {
    id,
    title,
    description,
    variant
  };

  toastListeners.forEach(listener => listener({ type: 'add', toast: newToast }));
  setTimeout(() => {
    toastListeners.forEach(listener => listener({ type: 'remove', id }));
  }, 5000);

  return {
    id,
    dismiss: () => toastListeners.forEach(listener => listener({ type: 'remove', id }))
  };
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  useEffect(() => {
    const listener = (event: ToastEvent) => {
      if (event.type === 'add') {
        setToasts(prev => [...prev, event.toast]);
      } else {
        setToasts(prev => prev.filter(item => item.id !== event.id));
      }
    };

    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  const dismiss = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(item => item.id !== toastId));
  }, []);

  return {
    toasts,
    dismiss
  };
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const { toasts } = useToast();

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex w-[320px] items-start gap-4 rounded-lg border p-4 ${
              toast.variant === 'destructive'
                ? 'bg-destructive/90 text-destructive-foreground border-destructive/20'
                : toast.variant === 'success'
                  ? 'bg-success/90 text-success-foreground border-success/20'
                  : 'bg-primary/90 text-primary-foreground border-primary/20'
            }`}
            role="alert"
          >
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-md">
              {toast.variant === 'destructive' && (
                <svg className="h-5 w-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {toast.variant === 'success' && (
                <svg className="h-5 w-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.variant === 'default' && (
                <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M5 18V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2h-5l-5 5-5-5H5z" />
                </svg>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {toast.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}