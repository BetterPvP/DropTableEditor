import { useState, useMemo, useCallback } from 'react'
import DropSimulator from './DropSimulator'
import LootTableSettings from './LootTableSettings'
import GuaranteedLootEditor from './GuaranteedLootEditor'
import PityRulesEditor from './PityRulesEditor'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Save, Copy, Dices, X } from 'lucide-react'

function DropTableEditor({ data, registeredItems, onChange, onExport, onDuplicate, title }) {
  const [selectedItem, setSelectedItem] = useState('')
  const [showSimulator, setShowSimulator] = useState(false)

  // Initialize items array if using old category structure
  const items = useMemo(() => {
    if (data.items) return data.items
    // Migration from old category structure
    const migratedItems = []
    data.categories?.forEach(cat => {
      cat.items?.forEach(item => {
        migratedItems.push(item)
      })
    })
    return migratedItems
  }, [data])

  const updateItem = useCallback((itemIndex, field, value) => {
    const newData = { ...data }
    if (!newData.items) newData.items = [...items]

    const numValue = Number(value)
    const item = { ...newData.items[itemIndex] }

    // Basic validation - ensure positive values for weight and yields
    if ((field === 'minYield' || field === 'maxYield' || field === 'itemWeight') && numValue < 1) {
      return
    }

    if (field === 'itemWeight') {
      item[field] = numValue
    } else if (field === 'minYield' || field === 'maxYield') {
      const currentMin = item.minYield ?? 1
      const currentMax = item.maxYield ?? 1

      if (field === 'minYield') {
        const newMin = numValue
        // If new min is greater than current max, increase max to match
        if (newMin > currentMax) {
          item.minYield = newMin
          item.maxYield = newMin
        } else {
          item.minYield = newMin
        }
      } else if (field === 'maxYield') {
        const newMax = numValue
        // If new max is less than current min, decrease min to match
        if (newMax < currentMin) {
          item.minYield = newMax
          item.maxYield = newMax
        } else {
          item.maxYield = newMax
        }
      }
    } else {
      item[field] = value
    }

    newData.items = [...newData.items]
    newData.items[itemIndex] = item
    delete newData.categories // Remove old structure
    onChange(newData)
  }, [data, items, onChange])

  const addItem = useCallback(() => {
    if (!selectedItem) return

    const newData = { ...data }
    if (!newData.items) newData.items = [...items]

    if (newData.items.find(i => i.itemId === selectedItem)) {
      return
    }

    newData.items = [...newData.items, {
      itemId: selectedItem,
      itemWeight: 10,
      minYield: 1,
      maxYield: 1,
      replacementStrategy: 'UNSET'
    }]
    delete newData.categories
    onChange(newData)
    setSelectedItem('')
  }, [data, items, selectedItem, onChange])

  const removeItem = useCallback((itemIndex) => {
    const newData = { ...data }
    if (!newData.items) newData.items = [...items]
    newData.items = newData.items.filter((_, i) => i !== itemIndex)
    delete newData.categories
    onChange(newData)
  }, [data, items, onChange])

  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.itemWeight || 0), 0)
  }, [items])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-cyan-500/30 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowSimulator(true)} variant="default">
              <Dices className="w-4 h-4" />
              Test Drops
            </Button>
            {onDuplicate && (
              <Button onClick={onDuplicate} variant="secondary">
                <Copy className="w-4 h-4" />
                Duplicate
              </Button>
            )}
            <Button onClick={onExport} variant="accent">
              <Save className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <LootTableSettings data={data} onChange={onChange} />
      <GuaranteedLootEditor data={data} registeredItems={registeredItems} onChange={onChange} />
      <PityRulesEditor data={data} onChange={onChange} />

      {/* Weighted Items Section */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-cyan-400">Weighted Items</h3>
          <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-lg text-purple-300 text-sm font-semibold">
            {items.length} items
          </span>
        </div>

        {/* Add Item Bar */}
        <div className="flex gap-3 mb-6">
          <select
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:border-cyan-500 transition-all duration-200"
          >
            <option value="">Select an item to add...</option>
            {registeredItems
              .filter(item => !items.find(i => i.itemId === item))
              .map(item => (
                <option key={item} value={item}>{item}</option>
              ))
            }
          </select>
          <Button onClick={addItem} disabled={!selectedItem}>
            Add Item
          </Button>
        </div>

        {/* Items Grid */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-6xl mb-4 opacity-50">📦</div>
            <p className="text-lg font-semibold text-slate-300 mb-2">No weighted items yet</p>
            <span className="text-sm text-slate-500">Add items to start building your loot table</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {items.map((item, index) => {
              const probability = totalWeight > 0 ? (item.itemWeight / totalWeight) * 100 : 0
              const odds = probability > 0 ? 1 / (probability / 100) : 0

              return (
                <div
                  key={`${item.itemId}-${index}`}
                  className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-cyan-500/50 transition-all duration-200 overflow-hidden"
                >
                  {/* Item Header */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-cyan-300 truncate">{item.itemId}</span>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      aria-label="Remove item"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Item Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Weight</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.itemWeight}
                        onChange={(e) => updateItem(index, 'itemWeight', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Min</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.minYield ?? 1}
                        onChange={(e) => updateItem(index, 'minYield', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Max</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.maxYield ?? 1}
                        onChange={(e) => updateItem(index, 'maxYield', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Replacement Strategy */}
                  <div className="mb-3">
                    <label className="block text-xs text-slate-400 mb-1">Replacement</label>
                    <select
                      value={item.replacementStrategy || 'UNSET'}
                      onChange={(e) => updateItem(index, 'replacementStrategy', e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900/50 px-2 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 transition-all duration-200"
                    >
                      <option value="UNSET">Use Default</option>
                      <option value="WITH_REPLACEMENT">With Replacement</option>
                      <option value="WITHOUT_REPLACEMENT">Without Replacement</option>
                    </select>
                  </div>

                  {/* Probability Bar */}
                  <div className="space-y-1">
                    <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden border border-slate-700/50">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${Math.min(probability, 100)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow-lg">
                        {probability.toFixed(2)}%
                      </span>
                    </div>
                    <span className="block text-xs text-slate-400 text-center">
                      1 in {odds.toFixed(1)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Stats Bar */}
        <div className="flex items-center gap-6 pt-6 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Total Weight:</span>
            <span className="text-lg font-bold text-cyan-400">{totalWeight}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Total Items:</span>
            <span className="text-lg font-bold text-purple-400">{items.length}</span>
          </div>
        </div>
      </div>

      {/* Simulator Modal */}
      <Dialog open={showSimulator} onOpenChange={setShowSimulator}>
        <DialogContent onClose={() => setShowSimulator(false)} className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Drop Simulator</DialogTitle>
          </DialogHeader>
          <DropSimulator data={{ ...data, items }} onChange={onChange} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DropTableEditor
