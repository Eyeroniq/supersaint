import { ReactNode, useEffect } from "react";
import { PiX } from "react-icons/pi";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right" | "top";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Slide-in panel with a dimmed backdrop. Stays mounted so it can animate out.
const Drawer = ({ open, onClose, side = "left", title, children, className = "" }: DrawerProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [open, onClose]);

  return (
    <div className={`drawer drawer--${side} ${open ? "is-open" : ""} ${className}`} aria-hidden={!open}>
      <div className="drawer__backdrop" onClick={onClose} />
      <aside className="drawer__panel" role="dialog" aria-modal="true">
        {title !== undefined && (
          <header className="drawer__head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <PiX />
            </button>
          </header>
        )}
        {children}
      </aside>
    </div>
  );
};

export default Drawer;
