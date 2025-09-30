import { useState } from 'react'
import { formatOdds, calculateProbability } from '../utils/probability'

function DropTableEditor({ data, registeredItems, onChange, onExport, title }) {
  const [editingCell, setEditingCell] = useState(null)
  const [selectedItems, setSelectedItems] = useState({})

  // Calculate distinct category weights
  const getDistinctCategoryWeights = () => {
    const weights = new Set()
    data.categories?.forEach(cat => {
      weights.add(cat.categoryWeight)
    })
    return Array.from(weights)
  }

  const getTotalDistinctCategoryWeight = () => {
    return getDistinctCategoryWeights().reduce((sum, w) => sum + w, 0)
  }

  const updateCategory = (categoryIndex, field, value) => {
    const newData = JSON.parse(JSON.stringify(data))
    newData.categories[categoryIndex][field] = field === 'categoryWeight' ? Number(value) : value
    onChange(newData)
  }

  const updateItem = (categoryIndex, itemIndex, field, value) => {
    const newData = JSON.parse(JSON.stringify(data))
    newData.categories[categoryIndex].items[itemIndex][field] =
      field === 'itemWeight' ? Number(value) : value
    onChange(newData)
  }

  const addCategory = () => {
    const newData = JSON.parse(JSON.stringify(data))
    if (!newData.categories) newData.categories = []

    newData.categories.push({
      categoryWeight: 1,
      items: []
    })
    onChange(newData)
  }

  const removeCategory = (categoryIndex) => {
    if (!confirm('Remove this category and all its items?')) return

    const newData = JSON.parse(JSON.stringify(data))
    newData.categories.splice(categoryIndex, 1)
    onChange(newData)
  }

  const addItem = (categoryIndex, selectedItemId) => {
    if (registeredItems.length === 0) {
      alert('No registered items available. Please add items in the Registered Items tab first.')
      return
    }

    if (!selectedItemId) {
      alert('Please select an item from the dropdown.')
      return
    }

    const newData = JSON.parse(JSON.stringify(data))
    const category = newData.categories[categoryIndex]

    // Check if item is already in this category
    const usedItems = category.items.map(i => i.itemId)
    if (usedItems.includes(selectedItemId)) {
      alert('This item is already in this category.')
      return
    }

    category.items.push({
      itemId: selectedItemId,
      itemWeight: 1,
      minYield: 1,
      maxYield: 1
    })
    onChange(newData)
  }

  const removeItem = (categoryIndex, itemIndex) => {
    const newData = JSON.parse(JSON.stringify(data))
    newData.categories[categoryIndex].items.splice(itemIndex, 1)
    onChange(newData)
  }

  const renderEditableCell = (value, onSave, type = 'text', options = null, uniqueId = '') => {
    const cellKey = `${uniqueId}-${type}-${value}`

    if (editingCell === cellKey) {
      if (options) {
        return (
          <select
            autoFocus
            defaultValue={value}
            onBlur={(e) => {
              onSave(e.target.value)
              setEditingCell(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave(e.target.value)
                setEditingCell(null)
              } else if (e.key === 'Escape') {
                setEditingCell(null)
              }
            }}
            className="cell-input"
          >
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      }

      return (
        <input
          autoFocus
          type={type}
          defaultValue={value}
          onBlur={(e) => {
            onSave(e.target.value)
            setEditingCell(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(e.target.value)
              setEditingCell(null)
            } else if (e.key === 'Escape') {
              setEditingCell(null)
            }
          }}
          className="cell-input"
        />
      )
    }

    return (
      <span
        className="editable-cell"
        onClick={() => setEditingCell(cellKey)}
      >
        {value}
      </span>
    )
  }

  const totalDistinctWeight = getTotalDistinctCategoryWeight()

  return (
    <div className="drop-table-editor">
      <div className="editor-header">
        <h2>{title}</h2>
        <div className="editor-actions">
          <button onClick={addCategory} className="btn-add">
            + Add Category
          </button>
          <button onClick={onExport} className="btn-export">
            Export JSON
          </button>
        </div>
      </div>

      {!data.categories || data.categories.length === 0 ? (
        <div className="empty-message">
          No categories yet. Click "Add Category" to get started.
        </div>
      ) : (
        data.categories.map((category, catIndex) => {
          const totalItemWeight = category.items.reduce((sum, item) => sum + item.itemWeight, 0)

          return (
            <div key={catIndex} className="category-section">
              <div className="category-header">
                <div className="category-info">
                  <label>Category Weight:</label>
                  {renderEditableCell(
                    category.categoryWeight,
                    (val) => updateCategory(catIndex, 'categoryWeight', val),
                    'number',
                    null,
                    `cat-${catIndex}-weight`
                  )}
                  <span className="category-chance">
                    ({((category.categoryWeight / totalDistinctWeight) * 100).toFixed(2)}% chance)
                  </span>
                </div>
                <div className="category-actions">
                  <select
                    value={selectedItems[catIndex] || ''}
                    onChange={(e) => setSelectedItems({ ...selectedItems, [catIndex]: e.target.value })}
                    className="item-selector"
                  >
                    <option value="">Select an item...</option>
                    {registeredItems
                      .filter(item => !category.items.some(i => i.itemId === item))
                      .map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))
                    }
                  </select>
                  <button
                    onClick={() => {
                      addItem(catIndex, selectedItems[catIndex])
                      setSelectedItems({ ...selectedItems, [catIndex]: '' })
                    }}
                    className="btn-add-small"
                    disabled={!selectedItems[catIndex]}
                  >
                    + Add Item
                  </button>
                  <button
                    onClick={() => removeCategory(catIndex)}
                    className="btn-remove-small"
                  >
                    Remove Category
                  </button>
                </div>
              </div>

              {category.items.length === 0 ? (
                <div className="empty-items">No items in this category</div>
              ) : (
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Item ID</th>
                      <th>Item Weight</th>
                      <th>Min Yield</th>
                      <th>Max Yield</th>
                      <th>Probability</th>
                      <th>Odds (1 in X)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.items.map((item, itemIndex) => {
                      const probability = calculateProbability(
                        category.categoryWeight,
                        totalDistinctWeight,
                        item.itemWeight,
                        totalItemWeight
                      )
                      const odds = (probability > 0 ? 1 / probability : 0)
                      const minYield = item.minYield ?? 1
                      const maxYield = item.maxYield ?? 1

                      return (
                        <tr key={itemIndex}>
                          <td>
                            {renderEditableCell(
                              item.itemId,
                              (val) => updateItem(catIndex, itemIndex, 'itemId', val),
                              'text',
                              registeredItems,
                              `item-${catIndex}-${itemIndex}-id`
                            )}
                          </td>
                          <td>
                            {renderEditableCell(
                              item.itemWeight,
                              (val) => updateItem(catIndex, itemIndex, 'itemWeight', val),
                              'number',
                              null,
                              `item-${catIndex}-${itemIndex}-weight`
                            )}
                          </td>
                          <td>
                            {renderEditableCell(
                              minYield,
                              (val) => updateItem(catIndex, itemIndex, 'minYield', val),
                              'number',
                              null,
                              `item-${catIndex}-${itemIndex}-minYield`
                            )}
                          </td>
                          <td>
                            {renderEditableCell(
                              maxYield,
                              (val) => updateItem(catIndex, itemIndex, 'maxYield', val),
                              'number',
                              null,
                              `item-${catIndex}-${itemIndex}-maxYield`
                            )}
                          </td>
                          <td className="probability-cell">
                            {(probability * 100).toFixed(4)}%
                          </td>
                          <td className="odds-cell">
                            {formatOdds(odds)}
                            {minYield !== maxYield && (
                              <div className="yield-info">
                                ({minYield}-{maxYield}x)
                              </div>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => removeItem(catIndex, itemIndex)}
                              className="btn-remove-small"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })
      )}

      <div className="statistics">
        <h3>Statistics</h3>
        <p>Total Distinct Category Weight: {totalDistinctWeight}</p>
        <p>Number of Categories: {data.categories?.length || 0}</p>
        <p>Total Items: {data.categories?.reduce((sum, cat) => sum + cat.items.length, 0) || 0}</p>
      </div>
    </div>
  )
}

export default DropTableEditor