import { useState } from 'react'
import { supabase } from '../lib/supabase'

function RegisteredItems({ registeredItems }) {
  const [newItem, setNewItem] = useState('')

  const addItem = async () => {
    const itemId = newItem.trim()
    if (!itemId) {
      alert('Please enter an item ID')
      return
    }

    if (registeredItems.includes(itemId)) {
      alert('Item already registered')
      return
    }

    const { error } = await supabase.from('registered_items').insert({ item_id: itemId })

    if (error) {
      alert('Error adding item: ' + error.message)
      return
    }

    setNewItem('')
  }

  const removeItem = async (itemId) => {
    if (!confirm(`Remove "${itemId}" from registered items?`)) return

    const { error } = await supabase.from('registered_items')
      .delete()
      .eq('item_id', itemId)

    if (error) {
      alert('Error removing item: ' + error.message)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addItem()
    }
  }

  return (
    <div className="registered-items">
      <h2>Registered Items</h2>
      <p className="info-text">
        Only items registered here can be added to drop tables. This ensures consistency across all dungeons.
      </p>

      <div className="add-item-section">
        <input
          type="text"
          placeholder="Enter item ID (e.g., minecraft:diamond)"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyPress={handleKeyPress}
          className="item-input"
        />
        <button onClick={addItem} className="btn-add">
          Add Item
        </button>
      </div>

      <div className="items-grid">
        {registeredItems.length === 0 ? (
          <p className="empty-message">No items registered yet. Add your first item above.</p>
        ) : (
          registeredItems.map(itemId => (
            <div key={itemId} className="item-card">
              <span className="item-id">{itemId}</span>
              <button
                className="btn-remove-item"
                onClick={() => removeItem(itemId)}
                title="Remove item"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="items-count">
        Total registered items: {registeredItems.length}
      </div>
    </div>
  )
}

export default RegisteredItems