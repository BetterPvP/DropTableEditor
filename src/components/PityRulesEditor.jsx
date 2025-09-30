import { useState } from 'react'
import './PityRulesEditor.css'

function PityRulesEditor({ data, onChange }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedItem, setSelectedItem] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(5)
  const [weightIncrement, setWeightIncrement] = useState(10)

  const pityRules = data.pityRules || []

  // Get all weighted items from categories
  const availableItems = []
  data.categories?.forEach(category => {
    category.items?.forEach(item => {
      if (!availableItems.includes(item.itemId)) {
        availableItems.push(item.itemId)
      }
    })
  })

  const addPityRule = () => {
    if (!selectedItem) {
      alert('Please select an item')
      return
    }

    // Check if rule already exists for this item
    if (pityRules.find(rule => rule.lootItemId === selectedItem)) {
      alert('A pity rule already exists for this item')
      return
    }

    const newPityRules = [
      ...pityRules,
      {
        lootItemId: selectedItem,
        maxAttempts: maxAttempts,
        weightIncrement: weightIncrement
      }
    ]

    onChange({ ...data, pityRules: newPityRules })
    setSelectedItem('')
    setMaxAttempts(5)
    setWeightIncrement(10)
  }

  const removePityRule = (index) => {
    const newPityRules = [...pityRules]
    newPityRules.splice(index, 1)
    onChange({ ...data, pityRules: newPityRules })
  }

  const updatePityRule = (index, field, value) => {
    const newPityRules = [...pityRules]
    newPityRules[index] = {
      ...newPityRules[index],
      [field]: field === 'lootItemId' ? value : Number(value)
    }
    onChange({ ...data, pityRules: newPityRules })
  }

  const isEnabled = (data.weightDistributionStrategy === 'PITY')

  return (
    <div className={`pity-rules-editor ${!isEnabled ? 'disabled' : ''}`}>
      <div className="editor-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <h3>💔 Pity Rules</h3>
          <span className="rule-count">{pityRules.length} rules</span>
          {!isEnabled && (
            <span className="disabled-badge">Enable PITY strategy to use</span>
          )}
        </div>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="editor-content">
          {!isEnabled && (
            <div className="info-banner">
              <strong>Note:</strong> Pity rules only apply when Weight Distribution Strategy is set to "PITY".
              Configure this in Advanced Settings above.
            </div>
          )}

          <div className="add-rule-section">
            <div className="rule-inputs">
              <div className="input-group">
                <label>Item:</label>
                <select
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className="item-selector"
                  disabled={!isEnabled}
                >
                  <option value="">Select an item...</option>
                  {availableItems
                    .filter(item => !pityRules.find(r => r.lootItemId === item))
                    .map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))
                  }
                </select>
              </div>

              <div className="input-group">
                <label>
                  Max Attempts:
                  <span className="hint">Failed rolls before weight increase</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  className="number-input"
                  disabled={!isEnabled}
                />
              </div>

              <div className="input-group">
                <label>
                  Weight Increment:
                  <span className="hint">Amount to increase weight by</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={weightIncrement}
                  onChange={(e) => setWeightIncrement(Number(e.target.value))}
                  className="number-input"
                  disabled={!isEnabled}
                />
              </div>
            </div>

            <button
              onClick={addPityRule}
              className="btn-add-rule"
              disabled={!selectedItem || !isEnabled}
            >
              + Add Pity Rule
            </button>
          </div>

          {pityRules.length === 0 ? (
            <div className="empty-message">
              No pity rules configured. Pity rules increase drop rates for specific items after failed attempts.
            </div>
          ) : (
            <div className="pity-rules-table">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Max Attempts</th>
                    <th>Weight Increment</th>
                    <th>Effect</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pityRules.map((rule, index) => (
                    <tr key={index}>
                      <td className="item-cell">
                        <span className="item-id">{rule.lootItemId}</span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={rule.maxAttempts}
                          onChange={(e) => updatePityRule(index, 'maxAttempts', e.target.value)}
                          className="table-input"
                          disabled={!isEnabled}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={rule.weightIncrement}
                          onChange={(e) => updatePityRule(index, 'weightIncrement', e.target.value)}
                          className="table-input"
                          disabled={!isEnabled}
                        />
                      </td>
                      <td className="effect-cell">
                        +{rule.weightIncrement} weight every {rule.maxAttempts} failures
                      </td>
                      <td>
                        <button
                          onClick={() => removePityRule(index)}
                          className="btn-remove-rule"
                          disabled={!isEnabled}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PityRulesEditor