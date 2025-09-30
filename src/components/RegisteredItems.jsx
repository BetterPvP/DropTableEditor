import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { AlertDialog } from './ui/alert-dialog'
import { ConfirmDialog } from './ui/confirm-dialog'
import { X } from 'lucide-react'

function RegisteredItems({ registeredItems }) {
  const [newItem, setNewItem] = useState('')
  const [alertDialog, setAlertDialog] = useState({ open: false, title: '', message: '', variant: 'info' })
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null })

  const addItem = async () => {
    const itemId = newItem.trim()
    if (!itemId) {
      setAlertDialog({
        open: true,
        title: 'Validation Error',
        message: 'Please enter an item ID',
        variant: 'warning'
      })
      return
    }

    if (registeredItems.includes(itemId)) {
      setAlertDialog({
        open: true,
        title: 'Duplicate Item',
        message: 'Item already registered',
        variant: 'warning'
      })
      return
    }

    const { error } = await supabase.from('registered_items').insert({ item_id: itemId })

    if (error) {
      setAlertDialog({
        open: true,
        title: 'Error',
        message: 'Error adding item: ' + error.message,
        variant: 'error'
      })
      return
    }

    setNewItem('')
  }

  const removeItem = (itemId) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Item',
      message: `Remove "${itemId}" from registered items?`,
      variant: 'destructive',
      onConfirm: async () => {
        const { error } = await supabase.from('registered_items')
          .delete()
          .eq('item_id', itemId)

        if (error) {
          setAlertDialog({
            open: true,
            title: 'Error',
            message: 'Error removing item: ' + error.message,
            variant: 'error'
          })
        }
      }
    })
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addItem()
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-cyan-500/30 rounded-xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-3">
          Registered Items
        </h2>
        <p className="text-slate-400 text-sm">
          Only items registered here can be added to drop tables. This ensures consistency across all dungeons.
        </p>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 shadow-lg">
        <div className="flex gap-3 mb-6">
          <Input
            type="text"
            placeholder="Enter item ID (e.g., minecraft:diamond)"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={addItem}>
            Add Item
          </Button>
        </div>

        {registeredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-6xl mb-4 opacity-50">📦</div>
            <p className="text-slate-400">No items registered yet. Add your first item above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {registeredItems.map(itemId => (
              <div
                key={itemId}
                className="flex items-center justify-between bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3 hover:border-cyan-500/50 transition-all duration-200"
              >
                <span className="text-cyan-300 font-medium truncate">{itemId}</span>
                <button
                  onClick={() => removeItem(itemId)}
                  className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
                  title="Remove item"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-700/50 flex items-center justify-between">
          <span className="text-sm text-slate-400">Total registered items:</span>
          <span className="text-lg font-bold text-cyan-400">{registeredItems.length}</span>
        </div>
      </div>

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  )
}

export default RegisteredItems