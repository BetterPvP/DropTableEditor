import { useState } from 'react'
import './GuaranteedLootEditor.css'

function GuaranteedLootEditor({ data, registeredItems, onChange }) {
  const [selectedItem, setSelectedItem] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const guaranteedLoot = data.guaranteedLoot || []

  const addGuaranteedItem = () => {
    if (!selectedItem) {
      alert('Please select an item')
      return
    }

    // Check if already exists
    if (guaranteedLoot.find(item => item.itemId === selectedItem)) {
      alert('This item is already in guaranteed loot')
      return
    }

    const newGuaranteedLoot = [
      ...guaranteedLoot,
      {
        itemId: selectedItem,
        minAmount: 1,
        maxAmount: 1,
        condition: ''
      }
    ]

    onChange({ ...data, guaranteedLoot: newGuaranteedLoot })
    setSelectedItem('')
  }

  const removeGuaranteedItem = (index) => {
    const newGuaranteedLoot = [...guaranteedLoot]
    newGuaranteedLoot.splice(index, 1)
    onChange({ ...data, guaranteedLoot: newGuaranteedLoot })
  }

  const updateGuaranteedItem = (index, field, value) => {
    const newGuaranteedLoot = [...guaranteedLoot]
    newGuaranteedLoot[index] = {
      ...newGuaranteedLoot[index],
      [field]: field === 'itemId' || field === 'condition' ? value : Number(value)
    }

    // Validate min/max
    if (field === 'minAmount' && Number(value) > newGuaranteedLoot[index].maxAmount) {
      alert('Min amount cannot be greater than max amount')
      return
    }
    if (field === 'maxAmount' && Number(value) < newGuaranteedLoot[index].minAmount) {
      alert('Max amount cannot be less than min amount')
      return
    }

    onChange({ ...data, guaranteedLoot: newGuaranteedLoot })
  }

  return (
    <div className="guaranteed-loot-editor">
      <div className="editor-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <h3>🎁 Guaranteed Loot</h3>
          <span className="item-count">{guaranteedLoot.length} items</span>
        </div>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="editor-content">
          <div className="add-item-section">
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="item-selector"
            >
              <option value="">Select an item to add...</option>
              {registeredItems
                .filter(item => !guaranteedLoot.find(g => g.itemId === item))
                .map(item => (
                  <option key={item} value={item}>{item}</option>
                ))
              }
            </select>
            <button
              onClick={addGuaranteedItem}
              className="btn-add-guaranteed"
              disabled={!selectedItem}
            >
              + Add Guaranteed Item
            </button>
          </div>

          {guaranteedLoot.length === 0 ? (
            <div className="empty-message">
              No guaranteed loot items. Items added here will always drop regardless of weights.
            </div>
          ) : (
            <div className="guaranteed-items-list">
              {guaranteedLoot.map((item, index) => (
                <div key={index} className="guaranteed-item-card">
                  <div className="item-info">
                    <span className="item-id">{item.itemId}</span>
                    <span className="item-badge">Always Drops</span>
                  </div>

                  <div className="item-controls">
                    <div className="control-group">
                      <label>Min Amount:</label>
                      <input
                        type="number"
                        min="1"
                        value={item.minAmount}
                        onChange={(e) => updateGuaranteedItem(index, 'minAmount', e.target.value)}
                        className="amount-input"
                      />
                    </div>

                    <div className="control-group">
                      <label>Max Amount:</label>
                      <input
                        type="number"
                        min="1"
                        value={item.maxAmount}
                        onChange={(e) => updateGuaranteedItem(index, 'maxAmount', e.target.value)}
                        className="amount-input"
                      />
                    </div>

                    <div className="control-group condition-group">
                      <label>Condition (optional):</label>
                      <input
                        type="text"
                        value={item.condition || ''}
                        onChange={(e) => updateGuaranteedItem(index, 'condition', e.target.value)}
                        placeholder="e.g., player.level >= 10"
                        className="condition-input"
                      />
                    </div>

                    <button
                      onClick={() => removeGuaranteedItem(index)}
                      className="btn-remove-guaranteed"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GuaranteedLootEditor