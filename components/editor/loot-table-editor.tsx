'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useTransition } from 'react';
import Link from 'next/link';
import { Copy, Download, Plus, Share2, Trash2, Upload, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SaveIndicator } from '@/components/save-indicator';
import { JSONPreview } from './json-preview';
import {
  LootEntry,
  LootTableDefinition,
  ReplacementStrategy,
  computeWeightTotals,
  ensureUniqueEntries,
  replacementStrategies,
} from '@/lib/loot-tables/types';
import { useAutosave } from '@/lib/hooks/use-autosave';
import { saveLootTableAction } from '@/app/loot-tables/[id]/actions';
import { deleteLootTableAction, duplicateLootTableAction } from '@/app/loot-tables/actions';
import { cn } from '@/lib/utils';
import type { Database } from '@/supabase/types';
import { useRouter } from 'next/navigation';

interface LootTableEditorProps {
  tableId: string;
  definition: LootTableDefinition;
  metadata: Record<string, unknown> | null;
  items: Database['public']['Tables']['items']['Row'][];
}

type RollStrategyState = LootTableDefinition['rollStrategy'];

type WeightDistributionState = LootTableDefinition['weightDistribution'];

function getReplacement(entry: LootEntry, fallback: ReplacementStrategy) {
  return entry.replacementStrategy === 'UNSET' ? fallback : entry.replacementStrategy;
}

type Notification = {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
};

