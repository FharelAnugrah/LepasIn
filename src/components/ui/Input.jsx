'use client';

import {
  Children,
  Fragment,
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronDown, Check } from 'lucide-react';

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon: Icon,
    iconRight: IconRight,
    pill = false,
    className = '',
    id,
    type = 'text',
    readOnly,
    onWheel,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || (label ? `${label.toLowerCase().replace(/\s+/g, '-')}-${generatedId}` : generatedId);
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = !error && helperText ? `${inputId}-helper` : undefined;
  const radius = pill ? 'rounded-full' : 'rounded-lg';
  const resolvedReadOnly =
    readOnly ?? (props.value !== undefined && !props.onChange && props.disabled ? true : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-ink-secondary flex items-center justify-between"
        >
          <span>{label}</span>
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-ink-muted pointer-events-none">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId || helperId}
          className={`input-3d w-full h-11 ${Icon ? 'pl-10' : 'pl-3.5'} ${
            IconRight ? 'pr-10' : 'pr-3.5'
          } ${radius} bg-surface font-sans text-ink text-base md:text-sm placeholder:text-ink-muted ${
            type === 'number' || type === 'tel' ? 'tabular-nums' : ''
          } border ${
            error
              ? 'border-danger-text focus:border-danger-text focus:ring-3 focus:ring-danger-bg'
              : 'border-border-subtle focus:border-brand-blue focus:ring-3 focus:ring-brand-blue-soft'
          } outline-none disabled:opacity-60 disabled:bg-surface-muted ${className}`}
          {...props}
          readOnly={resolvedReadOnly}
          onWheel={(e) => {
            if (type === 'number') {
              e.currentTarget.blur();
            }
            if (onWheel) {
              onWheel(e);
            }
          }}
        />

        {IconRight && (
          <div className="absolute right-2.5 text-ink-muted flex items-center">
            {IconRight}
          </div>
        )}
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

export default Input;

export const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    helperText,
    className = '',
    id,
    rows = 4,
    readOnly,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || (label ? `${label.toLowerCase().replace(/\s+/g, '-')}-${generatedId}` : generatedId);
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = !error && helperText ? `${inputId}-helper` : undefined;
  const resolvedReadOnly =
    readOnly ?? (props.value !== undefined && !props.onChange && props.disabled ? true : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-ink-secondary"
        >
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId || helperId}
        className={`input-3d w-full p-3.5 rounded-xl bg-surface text-ink text-base md:text-sm placeholder:text-ink-muted border ${
          error
            ? 'border-danger-text focus:border-danger-text focus:ring-3 focus:ring-danger-bg'
            : 'border-border-subtle focus:border-brand-blue focus:ring-3 focus:ring-brand-blue-soft'
        } outline-none resize-y disabled:opacity-60 disabled:bg-surface-muted ${className}`}
        {...props}
        readOnly={resolvedReadOnly}
      />

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

function extractOptionText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractOptionText).join('');
  return '';
}

function collectOptionElements(children, result = []) {
  Children.forEach(children, (child) => {
    if (!child || typeof child !== 'object') return;
    if (child.type === Fragment) {
      collectOptionElements(child.props.children, result);
      return;
    }
    if (child.type === 'option') {
      const label = extractOptionText(child.props.children);
      const val =
        child.props.value !== undefined && child.props.value !== null
          ? String(child.props.value)
          : label;
      result.push({
        value: val,
        label: label || val,
        disabled: Boolean(child.props.disabled),
      });
    }
  });
  return result;
}

export const Select = forwardRef(function Select(
  {
    label,
    ariaLabel,
    error,
    helperText,
    icon: Icon,
    className = '',
    id,
    name,
    value,
    defaultValue,
    onChange,
    disabled = false,
    placeholder = 'Pilih opsi...',
    dropdownAlign = 'left',
    options: optionsProp,
    children,
  },
  ref
) {
  const generatedId = useId();
  const inputId =
    id || (label ? `${label.toLowerCase().replace(/\s+/g, '-')}-${generatedId}` : generatedId);
  const listboxId = `${inputId}-listbox`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = !error && helperText ? `${inputId}-helper` : undefined;

  const containerRef = useRef(null);
  const internalTriggerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const options = useMemo(() => {
    if (Array.isArray(optionsProp)) {
      return optionsProp.map((opt) => ({
        value: String(opt.value ?? ''),
        label: String(opt.label ?? opt.value ?? ''),
        disabled: Boolean(opt.disabled),
      }));
    }
    return collectOptionElements(children);
  }, [optionsProp, children]);

  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    defaultValue !== undefined && defaultValue !== null
      ? String(defaultValue)
      : options[0]?.value ?? ''
  );

  const isControlled = value !== undefined;
  const currentValue = isControlled
    ? value === null
      ? ''
      : String(value)
    : uncontrolledValue;

  const selectedOption = options.find((opt) => opt.value === currentValue) || null;

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        internalTriggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const setTriggerRef = (node) => {
    internalTriggerRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const handleSelectOption = (opt) => {
    if (opt.disabled) return;
    if (!isControlled) {
      setUncontrolledValue(opt.value);
    }
    if (onChange) {
      onChange({
        target: { value: opt.value, name },
        currentTarget: { value: opt.value, name },
      });
    }
    setIsOpen(false);
    internalTriggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-1.5 relative">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-ink-secondary"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <button
          ref={setTriggerRef}
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? listboxId : undefined}
          aria-label={!label ? ariaLabel : undefined}
          aria-describedby={errorId || helperId}
          className={`input-3d w-full h-11 ${Icon ? 'pl-10' : 'pl-3.5'} pr-3 rounded-xl bg-surface text-base md:text-sm text-left flex items-center justify-between gap-2 border transition-all outline-none cursor-pointer disabled:opacity-60 disabled:bg-surface-muted disabled:cursor-not-allowed ${
            error
              ? 'border-danger-text focus:border-danger-text focus:ring-3 focus:ring-danger-bg'
              : isOpen
              ? 'border-brand-blue ring-3 ring-brand-blue-soft text-ink'
              : 'border-border-subtle hover:border-brand-blue/50 focus:border-brand-blue focus:ring-3 focus:ring-brand-blue-soft text-ink'
          } ${className}`}
        >
          {Icon && (
            <Icon
              className="w-4 h-4 text-ink-muted shrink-0 absolute left-3.5 pointer-events-none"
              aria-hidden="true"
            />
          )}
          <span className={`truncate ${selectedOption ? 'text-ink' : 'text-ink-muted'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-brand-blue' : 'text-ink-muted'
            }`}
            aria-hidden="true"
          />
        </button>

        {isOpen && !disabled && (
          <div
            id={listboxId}
            role="listbox"
            aria-label={label || ariaLabel || 'Daftar pilihan'}
            className={`dropdown-3d rounded-2xl p-1.5 z-30 absolute top-full mt-1.5 min-w-full w-max max-w-[min(22rem,calc(100vw-2rem))] max-h-64 overflow-y-auto flex flex-col gap-0.5 ${
              dropdownAlign === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === currentValue;
              return (
                <button
                  key={`${opt.value}-${opt.label}`}
                  type="button"
                  role="option"
                  disabled={opt.disabled}
                  aria-selected={isSelected}
                  onClick={() => handleSelectOption(opt)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs md:text-sm flex items-center justify-between gap-2.5 transition-colors ${
                    opt.disabled
                      ? 'opacity-50 cursor-not-allowed text-ink-muted'
                      : isSelected
                      ? 'bg-brand-blue-soft text-brand-blue font-semibold'
                      : 'text-ink hover:bg-canvas'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        )}
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
