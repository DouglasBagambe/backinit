"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Radio, Search } from "lucide-react";
type Source = { id: string; label: string; url: string };
/** A top-layer menu stays above iframe content and remains in the fullscreen root. */
export function SourcePicker({
  sources,
  selected,
  title,
  onChange,
}: {
  sources: Source[];
  selected?: string;
  title: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<React.CSSProperties>({});
  const choice = sources.find((s) => s.id === selected) || sources[0];
  const filtered = sources.filter((s, i) =>
    `Stream ${i + 1} ${s.label}`.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (!open) return;
    const hide = () => menu.current?.hidePopover();
    const scroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) hide();
    };
    window.addEventListener("resize", hide);
    document.addEventListener("scroll", scroll, true);
    return () => {
      window.removeEventListener("resize", hide);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  function show() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect || !menu.current) return;
    const above = rect.top > 240;
    setPosition({
      left: Math.max(
        12,
        Math.min(rect.left, innerWidth - Math.min(420, innerWidth - 24) - 12),
      ),
      width: Math.min(420, innerWidth - 24),
      ...(above
        ? {
            bottom: innerHeight - rect.top + 8,
            top: "auto",
            maxHeight: Math.min(380, rect.top - 20),
          }
        : {
            top: rect.bottom + 8,
            bottom: "auto",
            maxHeight: Math.max(100, innerHeight - rect.bottom - 20),
          }),
    });
    setQuery("");
    menu.current.showPopover();
  }
  function choose(source: Source) {
    onChange(source.id);
    menu.current?.hidePopover();
    trigger.current?.focus();
  }
  return (
    <div className="source-picker">
      <button
        ref={trigger}
        className="source-picker-trigger"
        aria-labelledby={`${id}-label ${id}-title`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
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
        <span className="source-picker-symbol">
          <Radio size={18} />
        </span>
        <span className="source-picker-copy" id={`${id}-label`}>
          <small>
            STREAM SOURCE <span>{sources.length}</span>
          </small>
          <strong>{choice?.label || "Choose stream"}</strong>
        </span>
        <span id={`${id}-title`} className="sr-only">
          for {title}
        </span>
        <ChevronDown size={18} className={open ? "is-open" : ""} />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className="source-picker-menu"
        style={position}
        onToggle={(e) => setOpen(e.newState === "open")}
        onKeyDown={(e) => {
          const options = Array.from(
            menu.current?.querySelectorAll<HTMLButtonElement>(
              '[role="option"]',
            ) || [],
          );
          const index = options.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (
            ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) &&
            options.length
          ) {
            e.preventDefault();
            const next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? options.length - 1
                  : (index +
                      (e.key === "ArrowDown" ? 1 : -1) +
                      options.length) %
                    options.length;
            options[next]?.focus();
          }
        }}
      >
        <div className="source-picker-heading">
          <strong>Choose your stream</strong>
          <span>{sources.length} options</span>
        </div>
        {sources.length > 8 && (
          <label className="source-picker-search">
            <Search size={16} />
            <input
              aria-label="Search stream sources"
              placeholder="Find a stream…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        <div
          role="listbox"
          aria-label={`Sources for ${title}`}
          className="source-picker-options"
        >
          {filtered.map((s) => (
            <button
              key={s.id}
              role="option"
              aria-selected={s.id === choice?.id}
              onClick={() => choose(s)}
            >
              <span className="source-picker-number">
                {sources.indexOf(s) + 1}
              </span>
              <span>
                <strong>{s.label}</strong>
                <small>Stream {sources.indexOf(s) + 1}</small>
              </span>
              {s.id === choice?.id && <Check size={18} />}
            </button>
          ))}
        </div>
        {!filtered.length && <p role="status">No matching streams.</p>}
      </div>
    </div>
  );
}
