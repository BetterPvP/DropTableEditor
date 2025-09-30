import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './DropTableBrowser.css'

function DropTableBrowser({ onLoadTable }) {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDungeonName, setNewDungeonName] = useState('')
  const [newVariationName, setNewVariationName] = useState('')

  useEffect(() => {
    loadTables()
  }, [])

  const loadTables = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('drop_tables')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error && data) {
      // Group by dungeon
      const grouped = data.reduce((acc, table) => {
        if (!acc[table.dungeon_name]) {
          acc[table.dungeon_name] = []
        }
        acc[table.dungeon_name].push(table)
        return acc
      }, {})
      setTables(grouped)
    }
    setLoading(false)
  }

  const handleCreateTable = async () => {
    if (!newDungeonName.trim() || !newVariationName.trim()) {
      alert('Please enter both dungeon name and variation name')
      return
    }

    const { error } = await supabase.from('drop_tables').insert({
      dungeon_name: newDungeonName.trim(),
      variation_name: newVariationName.trim(),
      data: { categories: [] },
      updated_at: new Date().toISOString()
    })

    if (error) {
      if (error.code === '23505') {
        alert('This dungeon/variation combination already exists')
      } else {
        alert('Error creating table: ' + error.message)
      }
      return
    }

    setNewDungeonName('')
    setNewVariationName('')
    setShowCreateModal(false)
    loadTables()
  }

  const handleDeleteTable = async (dungeonName, variationName) => {
    if (!confirm(`Delete ${dungeonName} - ${variationName}?`)) return

    await supabase
      .from('drop_tables')
      .delete()
      .eq('dungeon_name', dungeonName)
      .eq('variation_name', variationName)

    loadTables()
  }

  if (loading) {
    return <div className="browser-loading">Loading drop tables...</div>
  }

  return (
    <div className="drop-table-browser">
      <div className="browser-header">
        <h2>Drop Table Browser</h2>
        <button onClick={() => setShowCreateModal(true)} className="btn-create">
          + Create New Drop Table
        </button>
      </div>

      {Object.keys(tables).length === 0 ? (
        <div className="empty-state">
          <p>No drop tables yet. Create your first one!</p>
        </div>
      ) : (
        <div className="dungeons-list">
          {Object.entries(tables).map(([dungeonName, variations]) => (
            <div key={dungeonName} className="dungeon-group">
              <h3 className="dungeon-title">{dungeonName}</h3>
              <div className="variations-grid">
                {variations.map(table => (
                  <div key={table.id} className="table-card">
                    <div className="table-info">
                      <h4>{table.variation_name}</h4>
                      <p className="table-meta">
                        {table.data.categories?.length || 0} categories
                      </p>
                      <p className="table-date">
                        Updated: {new Date(table.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="table-actions">
                      <button
                        onClick={() => onLoadTable(dungeonName, table.variation_name)}
                        className="btn-load"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTable(dungeonName, table.variation_name)}
                        className="btn-delete-small"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Drop Table</h3>
            <div className="form-group">
              <label>Dungeon Name</label>
              <input
                type="text"
                placeholder="e.g., temple, fortress, mine"
                value={newDungeonName}
                onChange={(e) => setNewDungeonName(e.target.value)}
                className="modal-input"
              />
            </div>
            <div className="form-group">
              <label>Variation Name</label>
              <input
                type="text"
                placeholder="e.g., boss, chest, basic_mobs"
                value={newVariationName}
                onChange={(e) => setNewVariationName(e.target.value)}
                className="modal-input"
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowCreateModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleCreateTable} className="btn-create">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DropTableBrowser