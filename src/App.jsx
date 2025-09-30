import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import RegisteredItems from './components/RegisteredItems'
import DropTableEditor from './components/DropTableEditor'
import InviteCodeManager from './components/InviteCodeManager'
import DropTableBrowser from './components/DropTableBrowser'
import { Button } from './components/ui/button'
import { AlertDialog } from './components/ui/alert-dialog'
import { PromptDialog } from './components/ui/prompt-dialog'
import { ConfirmDialog } from './components/ui/confirm-dialog'
import { Upload, LogOut, X, Download, Plus } from 'lucide-react'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registeredItems, setRegisteredItems] = useState([])
  const [dropTables, setDropTables] = useState({})
  const [activeTab, setActiveTab] = useState('registered-items')
  const [dungeonTabs, setDungeonTabs] = useState({})

  // Dialog states
  const [alertDialog, setAlertDialog] = useState({ open: false, title: '', message: '', variant: 'info' })
  const [promptDialog, setPromptDialog] = useState({ open: false, title: '', message: '', placeholder: '', onConfirm: null })
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'default' })

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
        setAlertDialog({
          open: true,
          title: 'Error',
          message: 'Error parsing JSON file: ' + err.message,
          variant: 'error'
        })
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

  const addVariation = (dungeonName) => {
    setPromptDialog({
      open: true,
      title: 'Add Variation',
      message: 'Enter variation name (e.g., boss, chest, elite_mob):',
      placeholder: 'Variation name',
      onConfirm: async (variationName) => {
        if (!variationName || !variationName.trim()) return

        const cleanName = variationName.trim()

        await supabase.from('drop_tables').insert({
          dungeon_name: dungeonName,
          variation_name: cleanName,
          data: { items: [] },
          updated_at: new Date().toISOString()
        })

        setActiveTab(`${dungeonName}-${cleanName}`)
      }
    })
  }

  const removeVariation = (dungeonName, variationName) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Variation',
      message: `Remove variation "${variationName}"?`,
      variant: 'destructive',
      onConfirm: async () => {
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
    })
  }

  const removeDungeon = (dungeonName) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Dungeon',
      message: `Remove entire dungeon "${dungeonName}" and all its variations?`,
      variant: 'destructive',
      onConfirm: async () => {
        await supabase.from('drop_tables')
          .delete()
          .eq('dungeon_name', dungeonName)

        setActiveTab('registered-items')
      }
    })
  }

  const duplicateVariation = (dungeonName, variationName) => {
    setPromptDialog({
      open: true,
      title: 'Duplicate Variation',
      message: 'Enter name for duplicated variation:',
      placeholder: 'Variation name',
      onConfirm: async (newName) => {
        if (!newName || !newName.trim()) return

        const data = dropTables[dungeonName][variationName]
        await supabase.from('drop_tables').insert({
          dungeon_name: dungeonName,
          variation_name: newName.trim(),
          data: data,
          updated_at: new Date().toISOString()
        })

        setActiveTab(`${dungeonName}-${newName.trim()}`)
      }
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="min-h-screen bg-[#0f1419]">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#1a1f2e]/95 backdrop-blur-sm border-b border-cyan-500/20 shadow-lg shadow-cyan-500/5">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Minecraft Drop Table Editor
          </h1>
          <div className="flex items-center gap-3">
            <label>
              <Button variant="default" className="cursor-pointer">
                <Upload className="w-4 h-4" />
                Load Drop Table(s)
              </Button>
              <input
                type="file"
                accept=".json"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <Button variant="secondary" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation Links */}
      <nav className="bg-[#151922] border-b border-slate-700/50 px-6 py-3">
        <div className="container mx-auto flex items-center gap-2">
          <Button
            variant={activeTab === 'browse-tables' ? 'accent' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('browse-tables')}
          >
            Browse Tables
          </Button>
          <Button
            variant={activeTab === 'registered-items' ? 'accent' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('registered-items')}
          >
            Registered Items
          </Button>
          <Button
            variant={activeTab === 'invite-codes' ? 'accent' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('invite-codes')}
          >
            Invite Codes
          </Button>
        </div>
      </nav>

      {/* Dungeon Variation Cards */}
      {Object.keys(dropTables).length > 0 && (
        <div className="bg-[#151922] border-b border-slate-700/50 px-6 py-4">
          <div className="container mx-auto">
            <div className="flex flex-wrap gap-2">
              {Object.keys(dropTables).map(dungeonName => (
                <div key={dungeonName} className="flex flex-wrap gap-2 items-center">
                  {/* Dungeon name badge */}
                  <div className="flex items-center gap-2 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-3 py-1.5">
                    <span className="text-sm font-semibold text-cyan-400">{dungeonName}</span>
                    <button
                      onClick={() => exportAllVariations(dungeonName)}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                      title="Export all variations"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeDungeon(dungeonName)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Remove dungeon"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Individual variation cards */}
                  {dungeonTabs[dungeonName]?.map(variation => (
                    <button
                      key={variation}
                      onClick={() => setActiveTab(`${dungeonName}-${variation}`)}
                      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:-translate-y-0.5 ${
                        activeTab === `${dungeonName}-${variation}`
                          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                          : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <span className={`text-sm font-medium ${
                        activeTab === `${dungeonName}-${variation}`
                          ? 'text-cyan-300'
                          : 'text-slate-300'
                      }`}>
                        {variation}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeVariation(dungeonName, variation)
                        }}
                        className={`transition-colors ${
                          activeTab === `${dungeonName}-${variation}`
                            ? 'text-cyan-400 hover:text-red-400'
                            : 'text-slate-500 hover:text-red-400'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))}

                  {/* Add variation button */}
                  <button
                    onClick={() => addVariation(dungeonName)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-sm font-medium">Add Variation</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
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

            if (!data) return <div className="text-slate-400">No data available</div>

            return (
              <DropTableEditor
                data={data}
                registeredItems={registeredItems}
                onChange={(newData) => updateDropTable(dungeonName, variationName, newData)}
                onExport={() => exportDropTable(dungeonName, variationName)}
                onDuplicate={() => duplicateVariation(dungeonName, variationName)}
                title={`${dungeonName} - ${variationName}`}
              />
            )
          })()
        )}
      </main>

      {/* Dialogs */}
      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
      />
      <PromptDialog
        open={promptDialog.open}
        onOpenChange={(open) => setPromptDialog({ ...promptDialog, open })}
        title={promptDialog.title}
        message={promptDialog.message}
        placeholder={promptDialog.placeholder}
        onConfirm={promptDialog.onConfirm}
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

export default App