import { ToastIcon } from './Icon'

export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null

  return (
    <div className="fixed top-[68px] md:top-[76px] left-3 right-3 sm:left-auto sm:right-5 z-[2000] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map(({ id, type, msg }) => (
        <div key={id} className={`toast pointer-events-auto ${type === 'success' ? '' : type}`}>
          <div className="toast-icon">
            <ToastIcon type={type} />
          </div>
          <div className="text-[13px] font-medium flex-1">{msg}</div>
        </div>
      ))}
    </div>
  )
}
