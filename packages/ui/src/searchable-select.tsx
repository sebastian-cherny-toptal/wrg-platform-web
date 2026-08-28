import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import "./searchable-select.css";

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search options…",
  emptyMessage = "No matching options",
  ariaLabel,
  disabled = false,
  required = false,
  className = "",
  name,
  id,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  ariaLabel: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  name?: string;
  id?: string;
}) {
  const generatedId = useId();
  const controlId = id ?? `searchable-select-${generatedId}`;
  const listboxId = `${controlId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      option.label.toLocaleLowerCase().includes(normalized),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]); // Intentionally reset only when the menu opens.

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const choose = (option: SearchableSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };

  const moveActive = (direction: 1 | -1) => {
    if (!filtered.length) return;
    let next = activeIndex;
    do {
      next = (next + direction + filtered.length) % filtered.length;
    } while (filtered[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div
      className={`wrg-searchable-select ${open ? "is-open" : ""} ${className}`.trim()}
      ref={rootRef}
    >
      <select
        aria-hidden="true"
        className="wrg-searchable-select__native"
        name={name}
        required={required}
        tabIndex={-1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => triggerRef.current?.focus());
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-required={required}
        className="wrg-searchable-select__trigger"
        disabled={disabled}
        id={controlId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className={selected ? "" : "is-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      {open ? (
        <div className="wrg-searchable-select__popover">
          <label className="wrg-searchable-select__search">
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m12.5 12.5 4 4" />
            </svg>
            <span className="wrg-searchable-select__sr-only">Search options</span>
            <input
              aria-label={searchPlaceholder}
              autoComplete="off"
              placeholder={searchPlaceholder}
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
            />
          </label>
          <div className="wrg-searchable-select__list" id={listboxId} role="listbox">
            {filtered.length ? (
              filtered.map((option, index) => (
                <button
                  aria-selected={option.value === value}
                  className={`${index === activeIndex ? "is-active" : ""} ${option.value === value ? "is-selected" : ""}`.trim()}
                  disabled={option.disabled}
                  key={option.value}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  role="option"
                  type="button"
                >
                  <span>{option.label}</span>
                  {option.value === value ? (
                    <svg aria-hidden="true" viewBox="0 0 20 20">
                      <path d="m4 10 4 4 8-9" />
                    </svg>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="wrg-searchable-select__empty">{emptyMessage}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
