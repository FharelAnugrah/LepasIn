'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const MAX_TOASTS = 3;

const TOAST_VARIANTS = {
  success: {
    title: 'Berhasil',
    icon: CheckCircle2,
    role: 'status',
    accentClass: 'border-l-success-text',
    iconBgClass: 'bg-success-bg text-success-text border-green-200',
    titleClass: 'text-success-text',
  },
  error: {
    title: 'Gagal',
    icon: AlertCircle,
    role: 'alert',
    accentClass: 'border-l-danger-text',
    iconBgClass: 'bg-danger-bg text-danger-text border-red-200',
    titleClass: 'text-danger-text',
  },
  warning: {
    title: 'Perhatian',
    icon: AlertTriangle,
    role: 'status',
    accentClass: 'border-l-warning-text',
    iconBgClass: 'bg-warning-bg text-warning-text border-amber-200',
    titleClass: 'text-warning-text',
  },
  info: {
    title: 'Informasi',
    icon: Info,
    role: 'status',
    accentClass: 'border-l-brand-blue',
    iconBgClass: 'bg-brand-blue-soft text-brand-blue border-brand-blue-border',
    titleClass: 'text-brand-blue',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const activeKeysRef = useRef(new Map());
  const orderRef = useRef([]);

  const clearToastTimer = useCallback((id) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
  }, []);

  const unregisterToastMeta = useCallback((id) => {
    const idx = orderRef.current.findIndex((item) => item.id === id);
    if (idx !== -1) {
      const [removed] = orderRef.current.splice(idx, 1);
      if (removed && activeKeysRef.current.get(removed.key) === id) {
        activeKeysRef.current.delete(removed.key);
      }
    }
  }, []);

  const removeToast = useCallback(
    (id) => {
      clearToastTimer(id);
      unregisterToastMeta(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearToastTimer, unregisterToastMeta]
  );

  const scheduleToastRemoval = useCallback(
    (id, duration) => {
      clearToastTimer(id);
      if (duration > 0) {
        const timerId = setTimeout(() => {
          timersRef.current.delete(id);
          unregisterToastMeta(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
        timersRef.current.set(id, timerId);
      }
    },
    [clearToastTimer, unregisterToastMeta]
  );

  const addToast = useCallback(
    (message, type = 'info', optionsOrDuration) => {
      const text = String(message ?? '').trim();
      if (!text) return;

      const variantConfig = TOAST_VARIANTS[type] || TOAST_VARIANTS.info;
      const opts =
        typeof optionsOrDuration === 'number'
          ? { duration: optionsOrDuration }
          : optionsOrDuration || {};

      const resolvedTitle = opts.title || variantConfig.title;
      const duration =
        typeof opts.duration === 'number'
          ? opts.duration
          : type === 'error'
          ? 4500
          : 3500;

      const toastKey = `${type}::${resolvedTitle}::${text}`;
      const existingId = activeKeysRef.current.get(toastKey);

      // Deduplikasi toast identik yang sedang tampil: cukup perpanjang durasinya tanpa menumpuk kartu baru
      if (existingId) {
        scheduleToastRemoval(existingId, duration);
        return;
      }

      const id = Date.now() + Math.random().toString(36).substring(2, 9);

      while (orderRef.current.length >= MAX_TOASTS) {
        const oldest = orderRef.current.shift();
        if (oldest) {
          clearToastTimer(oldest.id);
          if (activeKeysRef.current.get(oldest.key) === oldest.id) {
            activeKeysRef.current.delete(oldest.key);
          }
        }
      }

      orderRef.current.push({ id, key: toastKey });
      activeKeysRef.current.set(toastKey, id);
      const keptIds = new Set(orderRef.current.map((item) => item.id));

      setToasts((prev) => [
        ...prev.filter((t) => keptIds.has(t.id)),
        { id, title: resolvedTitle, message: text, type },
      ]);
      scheduleToastRemoval(id, duration);
    },
    [clearToastTimer, scheduleToastRemoval]
  );

  useEffect(() => {
    const timers = timersRef.current;
    const activeKeys = activeKeysRef.current;
    const order = orderRef.current;
    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
      activeKeys.clear();
      order.length = 0;
    };
  }, []);

  const toast = useMemo(
    () => ({
      success: (msg, optionsOrDuration) => addToast(msg, 'success', optionsOrDuration),
      error: (msg, optionsOrDuration) => addToast(msg, 'error', optionsOrDuration),
      warning: (msg, optionsOrDuration) => addToast(msg, 'warning', optionsOrDuration),
      info: (msg, optionsOrDuration) => addToast(msg, 'info', optionsOrDuration),
    }),
    [addToast]
  );

  useEffect(() => {
    const handleWheel = () => {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Penggerak perspektif 3D ringan (tanpa re-render React, menghormati prefers-reduced-motion)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches || reducedMotion.matches) return;

    let activeEl = null;
    let rafId = 0;

    const resetEl = (el) => {
      if (!el) return;
      el.removeAttribute('data-tilting');
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
      el.style.setProperty('--tilt-lift', '0px');
      el.style.setProperty('--glare-opacity', '0');
    };

    const getIntensity = (mode) => {
      if (mode === 'hero') return { maxDeg: 4.5, lift: -3 };
      if (mode === 'stage') return { maxDeg: 4, lift: -2 };
      if (mode === 'kpi') return { maxDeg: 5.5, lift: -4 };
      return { maxDeg: 6.5, lift: -5 };
    };

    const handlePointerMove = (e) => {
      const target = e.target instanceof Element ? e.target.closest('[data-tilt-3d]') : null;

      if (activeEl && activeEl !== target) {
        resetEl(activeEl);
        activeEl = null;
      }

      if (!target) return;
      activeEl = target;

      const clientX = e.clientX;
      const clientY = e.clientY;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!activeEl) return;
        const rect = activeEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const px = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const py = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        const { maxDeg, lift } = getIntensity(activeEl.getAttribute('data-tilt-3d'));

        const rotateX = ((0.5 - py) * 2 * maxDeg).toFixed(2);
        const rotateY = ((px - 0.5) * 2 * maxDeg).toFixed(2);

        activeEl.setAttribute('data-tilting', 'true');
        activeEl.style.setProperty('--tilt-x', `${rotateX}deg`);
        activeEl.style.setProperty('--tilt-y', `${rotateY}deg`);
        activeEl.style.setProperty('--tilt-lift', `${lift}px`);
        activeEl.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
        activeEl.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
        activeEl.style.setProperty('--glare-opacity', '1');
      });
    };

    const handlePointerReset = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (activeEl) {
        resetEl(activeEl);
        activeEl = null;
      }
    };

    const handlePointerDown = () => {
      if (activeEl) {
        activeEl.style.setProperty('--tilt-lift', '-1px');
      }
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.addEventListener('pointerleave', handlePointerReset);
    window.addEventListener('blur', handlePointerReset);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (activeEl) resetEl(activeEl);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerleave', handlePointerReset);
      window.removeEventListener('blur', handlePointerReset);
    };
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifikasi"
        className="fixed z-[9999] pointer-events-none flex flex-col gap-2.5 top-25 inset-x-3 mx-auto max-w-md md:inset-x-auto md:top-20 md:bottom-auto md:right-6 md:w-[22rem] md:mx-0"
      >
        {toasts.map((t) => {
          const variant = TOAST_VARIANTS[t.type] || TOAST_VARIANTS.info;
          const Icon = variant.icon;
          return (
            <div
              key={t.id}
              role={variant.role}
              className={`pointer-events-auto surface-3d border-l-4 ${variant.accentClass} rounded-2xl p-3.5 flex items-start gap-3 animate-modal-3d`}
            >
              <span
                className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${variant.iconBgClass}`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold tracking-tight leading-tight ${variant.titleClass}`}>
                  {t.title}
                </p>
                <p className="text-xs text-ink-secondary leading-relaxed break-words mt-0.5">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-ink-muted hover:text-ink hover:bg-surface-muted p-1 rounded-lg transition-colors shrink-0 -mt-0.5 -mr-0.5"
                aria-label="Tutup notifikasi"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      success: (msg) => console.log('Toast success:', msg),
      error: (msg) => console.error('Toast error:', msg),
      warning: (msg) => console.warn('Toast warning:', msg),
      info: (msg) => console.log('Toast info:', msg),
    };
  }
  return context;
}
