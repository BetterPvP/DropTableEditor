import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react'

export function AlertDialog({ open, onOpenChange, title, message, variant = "info" }) {
  const icons = {
    info: <Info className="w-5 h-5 text-cyan-400" />,
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />
  }

  const bgColors = {
    info: "bg-cyan-500/20",
    success: "bg-green-500/20",
    warning: "bg-yellow-500/20",
    error: "bg-red-500/20"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${bgColors[variant]} flex items-center justify-center`}>
              {icons[variant]}
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-slate-300">{message}</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}