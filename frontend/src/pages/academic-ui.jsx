import { cloneElement, useEffect, useId, useRef } from 'react'
import { inputClass, secondaryClass } from './academic-data'

export function Field({ label, children }) {
  const generated = useId()
  const id = children.props.id || generated
  return <div className="space-y-1.5"><label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>{cloneElement(children, { id })}</div>
}
export function Select({ label, items = [], value, onChange, required = false, empty = 'Pilih', disabled = false }) {
  return <Field label={label}><select required={required} disabled={disabled} className={inputClass} value={value} onChange={e => onChange(e.target.value)}><option value="">{empty}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}{item.student_number ? ` · ${item.student_number}` : ''}{item.teacher_number ? ` · ${item.teacher_number}` : ''}</option>)}</select></Field>
}
export function Alert({ children, success = false }) {
  return children ? <p role={success ? 'status' : 'alert'} className={`rounded-xl p-4 text-sm ${success ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'}`}>{children}</p> : null
}
export function Dialog({ title, children, onClose, busy = false }) {
  const ref = useRef(null)
  const current = useRef({ onClose, busy })
  useEffect(() => { current.current = { onClose, busy } }, [onClose, busy])
  useEffect(() => {
    const previous = document.activeElement
    const initial = ref.current?.querySelector('input:not([type="checkbox"]), select, textarea')
    ;(initial || ref.current)?.focus()
    const handler = e => {
      if (e.key === 'Escape' && !current.current.busy) current.current.onClose()
      if (e.key !== 'Tab') return
      const nodes = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')]
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('keydown', handler); previous?.focus() }
  }, [])
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2><button disabled={busy} onClick={onClose} className={secondaryClass} aria-label="Tutup">Tutup</button></div>{children}</section></div>
}
