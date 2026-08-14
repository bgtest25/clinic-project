import { useMemo, useRef, useState } from 'react';
import { ICD10_COMMON_CODES } from '../data/icd10-common';

function parseChips(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CodePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chips = parseChips(value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ICD10_COMMON_CODES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  function addCode(code: string) {
    if (chips.includes(code)) {
      setQuery('');
      setOpen(false);
      return;
    }
    onChange([...chips, code].join(', '));
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeChip(code: string) {
    onChange(chips.filter((c) => c !== code).join(', '));
  }

  return (
    <div className="code-picker">
      {chips.length > 0 && (
        <div className="code-chip-row">
          {chips.map((chip) => (
            <span key={chip} className="code-chip">
              <span>{chip}</span>
              {!disabled && (
                <button
                  type="button"
                  className="code-chip-remove"
                  aria-label={`Remove ${chip}`}
                  onClick={() => removeChip(chip)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="code-picker-input-wrap">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search a code or description…"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-autocomplete="list"
          />
          {open && results.length > 0 && (
            <ul className="code-picker-results" role="listbox">
              {results.map((r) => (
                <li key={r.code}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addCode(r.code)}>
                    <span className="code-picker-code">{r.code}</span>
                    <span className="code-picker-desc">{r.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="code-picker-caption">
        Curated common-code list for quick entry — not the full ICD-10-CM set. Verify before billing.
      </p>
    </div>
  );
}
