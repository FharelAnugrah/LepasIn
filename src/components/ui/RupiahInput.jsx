'use client';

import { forwardRef, useId, useLayoutEffect, useRef } from 'react';
import {
  countDigitsBeforeCursor,
  findCursorPosForDigitCount,
  formatThousandDots,
  removeDigitAtOccurrence,
  sanitizePriceDigits,
} from '@/lib/price-input';

const SIZE_STYLES = {
  sm: {
    input:
      'w-full h-9 pr-2 rounded-lg border text-xs tabular-nums text-ink placeholder:text-ink-muted outline-none focus:bg-surface disabled:opacity-60 disabled:bg-surface-muted',
    withPrefix: 'pl-7',
    noPrefix: 'pl-2.5',
    prefix: 'left-2.5 text-[11px]',
  },
  md: {
    input:
      'input-3d w-full h-11 pr-3.5 rounded-lg font-sans text-base md:text-sm tabular-nums text-ink placeholder:text-ink-muted border outline-none disabled:opacity-60 disabled:bg-surface-muted',
    withPrefix: 'pl-10',
    noPrefix: 'pl-3.5',
    prefix: 'left-3.5 text-sm',
  },
};

const TONE_STYLES = {
  surface: 'bg-surface',
  canvas: 'bg-canvas focus:bg-surface',
};

/**
 * Input nominal Rupiah dengan pemisah ribuan titik otomatis saat mengetik,
 * prefix "Rp", keypad numerik mobile, dan penjagaan posisi kursor.
 * Nilai `value` & `onValueChange` tetap berupa string digit murni (mis. "50000").
 */
const RupiahInput = forwardRef(function RupiahInput(
  {
    id,
    label,
    srOnlyLabel,
    error,
    helperText,
    value = '',
    onValueChange,
    onEnterPress,
    onKeyDown,
    placeholder = '0',
    size = 'md',
    tone,
    showPrefix = true,
    maxDigits = 12,
    required = false,
    disabled = false,
    className = '',
    ...props
  },
  forwardedRef
) {
  const generatedId = useId();
  const inputId =
    id ||
    (label ? `${label.toLowerCase().replace(/\s+/g, '-')}-${generatedId}` : generatedId);
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = !error && helperText ? `${inputId}-helper` : undefined;

  const localInputRef = useRef(null);
  const pendingCursorDigitsRef = useRef(null);

  const displayValue = formatThousandDots(value);
  const sizeConfig = SIZE_STYLES[size] || SIZE_STYLES.md;
  const resolvedTone = tone || (size === 'sm' ? 'canvas' : 'surface');
  const toneClass = TONE_STYLES[resolvedTone] || TONE_STYLES.surface;

  const setInputRef = (node) => {
    localInputRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  useLayoutEffect(() => {
    const el = localInputRef.current;
    const pendingDigits = pendingCursorDigitsRef.current;
    if (!el || pendingDigits === null) return;
    pendingCursorDigitsRef.current = null;

    if (document.activeElement === el && typeof el.setSelectionRange === 'function') {
      const nextPos = findCursorPosForDigitCount(displayValue, pendingDigits);
      el.setSelectionRange(nextPos, nextPos);
    }
  });

  const handleChange = (e) => {
    const el = e.target;
    const rawInput = el.value;
    const cursor = el.selectionStart ?? rawInput.length;
    const digitsBeforeCursor = countDigitsBeforeCursor(rawInput, cursor);
    const nextDigits = sanitizePriceDigits(rawInput, maxDigits);

    pendingCursorDigitsRef.current = Math.min(digitsBeforeCursor, nextDigits.length);
    onValueChange?.(nextDigits);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnterPress?.(e);
      onKeyDown?.(e);
      return;
    }

    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    // Izinkan Backspace/Delete melewati pemisah titik tanpa terasa macet
    if (
      (e.key === 'Backspace' || e.key === 'Delete') &&
      start !== null &&
      end !== null &&
      start === end
    ) {
      const formatted = el.value;
      if (e.key === 'Backspace' && start > 0 && formatted[start - 1] === '.') {
        e.preventDefault();
        const digitsBefore = countDigitsBeforeCursor(formatted, start);
        const currentDigits = sanitizePriceDigits(formatted, maxDigits);
        if (digitsBefore > 0) {
          const nextDigits = removeDigitAtOccurrence(currentDigits, digitsBefore - 1);
          pendingCursorDigitsRef.current = digitsBefore - 1;
          onValueChange?.(nextDigits);
        }
        return;
      }

      if (e.key === 'Delete' && start < formatted.length && formatted[start] === '.') {
        e.preventDefault();
        const digitsBefore = countDigitsBeforeCursor(formatted, start);
        const currentDigits = sanitizePriceDigits(formatted, maxDigits);
        if (digitsBefore < currentDigits.length) {
          const nextDigits = removeDigitAtOccurrence(currentDigits, digitsBefore);
          pendingCursorDigitsRef.current = digitsBefore;
          onValueChange?.(nextDigits);
        }
        return;
      }
    }

    // Abaikan tanda baca/notasi ilmiah agar kebiasaan mengetik titik/koma tidak mengganggu
    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      ['e', 'E', '+', '-', '.', ','].includes(e.key)
    ) {
      e.preventDefault();
      return;
    }

    onKeyDown?.(e);
  };

  const borderClasses = error
    ? 'border-danger-text focus:border-danger-text focus:ring-3 focus:ring-danger-bg'
    : size === 'sm'
      ? 'border-border-subtle focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-soft'
      : 'border-border-subtle focus:border-brand-blue focus:ring-3 focus:ring-brand-blue-soft';

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-ink-secondary flex items-center justify-between"
        >
          <span>{label}</span>
        </label>
      ) : srOnlyLabel ? (
        <label htmlFor={inputId} className="sr-only">
          {srOnlyLabel}
        </label>
      ) : null}

      <div className="relative flex items-center">
        {showPrefix && (
          <span
            aria-hidden="true"
            className={`absolute font-semibold text-ink-muted pointer-events-none select-none ${sizeConfig.prefix}`}
          >
            Rp
          </span>
        )}

        <input
          ref={setInputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId || helperId}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={`${sizeConfig.input} ${toneClass} ${
            showPrefix ? sizeConfig.withPrefix : sizeConfig.noPrefix
          } ${borderClasses} ${className}`}
          {...props}
        />
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger-text font-medium mt-0.5">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-ink-muted mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default RupiahInput;
