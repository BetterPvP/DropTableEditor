import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import RegisteredItems from './components/RegisteredItems'
import DropTableEditor from './components/DropTableEditor'
import InviteCodeManager from './components/InviteCodeManager'
import DropTableBrowser from './components/DropTableBrowser'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registeredItems, setRegisteredItems] = useState([])
  const [dropTables, setDropTables] = useState({})
  const [activeTab, setActiveTab] = useState('registered-items')
  const [dungeonTabs, setDungeonTabs] = useState({})

  // Check authentication status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load registered items from Supabase
  useEffect(() => {
    if (!session) return

    const loadRegisteredItems = async () => {
      const { data, error } = await supabase
        .from('registered_items')
        .select('item_id')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading registered items:', error)
        return
      }

      if (data.length === 0) {
        // Initialize with default items
        const defaultItems = [
          'minecraft:diamond',
          'minecraft:iron_ingot',
          'minecraft:gold_ingot',
          'minecraft:emerald',
          'minecraft:netherite_scrap'
        ]

        for (const itemId of defaultItems) {
          await supabase.from('registered_items').insert({ item_id: itemId })
        }
        setRegisteredItems(defaultItems)
      } else {
        setRegisteredItems(data.map(item => item.item_id))
      }
    }

    loadRegisteredItems()

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('registered_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registered_items' }, () => {
        loadRegisteredItems()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [session])

  // Load drop tables from Supabase
  useEffect(() => {
    if (!session) return

    const loadDropTables = async () => {
      const { data, error } = await supabase
        .from('drop_tables')
        .select('*')

      if (error) {
        console.error('Error loading drop tables:', error)
        return
      }

      // Reconstruct the nested structure
      const tables = {}
      const tabs = {}

      data.forEach(row => {
        if (!tables[row.dungeon_name]) {
          tables[row.dungeon_name] = {}
          tabs[row.dungeon_name] = []
        }
        tables[row.dungeon_name][row.variation_name] = row.data
        tabs[row.dungeon_name].push(row.variation_name)
      })

      setDropTables(tables)
      setDungeonTabs(tabs)
    }

    loadDropTables()

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('drop_tables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drop_tables' }, () => {
        loadDropTables()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [session])

  const loadDropTable = async (file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result)
        const fileName = file.name.replace('.json', '')

        // Extract all unique item IDs from the loaded drop table
        const newItems = new Set()
        Object.values(data).forEach(variation => {
          variation.categories?.forEach(category => {
            category.items?.forEach(item => {
              if (item.itemId && !registeredItems.includes(item.itemId)) {
                newItems.add(item.itemId)
              }
            })
          })
        })

        // Register any new items found in Supabase
        if (newItems.size > 0) {
          for (const itemId of Array.from(newItems)) {
            await supabase.from('registered_items').insert({ item_id: itemId })
          }
        }

        // Store each variation in Supabase
        for (const [variationName, variationData] of Object.entries(data)) {
          await supabase.from('drop_tables').upsert({
            dungeon_name: fileName,
            variation_name: variationName,
            data: variationData,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'dungeon_name,variation_name'
          })
        }

        // Switch to first variation tab
        setActiveTab(`${fileName}-${Object.keys(data)[0]}`)
      } catch (err) {
        alert('Error parsing JSON file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      if (file.name.endsWith('.json')) {
        loadDropTable(file)
      }
    })
    e.target.value = '' // Reset input
  }

  const exportDropTable = (dungeonName, variationName) => {
    const data = dropTables[dungeonName]
    if (!data || !data[variationName]) return

    const exportData = { [variationName]: data[variationName] }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${dungeonName}_${variationName}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAllVariations = (dungeonName) => {
    const data = dropTables[dungeonName]
    if (!data) return

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${dungeonName}_all_variations.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateDropTable = async (dungeonName, variationName, newData) => {
    // Update in Supabase
    await supabase.from('drop_tables').upsert({
      dungeon_name: dungeonName,
      variation_name: variationName,
      data: newData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'dungeon_name,variation_name'
    })
  }

  const addVariation = async (dungeonName) => {
    const variationName = prompt('Enter variation name (e.g., boss, chest, elite_mob):')
    if (!variationName || !variationName.trim()) return

    const cleanName = variationName.trim()

    await supabase.from('drop_tables').insert({
      dungeon_name: dungeonName,
      variation_name: cleanName,
      data: { categories: [] },
      updated_at: new Date().toISOString()
    })

    setActiveTab(`${dungeonName}-${cleanName}`)
  }

  const removeVariation = async (dungeonName, variationName) => {
    if (!confirm(`Remove variation "${variationName}"?`)) return

    await supabase.from('drop_tables')
      .delete()
      .eq('dungeon_name', dungeonName)
      .eq('variation_name', variationName)

    // Switch to another tab
    const remainingTabs = dungeonTabs[dungeonName]?.filter(v => v !== variationName) || []
    if (remainingTabs.length > 0) {
      setActiveTab(`${dungeonName}-${remainingTabs[0]}`)
    } else {
      setActiveTab('registered-items')
    }
  }

  const removeDungeon = async (dungeonName) => {
    if (!confirm(`Remove entire dungeon "${dungeonName}" and all its variations?`)) return

    await supabase.from('drop_tables')
      .delete()
      .eq('dungeon_name', dungeonName)

    setActiveTab('registered-items')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Minecraft Drop Table Editor</h1>
        <div className="header-actions">
          <label className="file-upload-btn">
            Load Drop Table(s)
            <input
              type="file"
              accept=".json"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleSignOut} className="btn-sign-out">
            Sign Out
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === 'browse-tables' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('browse-tables')}
        >
          📋 Browse Tables
        </button>

        <button
          className={activeTab === 'registered-items' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('registered-items')}
        >
          Registered Items
        </button>

        <button
          className={activeTab === 'invite-codes' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('invite-codes')}
        >
          Invite Codes
        </button>

        {Object.keys(dropTables).map(dungeonName => (
          <div key={dungeonName} className="dungeon-tab-group">
            <div className="dungeon-header">
              <span className="dungeon-name">{dungeonName}</span>
              <button
                className="btn-export-all"
                onClick={() => exportAllVariations(dungeonName)}
                title="Export all variations"
              >
                ⬇ All
              </button>
              <button
                className="btn-remove"
                onClick={() => removeDungeon(dungeonName)}
                title="Remove dungeon"
              >
                ✕
              </button>
            </div>
            <div className="variation-tabs">
              {dungeonTabs[dungeonName]?.map(variation => (
                <button
                  key={variation}
                  className={activeTab === `${dungeonName}-${variation}` ? 'tab active' : 'tab'}
                  onClick={() => setActiveTab(`${dungeonName}-${variation}`)}
                >
                  {variation}
                  <span
                    className="remove-variation"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeVariation(dungeonName, variation)
                    }}
                  >
                    ✕
                  </span>
                </button>
              ))}
              <button
                className="tab add-variation"
                onClick={() => addVariation(dungeonName)}
              >
                + Add Variation
              </button>
            </div>
          </div>
        ))}
      </nav>

      <main className="content">
        {activeTab === 'browse-tables' ? (
          <DropTableBrowser
            onLoadTable={(dungeonName, variationName) => {
              setActiveTab(`${dungeonName}-${variationName}`)
            }}
          />
        ) : activeTab === 'registered-items' ? (
          <RegisteredItems
            registeredItems={registeredItems}
          />
        ) : activeTab === 'invite-codes' ? (
          <InviteCodeManager />
        ) : (
          (() => {
            const [dungeonName, variationName] = activeTab.split('-')
            const data = dropTables[dungeonName]?.[variationName]

            if (!data) return <div>No data available</div>

            return (
              <DropTableEditor
                data={data}
                registeredItems={registeredItems}
                onChange={(newData) => updateDropTable(dungeonName, variationName, newData)}
                onExport={() => exportDropTable(dungeonName, variationName)}
                title={`${dungeonName} - ${variationName}`}
              />
            )
          })()
        )}
      </main>
    </div>
  )
}

export default App