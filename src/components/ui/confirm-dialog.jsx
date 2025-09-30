import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog({ open, onOpenChange, title, message, onConfirm, variant = "default" }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {variant === "destructive" && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-slate-300">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}