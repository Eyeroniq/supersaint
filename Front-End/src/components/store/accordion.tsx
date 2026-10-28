import { ReactNode, useState } from "react";

interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  icon?: "chevron" | "plus";
  defaultOpen?: boolean;
}

const Accordion = ({ title, children, icon = "chevron", defaultOpen = false }: AccordionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`accordion ${open ? "is-open" : ""}`}>
      <button className="accordion__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{title}</span>
        <span className={`accordion__icon accordion__icon--${icon}`} aria-hidden />
      </button>
      {/* grid-rows trick animates to the content's natural height */}
      <div className="accordion__panel">
        <div className="accordion__inner">{children}</div>
      </div>
    </div>
  );
};

export default Accordion;
