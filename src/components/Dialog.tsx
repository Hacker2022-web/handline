import { useEffect, useRef, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

export function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current; dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); onCloseRef.current(); }}>
    <div className="dialog-heading"><div><span className="eyebrow">YOUR PERSONAL VOCABULARY</span><h2 id="dialog-title">{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={22} /></button></div>
    {children}
  </dialog>;
}