export function LootTableEditor({ tableId, definition: initialDefinition, metadata, items }: LootTableEditorProps) {
  const router = useRouter();
  const [definition, setDefinition] = useState<LootTableDefinition>(initialDefinition);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isDuplicating, startDuplicating] = useTransition();
  const [selectedWeightedItemId, setSelectedWeightedItemId] = useState<string>('');
  const [selectedWeightedType, setSelectedWeightedType] = useState<LootEntry['type']>('dropped_item');
  const [selectedGuaranteedItemId, setSelectedGuaranteedItemId] = useState<string>('');
  const [selectedGuaranteedType, setSelectedGuaranteedType] = useState<LootEntry['type']>('given_item');

  const addNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const generateEntryId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `entry-${Math.random().toString(36).slice(2)}`;

  const { totalWeight, probabilities } = useMemo(
    () => computeWeightTotals(definition.entries),
    [definition.entries],
  );

  const availableWeightedItems = useMemo(() => {
    const takenIds = new Set(definition.entries.map((entry) => entry.itemId));
    return items.filter((item) => !takenIds.has(item.id));
  }, [definition.entries, items]);

  const availableGuaranteedItems = useMemo(() => {
    const takenIds = new Set(definition.guaranteed.map((entry) => entry.itemId));
    return items.filter((item) => !takenIds.has(item.id));
  }, [definition.guaranteed, items]);

  const autosave = useAutosave({
    key: `loot-table:${tableId}`,
    version: definition.version,
    value: definition,
    onSave: async ({ value }) => {
      setError(null);
      const result = await saveLootTableAction({ tableId, definition: value });
      if (!result.ok) {
        setError(result.error ?? 'Unable to save loot table');
        throw new Error(result.error ?? 'Unable to save loot table');
      }
      const nextDefinition = { ...value, version: result.version, updated_at: result.updated_at };
      setDefinition(nextDefinition);
      return { value: nextDefinition, version: result.version };
    },
  });

  useEffect(() => {
    if (availableWeightedItems.length === 0) {
      setSelectedWeightedItemId('');
    } else if (!availableWeightedItems.some((item) => item.id === selectedWeightedItemId)) {
      setSelectedWeightedItemId(availableWeightedItems[0].id);
    }
  }, [availableWeightedItems, selectedWeightedItemId]);

  useEffect(() => {
    if (availableGuaranteedItems.length === 0) {
      setSelectedGuaranteedItemId('');
    } else if (!availableGuaranteedItems.some((item) => item.id === selectedGuaranteedItemId)) {
      setSelectedGuaranteedItemId(availableGuaranteedItems[0].id);
    }
  }, [availableGuaranteedItems, selectedGuaranteedItemId]);

  const handleFieldChange = <K extends keyof LootTableDefinition>(key: K, value: LootTableDefinition[K]) => {
    setDefinition((prev) => ({ ...prev, [key]: value }));
  };

  const handleRollStrategyChange = (strategy: RollStrategyState) => {
    handleFieldChange('rollStrategy', strategy);
  };

  const handleDistributionChange = (strategy: WeightDistributionState) => {
    handleFieldChange('weightDistribution', strategy);
    if (strategy !== 'PITY') {
      handleFieldChange('pityRules', []);
    }
    if (strategy !== 'PROGRESSIVE') {
      handleFieldChange('progressive', undefined);
    } else if (!definition.progressive) {
      handleFieldChange('progressive', { maxShift: 0, shiftFactor: 0, varianceScaling: false });
    }
  };

  const handleEntryChange = (id: string, changes: Partial<LootEntry>) => {
    setDefinition((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
    }));
  };

  const handleGuaranteedChange = (id: string, changes: Partial<LootEntry>) => {
    setDefinition((prev) => ({
      ...prev,
      guaranteed: prev.guaranteed.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
    }));
  };

  const addLoot = (itemId: string, target: 'entries' | 'guaranteed', type: LootEntry['type']) => {
    if (!itemId) {
      addNotification('Select an item to add.', 'info');
      return;
    }
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) {
      setError('Selected item could not be found.');
      return;
    }
    setDefinition((prev) => {
      const existing = target === 'entries' ? prev.entries : prev.guaranteed;
      if (existing.some((entry) => entry.itemId === item.id)) {
        setError('That item is already present in this section.');
        return prev;
      }
      const entry: LootEntry = {
        id: generateEntryId(),
        type,
        itemId: item.id,
        minYield: 1,
        maxYield: 1,
        weight: 1,
        replacementStrategy: 'UNSET',
      };
      return {
        ...prev,
        [target]: ensureUniqueEntries([entry, ...existing]),
      };
    });
    addNotification(`${type === 'dropped_item' ? 'Dropped' : 'Given'} item ${item.name} added.`, 'success');
  };

  const removeEntry = (id: string, target: 'entries' | 'guaranteed') => {
    setDefinition((prev) => ({
      ...prev,
      [target]: prev[target].filter((entry) => entry.id !== id),
    }));
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as LootTableDefinition;
      setDefinition((prev) => ({
        ...parsed,
        id: prev.id,
        version: prev.version,
        updated_at: new Date().toISOString(),
      }));
      addNotification(`Imported ${parsed.name}. Review and save to persist.`, 'success');
      setError(null);
    } catch (importError) {
      console.error(importError);
      setError('Unable to import loot table. Ensure it matches the expected schema.');
    } finally {
      event.target.value = '';
    }
  };

  const handleExport = () => {
    const payload = JSON.stringify(definition, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${definition.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleManualSave = () => {
    startSaving(() => {
      void autosave.saveNow();
    });
  };

  const handleDuplicate = () => {
    startDuplicating(() => {
      duplicateLootTableAction({ tableId })
        .then((result) => {
          if (!result?.ok) {
            setError(result?.error ?? 'Unable to duplicate loot table.');
            return;
          }
          addNotification('Loot table duplicated successfully', 'success');
          router.push(`/loot-tables/${result.id}`);
        })
        .catch((error) => {
          console.error('Duplicate action failed', error);
          setError('Unable to duplicate loot table.');
        });
    });
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this loot table? This action cannot be undone.')) {
      return;
    }
    startDeleting(() => {
      deleteLootTableAction({ tableId })
        .then((result) => {
          if (!result?.ok) {
            setError(result?.error ?? 'Unable to delete loot table.');
            return;
          }
          router.push('/loot-tables');
        })
        .catch((error) => {
          console.error('Delete action failed', error);
          setError('Unable to delete loot table.');
        });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/60 px-6 py-4 backdrop-blur-xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">{definition.name}</h1>
          <p className="text-sm text-foreground/60">
            Version {definition.version} · Last updated {new Date(definition.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator status={isSaving ? 'saving' : autosave.status} />
          <Button type="button" variant="outline" className="gap-2" asChild>
            <Link href={`/loot-tables/${tableId}/simulate`}>
              <Wand2 className="h-4 w-4" /> Run simulation
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="gap-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                addNotification('Link copied to clipboard', 'success');
              } catch (err) {
                console.error('Failed to copy:', err);
                setError('Failed to copy link');
              }
            }}
          >
            <Share2 className="h-4 w-4" /> Share link
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={handleManualSave} disabled={isSaving}>
            Save now
          </Button>
          <Button type="button" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export JSON
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20">
            <Upload className="h-4 w-4" /> Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleDuplicate}
            disabled={isDuplicating}
          >
            <Copy className="h-4 w-4" /> {isDuplicating ? 'Duplicating...' : 'Duplicate'}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" /> {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Metadata</CardTitle>
                <CardDescription>
                  Name and description help other designers understand the loot table at a glance.
                </CardDescription>
              </div>
              <Badge variant="info">Hybrid autosave</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={definition.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  onBlur={autosave.handleBlur}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={definition.description ?? ''}
                  onChange={(event) => handleFieldChange('description', event.target.value)}
                  onBlur={autosave.handleBlur}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Designer notes</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={definition.notes ?? ''}
                  onChange={(event) => handleFieldChange('notes', event.target.value)}
                  onBlur={autosave.handleBlur}
                />
                <p className="text-xs text-foreground/50">
                  Notes are stored alongside the table and never exported to the live game.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Table behaviour</CardTitle>
              <CardDescription>
                Replacement strategy controls whether selected entries return to the pool. Roll count and distribution explain how rolls evolve across attempts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-2">
                <Label>Replacement strategy</Label>
                <p className="text-xs text-foreground/60">
                  WITHOUT_REPLACEMENT ensures each roll picks a unique entry per bundle, WITH_REPLACEMENT keeps odds constant, and UNSET defers to entry-level overrides.
                </p>
                <div className="flex flex-wrap gap-2">
                  {replacementStrategies.map((strategy) => (
                    <Button
                      key={strategy}
                      type="button"
                      variant={definition.replacementStrategy === strategy ? 'default' : 'outline'}
                      onClick={() => handleFieldChange('replacementStrategy', strategy)}
                    >
                      {strategy}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <Label>Roll count function</Label>
                <p className="text-xs text-foreground/60">
                  Choose how many weighted pulls occur in each run: constant amounts, progressive ramps, or random ranges.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={definition.rollStrategy.type === 'CONSTANT' ? 'default' : 'outline'}
                    onClick={() => handleRollStrategyChange({ type: 'CONSTANT', rolls: 1 })}
                  >
                    Constant
                  </Button>
                  <Button
                    type="button"
                    variant={definition.rollStrategy.type === 'PROGRESSIVE' ? 'default' : 'outline'}
                    onClick={() =>
                      handleRollStrategyChange({
                        type: 'PROGRESSIVE',
                        baseRolls: 1,
                        rollIncrement: 1,
                        maxRolls: 5,
                      })
                    }
                  >
                    Progressive increase
                  </Button>
                  <Button
                    type="button"
                    variant={definition.rollStrategy.type === 'RANDOM' ? 'default' : 'outline'}
                    onClick={() => handleRollStrategyChange({ type: 'RANDOM', min: 1, max: 3 })}
                  >
                    Random
                  </Button>
                </div>

                {definition.rollStrategy.type === 'CONSTANT' && (
                  <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs text-foreground/60">Same number of rolls every time.</p>
                    <div className="space-y-1">
                      <Label htmlFor="constant-rolls">Rolls</Label>
                      <Input
                        id="constant-rolls"
                        type="number"
                        min={1}
                        value={definition.rollStrategy.rolls}
                        onChange={(event) =>
                          handleRollStrategyChange({
                            type: 'CONSTANT',
                            rolls: Number(event.target.value) || 1,
                          })
                        }
                        onBlur={autosave.handleBlur}
                      />
                    </div>
                  </div>
                )}

                {definition.rollStrategy.type === 'PROGRESSIVE' && (
                  <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs text-foreground/60">Rolls climb until reaching a ceiling.</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="progressive-base">Base rolls</Label>
                        <Input
                          id="progressive-base"
                          type="number"
                          min={1}
                          value={definition.rollStrategy.baseRolls}
                          onChange={(event) => {
                            if (definition.rollStrategy.type === 'PROGRESSIVE') {
                              handleRollStrategyChange({
                                ...definition.rollStrategy,
                                baseRolls: Number(event.target.value) || 1,
                              });
                            }
                          }}
                          onBlur={autosave.handleBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="progressive-increment">Roll increment</Label>
                        <Input
                          id="progressive-increment"
                          type="number"
                          min={0}
                          value={definition.rollStrategy.rollIncrement}
                          onChange={(event) => {
                            if (definition.rollStrategy.type === 'PROGRESSIVE') {
                              handleRollStrategyChange({
                                ...definition.rollStrategy,
                                rollIncrement: Number(event.target.value) || 0,
                              });
                            }
                          }}
                          onBlur={autosave.handleBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="progressive-max">Max rolls</Label>
                        <Input
                          id="progressive-max"
                          type="number"
                          min={1}
                          value={definition.rollStrategy.maxRolls}
                          onChange={(event) => {
                            if (definition.rollStrategy.type === 'PROGRESSIVE') {
                              handleRollStrategyChange({
                                ...definition.rollStrategy,
                                maxRolls: Number(event.target.value) || definition.rollStrategy.maxRolls,
                              });
                            }
                          }}
                          onBlur={autosave.handleBlur}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {definition.rollStrategy.type === 'RANDOM' && (
                  <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs text-foreground/60">Pick a roll count between two bounds.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="random-min">Min rolls</Label>
                        <Input
                          id="random-min"
                          type="number"
                          min={0}
                          value={definition.rollStrategy.min}
                          onChange={(event) => {
                            if (definition.rollStrategy.type === 'RANDOM') {
                              handleRollStrategyChange({
                                ...definition.rollStrategy,
                                min: Number(event.target.value) || 0,
                              });
                            }
                          }}
                          onBlur={autosave.handleBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="random-max">Max rolls</Label>
                        <Input
                          id="random-max"
                          type="number"
                          min={1}
                          value={definition.rollStrategy.max}
                          onChange={(event) => {
                            if (definition.rollStrategy.type === 'RANDOM') {
                              handleRollStrategyChange({
                                ...definition.rollStrategy,
                                max: Number(event.target.value) || definition.rollStrategy.max,
                              });
                            }
                          }}
                          onBlur={autosave.handleBlur}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <Label>Weight distribution strategy</Label>
                <p className="text-xs text-foreground/60">
                  Static keeps base odds, Pity boosts unlucky entries after repeated misses, and Progressive nudges all weights towards the average every roll.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['STATIC', 'PITY', 'PROGRESSIVE'] as WeightDistributionState[]).map((strategy) => (
                    <Button
                      key={strategy}
                      type="button"
                      variant={definition.weightDistribution === strategy ? 'default' : 'outline'}
                      onClick={() => handleDistributionChange(strategy)}
                    >
                      {strategy}
                    </Button>
                  ))}
                </div>

                {definition.weightDistribution === 'PITY' && (
                  <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs text-foreground/60">
                      Each pity rule watches an entry and increases its weight after the specified number of failed rolls. The bump repeats every time the threshold is met.
                    </p>
                    {definition.pityRules.map((rule, index) => (
                      <div key={rule.entryId} className="grid gap-2 rounded-xl border border-white/10 bg-black/40 p-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Entry</Label>
                          <Select
                            value={rule.entryId}
                            onValueChange={(entryId) => {
                              setDefinition((prev) => ({
                                ...prev,
                                pityRules: prev.pityRules.map((r, i) => (i === index ? { ...r, entryId } : r)),
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {definition.entries.map((entry) => (
                                <SelectItem key={entry.id} value={entry.id}>
                                  {items.find((item) => item.id === entry.itemId)?.name ?? entry.itemId}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Max attempts</Label>
                          <Input
                            type="number"
                            min={1}
                            value={rule.maxAttempts}
                            onChange={(event) => {
                              const maxAttempts = Number(event.target.value) || 1;
                              setDefinition((prev) => ({
                                ...prev,
                                pityRules: prev.pityRules.map((r, i) => (i === index ? { ...r, maxAttempts } : r)),
                              }));
                            }}
                            onBlur={autosave.handleBlur}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Weight increment</Label>
                          <Input
                            type="number"
                            min={0}
                            value={rule.weightIncrement}
                            onChange={(event) => {
                              const weightIncrement = Number(event.target.value) || 0;
                              setDefinition((prev) => ({
                                ...prev,
                                pityRules: prev.pityRules.map((r, i) => (i === index ? { ...r, weightIncrement } : r)),
                              }));
                            }}
                            onBlur={autosave.handleBlur}
                          />
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        setDefinition((prev) => ({
                          ...prev,
                          pityRules: [
                            ...prev.pityRules,
                            {
                              entryId: prev.entries[0]?.id ?? '',
                              maxAttempts: 3,
                              weightIncrement: 1,
                            },
                          ].filter((rule) => rule.entryId),
                        }))
                      }
                      disabled={definition.entries.length === 0}
                    >
                      <Plus className="h-4 w-4" /> Add pity rule
                    </Button>
                  </div>
                )}

                {definition.weightDistribution === 'PROGRESSIVE' && (
                <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs text-foreground/60">
                    Progressive mode recentres weights after each roll. Max shift caps the adjustment, shift factor controls the strength, and variance scaling scales shifts based on how far an entry is from the pack.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Max shift</Label>
                      <Input
                        type="number"
                        min={0}
                        value={definition.progressive?.maxShift ?? 0}
                        onChange={(event) => {
                          const maxShift = Number(event.target.value) || 0;
                          setDefinition((prev) => ({
                            ...prev,
                            progressive: { 
                              shiftFactor: 0, 
                              varianceScaling: false,
                              ...prev.progressive, 
                              maxShift 
                            },
                          }));
                        }}
                        onBlur={autosave.handleBlur}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Shift factor</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.05"
                        value={definition.progressive?.shiftFactor ?? 0}
                        onChange={(event) => {
                          const shiftFactor = Number(event.target.value) || 0;
                          setDefinition((prev) => ({
                            ...prev,
                            progressive: { 
                              maxShift: 0, 
                              varianceScaling: false,
                              ...prev.progressive, 
                              shiftFactor 
                            },
                          }));
                        }}
                        onBlur={autosave.handleBlur}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Variance scaling</Label>
                      <Select
                        value={definition.progressive?.varianceScaling ? 'true' : 'false'}
                        onValueChange={(value) => {
                          const varianceScaling = value === 'true';
                          setDefinition((prev) => ({
                            ...prev,
                            progressive: { 
                              maxShift: 0, 
                              shiftFactor: 0, 
                              ...prev.progressive, 
                              varianceScaling 
                            },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">Disabled</SelectItem>
                          <SelectItem value="true">Enabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Guaranteed loot</CardTitle>
                  <CardDescription>
                    Always drop on top of the weighted pool.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={selectedGuaranteedItemId}
                    onValueChange={setSelectedGuaranteedItemId}
                    disabled={availableGuaranteedItems.length === 0}
                  >
                    <SelectTrigger className="sm:w-48">
                      <SelectValue placeholder={availableGuaranteedItems.length === 0 ? "No available items" : "Select item"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGuaranteedItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedGuaranteedType}
                    onValueChange={(value) => setSelectedGuaranteedType(value as LootEntry['type'])}
                  >
                    <SelectTrigger className="sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="given_item">Given item</SelectItem>
                      <SelectItem value="dropped_item">Dropped item</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => addLoot(selectedGuaranteedItemId, 'guaranteed', selectedGuaranteedType)}
                    disabled={availableGuaranteedItems.length === 0 || !selectedGuaranteedItemId}
                  >
                    <Plus className="h-4 w-4" /> Add guaranteed loot
                  </Button>
                </div>
              </div>
              <p className="text-xs text-foreground/50">
                Guaranteed loot fires after the weighted rolls and is ideal for quest rewards or pity items. Items can appear in both guaranteed and weighted loot sections.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {definition.guaranteed.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 bg-black/40 p-4 text-sm text-foreground/60">
                  Add a given item to define guaranteed drops such as quest rewards.
                </p>
              )}
              {definition.guaranteed.map((entry) => {
                const item = items.find((itemRecord) => itemRecord.id === entry.itemId);
                return (
                  <div key={entry.id} className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{item?.name ?? entry.itemId}</p>
                        <Badge
                          variant={entry.type === 'dropped_item' ? 'destructive' : 'default'}
                          className={entry.type === 'given_item' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : ''}
                        >
                          {entry.type === 'dropped_item' ? 'Dropped' : 'Given'}
                        </Badge>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(entry.id, 'guaranteed')}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Weight</Label>
                        <Input
                          type="number"
                          min={0}
                          value={entry.weight}
                          onChange={(event) =>
                            handleGuaranteedChange(entry.id, { weight: Number(event.target.value) || 0 })
                          }
                          onBlur={autosave.handleBlur}
                        />
                        <p className="text-xs text-foreground/50">Weight is stored for export parity even though guarantees always trigger.</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Min yield</Label>
                        <Input
                          type="number"
                          min={0}
                          value={entry.minYield}
                          onChange={(event) =>
                            handleGuaranteedChange(entry.id, { minYield: Number(event.target.value) || 0 })
                          }
                          onBlur={autosave.handleBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Max yield</Label>
                        <Input
                          type="number"
                          min={entry.minYield}
                          value={entry.maxYield}
                          onChange={(event) =>
                            handleGuaranteedChange(entry.id, { maxYield: Number(event.target.value) || entry.maxYield })
                          }
                          onBlur={autosave.handleBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Replacement</Label>
                        <Select
                          value={entry.replacementStrategy}
                          onValueChange={(value) =>
                            handleGuaranteedChange(entry.id, {
                              replacementStrategy: value as ReplacementStrategy,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {replacementStrategies.map((strategy) => (
                              <SelectItem key={strategy} value={strategy}>
                                {strategy}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-foreground/50">Guarantees rarely need overrides, but the option is here for parity.</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Weighted loot</CardTitle>
                  <CardDescription>
                    Each entry has an explicit weight and replacement rule. Probabilities update in real time as you tweak values.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={selectedWeightedItemId}
                    onValueChange={setSelectedWeightedItemId}
                    disabled={availableWeightedItems.length === 0}
                  >
                    <SelectTrigger className="sm:w-48">
                      <SelectValue placeholder={availableWeightedItems.length === 0 ? "No available items" : "Select item"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWeightedItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedWeightedType}
                    onValueChange={(value) => setSelectedWeightedType(value as LootEntry['type'])}
                  >
                    <SelectTrigger className="sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dropped_item">Dropped item</SelectItem>
                      <SelectItem value="given_item">Given item</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => addLoot(selectedWeightedItemId, 'entries', selectedWeightedType)}
                    disabled={availableWeightedItems.length === 0 || !selectedWeightedItemId}
                  >
                    <Plus className="h-4 w-4" /> Add loot
                  </Button>
                </div>
              </div>
              <p className="text-xs text-foreground/50">
                Select an item and type to add new weighted loot. Items already in weighted loot are hidden to prevent duplicates within this section.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
                <span>Total weight</span>
                <Badge variant="default">{totalWeight}</Badge>
              </div>
              <p className="text-xs text-foreground/50">
                Each probability uses P(x) = w(x) / Σw, so increasing one weight reduces the odds of all other entries proportionally.
              </p>
              {definition.entries.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 bg-black/40 p-4 text-sm text-foreground/60">
                  Add a dropped item to start defining weighted loot for this table.
                </p>
              )}
              {definition.entries.map((entry) => {
                const item = items.find((itemRecord) => itemRecord.id === entry.itemId);
                const probability = probabilities[entry.id] ?? 0;
                const replacement = getReplacement(entry, definition.replacementStrategy);
                return (
                  <div key={entry.id} className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{item?.name ?? entry.itemId}</p>
                        <Badge
                          variant={entry.type === 'dropped_item' ? 'destructive' : 'default'}
                          className={entry.type === 'given_item' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : ''}
                        >
                          {entry.type === 'dropped_item' ? 'Dropped' : 'Given'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{(probability * 100).toFixed(2)}%</Badge>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(entry.id, 'entries')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Weight</Label>
                        <Input
                          type="number"
                          min={0}
                          value={entry.weight}
                          onChange={(event) =>
                            handleEntryChange(entry.id, { weight: Number(event.target.value) || 0 })
                          }
                          onBlur={autosave.handleBlur}
                        />
                        <p className="text-xs text-foreground/50">Higher weight increases selection odds.</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Min yield</Label>
                        <Input
                          type="number"
                          min={0}
                          value={entry.minYield}
                          onChange={(event) =>
                            handleEntryChange(entry.id, { minYield: Number(event.target.value) || 0 })
                          }
                          onBlur={autosave.handleBlur}
                        />
                        <p className="text-xs text-foreground/50">Minimum quantity dropped when this loot wins.</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Max yield</Label>
                        <Input
                          type="number"
                          min={entry.minYield}
                          value={entry.maxYield}
                          onChange={(event) =>
                            handleEntryChange(entry.id, { maxYield: Number(event.target.value) || entry.maxYield })
                          }
                          onBlur={autosave.handleBlur}
                        />
                        <p className="text-xs text-foreground/50">Cap the possible amount per selection.</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Replacement</Label>
                        <Select
                          value={replacement}
                          onValueChange={(value) =>
                            handleEntryChange(entry.id, {
                              replacementStrategy: value as ReplacementStrategy,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {replacementStrategies.map((strategy) => (
                              <SelectItem key={strategy} value={strategy}>
                                {strategy}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-foreground/50">Override the table replacement rule when needed.</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inspector</CardTitle>
              <CardDescription>
                Quick validation of the current configuration before exporting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground/60">Weighted entries</span>
                <Badge variant="default">{definition.entries.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground/60">Guaranteed entries</span>
                <Badge variant="default">{definition.guaranteed.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground/60">Total weight</span>
                <Badge variant="default">{totalWeight}</Badge>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-foreground/60">
                <p>
                  Autosave logs every change locally and syncs to Supabase on blur, pause, and safety intervals. Conflict resolution alerts will appear here if another editor publishes a newer version.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle>JSON preview</CardTitle>
                <CardDescription>Read-only export snapshot for parity checks.</CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(definition, null, 2));
                    addNotification('JSON copied to clipboard', 'success');
                  } catch (err) {
                    console.error('Failed to copy:', err);
                    setError('Failed to copy JSON');
                  }
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <JSONPreview data={definition} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notification Stack */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col-reverse gap-3 max-w-md">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className={cn(
              'rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-bottom-2',
              notification.type === 'success' &&
                'border-green-500/40 bg-green-500/10 text-green-300',
              notification.type === 'info' &&
                'border-primary/40 bg-primary/10 text-primary',
              notification.type === 'error' &&
                'border-destructive/40 bg-destructive/10 text-destructive'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{notification.message}</span>
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-foreground/40 hover:text-foreground/80 transition-colors"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
