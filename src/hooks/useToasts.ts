import { useCallback, useState } from 'react';
import type { Toast } from '@/types';
import { uid } from '@/lib/format';

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: Toast['type'], message: string) => {
    setToasts((prev) => [...prev, { id: uid('toast-'), type, message }]);
  }, []);

  return { toasts, push, dismiss };
}

export type ToastPush = (type: Toast['type'], message: string) => void;
