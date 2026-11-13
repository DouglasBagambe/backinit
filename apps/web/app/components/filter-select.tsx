"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
type Option = { value: string; label: string };
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId(),
    button = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [position, setPosition] = useState<React.CSSProperties>({});
  const current = options.find((o) => o.value === value);
  useEffect(() => {
    if (!open) return;
    const hide = () => menu.current?.hidePopover();
    window.addEventListener("resize", hide);
    return () => window.removeEventListener("resize", hide);
  }, [open]);
  function show() {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    setQuery("");
    setPosition({
      left: Math.max(
        12,
        Math.min(rect.left, innerWidth - Math.min(360, innerWidth - 24) - 12),
      ),
      width: Math.min(360, innerWidth - 24),
      top: Math.min(rect.bottom + 8, innerHeight - 160),
      maxHeight: Math.max(140, Math.min(360, innerHeight - rect.bottom - 20)),
    });
    menu.current?.showPopover();
  }
  function choose(v: string) {
    onChange(v);
    menu.current?.hidePopover();
    button.current?.focus();
  }
  return (
    <div className="filter-select">
      <span className="filter-select-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={button}
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        className="filter-select-trigger"
        onClick={() => (open ? menu.current?.hidePopover() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
            requestAnimationFrame(() =>
              menu.current
                ?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
                ?.focus(),
            );
          }
        }}
      >
        <span id={`${id}-value`}>{current?.label || options[0]?.label}</span>
        <ChevronDown size={17} />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className="filter-select-menu source-picker-menu"
        style={position}
        onToggle={(e) => setOpen(e.newState === "open")}
        onKeyDown={(e) => {
          const opts = Array.from(
            menu.current?.querySelectorAll<HTMLButtonElement>(
              '[role="option"]',
            ) || [],
          );
          if (!opts.length) return;
          const i = opts.indexOf(document.activeElement as HTMLButtonElement);
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            opts[
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? opts.length - 1
                  : (i + (e.key === "ArrowDown" ? 1 : -1) + opts.length) %
                    opts.length
            ]?.focus();
          }
        }}
      >
        <div className="source-picker-heading">
          <strong>{label}</strong>
          <span>{options.length} choices</span>
        </div>
        {options.length > 8 && (
          <label className="source-picker-search">
            <Search size={16} />
            <input
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        <div
          className="source-picker-options"
          role="listbox"
          aria-label={label}
        >
          {options
            .filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
            .map((o) => (
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                key={o.value}
                onClick={() => choose(o.value)}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={16} />}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
