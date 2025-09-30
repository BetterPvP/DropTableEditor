import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { Input } from './input'

export function PromptDialog({ open, onOpenChange, title, message, placeholder = "", defaultValue = "", onConfirm }) {
  const [value, setValue] = useState(defaultValue)

  const handleConfirm = () => {
    onConfirm(value)
    onOpenChange(false)
    setValue("")
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {message && <p className="text-sm text-slate-300">{message}</p>}
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!value.trim()}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}