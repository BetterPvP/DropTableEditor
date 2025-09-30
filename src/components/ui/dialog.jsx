import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 max-h-[95vh] w-full max-w-7xl overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

const DialogContent = React.forwardRef(({ className, children, onClose, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative bg-[#1a1f2e] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl",
      "animate-in fade-in-0 zoom-in-95 duration-200",
      className
    )}
    {...props}
  >
    {children}
    {onClose && (
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg p-1 hover:bg-cyan-500/10 transition-colors"
      >
        <X className="h-5 w-5 text-cyan-400" />
      </button>
    )}
  </div>
))

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn("flex flex-col space-y-2 text-left mb-4", className)}
    {...props}
  />
)

const DialogTitle = ({ className, ...props }) => (
  <h2
    className={cn(
      "text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent",
      className
    )}
    {...props}
  />
)

const DialogDescription = ({ className, ...props }) => (
  <p
    className={cn("text-sm text-slate-400", className)}
    {...props}
  />
)

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription }
