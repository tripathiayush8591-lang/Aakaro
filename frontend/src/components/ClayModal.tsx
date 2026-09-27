import { useEffect, useRef, type ReactNode } from "react";

/** Native modal dialog supplies focus containment and makes the workspace inert. */
export function ClayModal({ title, children, onCancel, onConfirm, confirmLabel }: {
  title: string; children: ReactNode; onCancel: () => void;
  onConfirm: () => void; confirmLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="clay-modal clay" aria-labelledby="clay-modal-title"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const buttons = ref.current!.querySelectorAll<HTMLButtonElement>("button");
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }}
      onCancel={event => { event.preventDefault(); onCancel(); }}>
      <h2 id="clay-modal-title">{title}</h2>
      {children}
      <div className="tile-actions">
        <button className="btn btn-secondary" autoFocus onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onConfirm}>{confirmLabel} →</button>
      </div>
    </dialog>
  );
}
