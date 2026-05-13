'use client';

import { ChangeEvent, FocusEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ChevronsUpDown, Copy, Download, Plus, Save, Share2, Trash2, Upload, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SaveIndicator } from '@/components/save-indicator';
import { JSONPreview } from './json-preview';
import { WeightField, ConditionField } from './entry-expression-fields';
import {
  LootEntry,
  LootType,
  LootTableDefinition,
  ReplacementStrategy,
  ItemLoot,
  CoinType,
  EnergyType,
  coinTypes,
  energyTypes,
  computeWeightTotals,
  getEntryKey,
  replacementStrategies,
  awardStrategyTypes,
  lootChestTypes,
  lootTableDefinitionSchema,
} from '@/lib/loot-tables/types';
import { useAutosave } from '@/lib/hooks/use-autosave';
import { usePresence } from '@/lib/hooks/use-presence';
import { useCollabSync } from '@/lib/hooks/use-collab-sync';
import { PresenceField } from './presence-overlay';
import { createSnapshotAction, saveLootTableAction } from '@/app/(dashboard)/loot-tables/[id]/actions';
import { deleteLootTableAction } from '@/app/(dashboard)/loot-tables/actions';
import { cn } from '@/lib/utils';
import type { Database } from '@/supabase/types';
import { useRouter } from 'next/navigation';

interface LootTableEditorProps {
  tableId: string;
  definition: LootTableDefinition;
  metadata: Record<string, unknown> | null;
  items: Database['public']['Tables']['items']['Row'][];
  userId: string;
  displayName: string;
  color: string;
}

type RollStrategyState = LootTableDefinition['rollStrategy'];

type WeightDistributionState = LootTableDefinition['weightDistribution'];

type AwardStrategyState = LootTableDefinition['awardStrategy'];

type CustomLootChestStrategy = Extract<
  AwardStrategyState,
  { type: 'LOOT_CHEST'; chestType: 'CUSTOM' }
>;

type LootChestOption = (typeof lootChestTypes)[number];

const awardStrategyLabelMap: Record<AwardStrategyState['type'], string> = {
  DEFAULT: 'Default',
  LOOT_CHEST: 'Loot chest',
};

const lootChestLabelMap: Record<LootChestOption, string> = {
  BIG: 'Big',
  SMALL: 'Small',
  CUSTOM: 'Custom',
};

const coinTypeLabels: Record<CoinType, string> = {
  SMALL_NUGGET: 'Small Gold Nugget',
  LARGE_NUGGET: 'Large Gold Nugget',
  BAR: 'Gold Bar',
};

const energyTypeLabels: Record<EnergyType, string> = {
  SHARD: 'Energy Shard',
  SMALL_CRYSTAL: 'Energy Crystal',
  LARGE_CRYSTAL: 'Large Energy Crystal',
  GIANT_CRYSTAL: 'Giant Energy Cluster',
};

const lootTypeSelectLabels: Record<LootType, string> = {
  dropped_item: 'Dropped item',
  given_item: 'Given item',
  dropped_coin: 'Dropped coin',
  given_coin: 'Given coin',
  dropped_clan_energy: 'Dropped energy',
  given_clan_energy: 'Given energy',
  clan_experience: 'Clan experience',
  fish: 'Fish',
  entity_spawn: 'Entity spawn',
};

type BadgeConfig = { label: string; variant: 'default' | 'destructive'; className?: string };

function getEntryBadgeConfig(type: LootType): BadgeConfig {
  switch (type) {
    case 'dropped_item': return { label: 'Dropped', variant: 'destructive' };
    case 'given_item': return { label: 'Given', variant: 'default', className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    case 'dropped_coin': return { label: 'Dropped coin', variant: 'default', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case 'given_coin': return { label: 'Given coin', variant: 'default', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case 'dropped_clan_energy': return { label: 'Dropped energy', variant: 'default', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    case 'given_clan_energy': return { label: 'Given energy', variant: 'default', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    case 'clan_experience': return { label: 'Clan XP', variant: 'default', className: 'bg-green-500/20 text-green-300 border-green-500/30' };
    case 'fish': return { label: 'Fish', variant: 'default', className: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    case 'entity_spawn': return { label: 'Entity spawn', variant: 'default', className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
  }
}

function getLootEntryLabel(
  entry: LootEntry,
  items: Database['public']['Tables']['items']['Row'][],
): string {
  if (entry.type === 'dropped_item' || entry.type === 'given_item') {
    return items.find((i) => i.id === entry.itemId)?.name ?? entry.itemId;
  }
  if (entry.type === 'dropped_coin' || entry.type === 'given_coin') {
    return coinTypeLabels[entry.coinType];
  }
  if (entry.type === 'dropped_clan_energy' || entry.type === 'given_clan_energy') {
    return energyTypeLabels[entry.energyType];
  }
  if (entry.type === 'fish') {
    const name = items.find((i) => i.id === entry.itemId)?.name ?? entry.itemId;
    return `${name} (${entry.minWeight}lb–${entry.maxWeight}lb)`;
  }
  if (entry.type === 'entity_spawn') {
    return entry.entityType;
  }
  return 'Clan Experience';
}

function getReplacement(entry: LootEntry, fallback: ReplacementStrategy) {
  return entry.replacementStrategy === 'UNSET' ? fallback : entry.replacementStrategy;
}

type Notification = {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
};

interface ItemComboboxProps {
  items: Database['public']['Tables']['items']['Row'][];
  value: string;
  onSelect: (itemId: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
}

function ItemCombobox({ items, value, onSelect, placeholder, disabled, className }: ItemComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedItem = useMemo(
    () => items.find((item) => item.id === value) ?? null,
    [items, value],
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) => {
      const id = item.id.toLowerCase();
      const name = (item.name ?? '').toLowerCase();
      return id.includes(normalized) || name.includes(normalized);
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setQuery('');
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  }, [open]);

  const handleSelect = (itemId: string) => {
    onSelect(itemId);
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between rounded-sm border bg-muted/35 px-3 py-2 text-left text-sm shadow-sm transition-colors placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary/50 hover:bg-muted/65',
          className
        )}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={selectedItem ? 'text-white' : 'text-foreground/60'}>
          {selectedItem ? selectedItem.name ?? selectedItem.id : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-foreground/50" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-full min-w-[16rem] rounded-md border bg-popover p-2 shadow-xl">
          <Input
            autoFocus
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items..."
            className="mb-2"
          />
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <p className="px-2 py-4 text-sm text-foreground/60">No items match your search.</p>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      'flex w-full flex-col items-start rounded-sm px-3 py-2 text-left text-sm transition hover:bg-muted/65',
                      isSelected ? 'bg-primary/12 text-white' : 'text-foreground',
                    )}
                    onClick={() => handleSelect(item.id)}
                  >
                    <span className="font-medium text-white">{item.name ?? item.id}</span>
                    <span className="text-xs text-foreground/60">{item.id}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function LootTableEditor({
  tableId,
  definition: initialDefinition,
  metadata,
  items,
  userId,
  displayName,
  color,
}: LootTableEditorProps) {
  const router = useRouter();
  const [definition, setDefinition] = useState<LootTableDefinition>(initialDefinition);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDeleting, startDeleting] = useTransition();
  const [selectedWeightedItemId, setSelectedWeightedItemId] = useState<string>('');
  const [selectedWeightedType, setSelectedWeightedType] = useState<LootType>('dropped_item');
  const [selectedWeightedCoinType, setSelectedWeightedCoinType] = useState<CoinType>('SMALL_NUGGET');
  const [selectedWeightedEnergyType, setSelectedWeightedEnergyType] = useState<EnergyType>('SHARD');
  const [selectedGuaranteedItemId, setSelectedGuaranteedItemId] = useState<string>('');
  const [selectedGuaranteedType, setSelectedGuaranteedType] = useState<LootType>('given_item');
  const [selectedGuaranteedCoinType, setSelectedGuaranteedCoinType] = useState<CoinType>('SMALL_NUGGET');
  const [selectedGuaranteedEnergyType, setSelectedGuaranteedEnergyType] = useState<EnergyType>('SHARD');
  const [selectedWeightedFishId, setSelectedWeightedFishId] = useState<string>('');
  const [selectedGuaranteedFishId, setSelectedGuaranteedFishId] = useState<string>('');
  const [selectedWeightedEntityType, setSelectedWeightedEntityType] = useState<string>('DROWNED');
  const [selectedGuaranteedEntityType, setSelectedGuaranteedEntityType] = useState<string>('DROWNED');
  const [collapsedEntries, setCollapsedEntries] = useState<Set<string>>(new Set());

  const toggleEntryCollapse = (id: string) => {
    setCollapsedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
    const takenIds = new Set(
      definition.entries
        .filter((e): e is ItemLoot => e.type === 'dropped_item' || e.type === 'given_item')
        .map((e) => e.itemId),
    );
    return items.filter((item) => !takenIds.has(item.id));
  }, [definition.entries, items]);

  const availableGuaranteedItems = useMemo(() => {
    const takenIds = new Set(
      definition.guaranteed
        .filter((e): e is ItemLoot => e.type === 'dropped_item' || e.type === 'given_item')
        .map((e) => e.itemId),
    );
    return items.filter((item) => !takenIds.has(item.id));
  }, [definition.guaranteed, items]);

  const customAwardStrategy =
    definition.awardStrategy.type === 'LOOT_CHEST' && definition.awardStrategy.chestType === 'CUSTOM'
      ? definition.awardStrategy
      : null;

  const setDefinitionState = useCallback((nextDefinition: LootTableDefinition) => {
    setDefinition(nextDefinition);
  }, []);

  const sessionId = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `session-${Math.random().toString(36).slice(2)}`
  ).current;
  const { others, trackFocus, untrackFocus } = usePresence(tableId, { userId, sessionId, displayName, color });
  const { broadcastPatch } = useCollabSync(tableId, definition, setDefinitionState, sessionId);

  const applyDefinitionUpdate = useCallback((
    updater: (prev: LootTableDefinition) => LootTableDefinition,
    broadcastPath?: keyof LootTableDefinition,
  ) => {
    let nextDefinition: LootTableDefinition | null = null;
    setDefinition((prev) => {
      nextDefinition = updater(prev);
      return nextDefinition;
    });

    if (broadcastPath && nextDefinition) {
      broadcastPatch(
        String(broadcastPath),
        nextDefinition[broadcastPath],
      );
    }
  }, [broadcastPatch]);

  const handleFieldChange = useCallback(<K extends keyof LootTableDefinition>(key: K, value: LootTableDefinition[K]) => {
    applyDefinitionUpdate((prev) => ({ ...prev, [key]: value }), key);
  }, [applyDefinitionUpdate]);

  const getIdleSnapshotLabel = useCallback(
    () => `Auto-save [${new Date().toLocaleString()}]`,
    [],
  );

  const autosave = useAutosave({
    key: `loot-table:${tableId}`,
    value: definition,
    enabled: false,
    onSave: async ({ value }) => {
      setError(null);
      const normalized = {
        ...value,
        guaranteed: value.guaranteed.map((entry) => ({ ...entry, weight: 1 })),
      };
      const result = await saveLootTableAction({ tableId, definition: normalized });
      if (!result.ok) {
        setError(result.error ?? 'Unable to save loot table');
        throw new Error(result.error ?? 'Unable to save loot table');
      }
      const nextDefinition = { ...normalized, version: result.version, updated_at: result.updated_at };
      setDefinition(nextDefinition);
      return { value: nextDefinition };
    },
    onCreateSnapshot: async (label) => {
      setError(null);
      const result = await createSnapshotAction(tableId, label);
      if (!result.ok) {
        setError(result.error ?? 'Unable to create snapshot');
        throw new Error(result.error ?? 'Unable to create snapshot');
      }
      setDefinition(result.definition);
      broadcastPatch('version', result.definition.version);
      broadcastPatch('updated_at', result.definition.updated_at);
      return { value: result.definition };
    },
    getIdleSnapshotLabel,
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

  const setAwardStrategy = (updater: (prev: AwardStrategyState) => AwardStrategyState) => {
    applyDefinitionUpdate(
      (prev) => ({ ...prev, awardStrategy: updater(prev.awardStrategy) }),
      'awardStrategy',
    );
  };

  const handleAwardStrategySelection = (type: AwardStrategyState['type']) => {
    if (type === 'DEFAULT') {
      setAwardStrategy(() => ({ type: 'DEFAULT' }));
      return;
    }
    setAwardStrategy((prev) => {
      if (prev.type === 'LOOT_CHEST') {
        return prev;
      }
      return { type: 'LOOT_CHEST', chestType: 'BIG' };
    });
  };

  const handleLootChestTypeChange = (chestType: LootChestOption) => {
    setAwardStrategy((prev) => {
      if (chestType === 'CUSTOM') {
        const existing = prev.type === 'LOOT_CHEST' && prev.chestType === 'CUSTOM' ? prev : null;
        return {
          type: 'LOOT_CHEST',
          chestType: 'CUSTOM',
          mythicMobName: existing?.mythicMobName ?? '',
          soundEffect: existing?.soundEffect ?? { key: '', pitch: 1, volume: 1 },
          dropDelay: existing?.dropDelay ?? 0,
          dropInterval: existing?.dropInterval ?? 0,
        } satisfies CustomLootChestStrategy;
      }
      return {
        type: 'LOOT_CHEST',
        chestType,
      };
    });
  };

  const handleCustomLootChestChange = <K extends Exclude<keyof CustomLootChestStrategy, 'type' | 'chestType'>>(
    key: K,
    value: CustomLootChestStrategy[K],
  ) => {
    setAwardStrategy((prev) => {
      if (prev.type !== 'LOOT_CHEST' || prev.chestType !== 'CUSTOM') {
        return prev;
      }
      return { ...prev, [key]: value };
    });
  };

  const handleEntryChange = (id: string, changes: Record<string, unknown>) => {
    applyDefinitionUpdate((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) => (entry.id === id ? { ...entry, ...changes } as LootEntry : entry)),
    }), 'entries');
  };

  const handleGuaranteedChange = (id: string, changes: Record<string, unknown>) => {
    applyDefinitionUpdate((prev) => ({
      ...prev,
      guaranteed: prev.guaranteed.map((entry) => (entry.id === id ? { ...entry, ...changes } as LootEntry : entry)),
    }), 'guaranteed');
  };

  const addEntry = (target: 'entries' | 'guaranteed') => {
    const type = target === 'entries' ? selectedWeightedType : selectedGuaranteedType;
    const baseEntry = { id: generateEntryId(), weight: 1, replacementStrategy: 'UNSET' as const };

    let newEntry: LootEntry;
    let successMessage: string;

    if (type === 'dropped_item' || type === 'given_item') {
      const itemId = target === 'entries' ? selectedWeightedItemId : selectedGuaranteedItemId;
      if (!itemId) {
        addNotification('Select an item to add.', 'info');
        return;
      }
      const item = items.find((i) => i.id === itemId);
      if (!item) {
        setError('Selected item could not be found.');
        return;
      }
      newEntry = { ...baseEntry, type, itemId: item.id, minYield: 1, maxYield: 1 };
      successMessage = `${type === 'dropped_item' ? 'Dropped' : 'Given'} item ${item.name ?? item.id} added.`;
    } else if (type === 'dropped_coin' || type === 'given_coin') {
      const coinType = target === 'entries' ? selectedWeightedCoinType : selectedGuaranteedCoinType;
      newEntry = { ...baseEntry, type, coinType, minAmount: 1, maxAmount: 1 };
      successMessage = `${coinTypeLabels[coinType]} coin loot added.`;
    } else if (type === 'dropped_clan_energy' || type === 'given_clan_energy') {
      const energyType = target === 'entries' ? selectedWeightedEnergyType : selectedGuaranteedEnergyType;
      newEntry = { ...baseEntry, type, energyType, minAmount: 1, maxAmount: 1, autoDeposit: false };
      successMessage = `${energyTypeLabels[energyType]} energy loot added.`;
    } else if (type === 'fish') {
      const itemId = target === 'entries' ? selectedWeightedFishId : selectedGuaranteedFishId;
      if (!itemId) {
        addNotification('Select a fish item to add.', 'info');
        return;
      }
      const item = items.find((i) => i.id === itemId);
      if (!item) {
        setError('Selected fish item could not be found.');
        return;
      }
      newEntry = { ...baseEntry, type: 'fish', itemId: item.id, displayName: item.name ?? '', minWeight: 1, maxWeight: 1 };
      successMessage = `Fish loot ${item.name ?? item.id} added.`;
    } else if (type === 'entity_spawn') {
      const entityType = target === 'entries' ? selectedWeightedEntityType : selectedGuaranteedEntityType;
      newEntry = { ...baseEntry, type: 'entity_spawn', entityType, launchAtSource: false };
      successMessage = `Entity spawn loot (${entityType}) added.`;
    } else {
      newEntry = { ...baseEntry, type: 'clan_experience', minXp: 100, maxXp: 100 };
      successMessage = 'Clan experience loot added.';
    }

    const targetArray = target === 'entries' ? definition.entries : definition.guaranteed;
    const newKey = getEntryKey(newEntry);
    if (targetArray.some((e) => getEntryKey(e) === newKey)) {
      setError('That entry is already present in this section.');
      return;
    }

    applyDefinitionUpdate((prev) => ({
      ...prev,
      [target]: [newEntry, ...(target === 'entries' ? prev.entries : prev.guaranteed)],
    }), target);
    addNotification(successMessage, 'success');
  };

  const removeEntry = (id: string, target: 'entries' | 'guaranteed') => {
    applyDefinitionUpdate((prev) => ({
      ...prev,
      [target]: prev[target].filter((entry) => entry.id !== id),
    }), target);
  };

  const resolveFocusedField = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const fieldElement = target.closest<HTMLElement>('[data-field-id]');
    if (fieldElement?.dataset.fieldId) {
      return fieldElement.dataset.fieldId;
    }

    if (target.id) {
      return target.id;
    }

    return null;
  }, []);

  const handleFocusCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const fieldId = resolveFocusedField(event.target);
    if (fieldId) {
      trackFocus(fieldId);
    }
  }, [resolveFocusedField, trackFocus]);

  const handleBlurCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const currentFieldId = resolveFocusedField(event.target);
    const nextFieldId = resolveFocusedField(event.relatedTarget);

    if (!currentFieldId || currentFieldId !== nextFieldId) {
      untrackFocus();
    }

    autosave.handleBlur();
  }, [autosave, resolveFocusedField, untrackFocus]);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const parsed = lootTableDefinitionSchema.safeParse(raw);
      if (!parsed.success) {
        console.error('Failed to import loot table: schema mismatch', parsed.error);
        setError('Unable to import loot table. Ensure it matches the expected schema.');
        return;
      }
      applyDefinitionUpdate((prev) => ({
        ...parsed.data,
        id: prev.id,
        version: prev.version,
        updated_at: new Date().toISOString(),
      }), 'name');
      broadcastPatch('description', parsed.data.description ?? '');
      broadcastPatch('notes', parsed.data.notes ?? '');
      broadcastPatch('entries', parsed.data.entries);
      broadcastPatch('guaranteed', parsed.data.guaranteed);
      broadcastPatch('rollStrategy', parsed.data.rollStrategy);
      broadcastPatch('weightDistribution', parsed.data.weightDistribution);
      broadcastPatch('replacementStrategy', parsed.data.replacementStrategy);
      broadcastPatch('awardStrategy', parsed.data.awardStrategy);
      addNotification(`Imported ${parsed.data.name}. Review and save to persist.`, 'success');
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
          autosave.markClean(definition);
          router.push('/loot-tables');
        })
        .catch((error) => {
          console.error('Delete action failed', error);
          setError('Unable to delete loot table.');
        });
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (autosave.dirty && autosave.status !== 'saving') {
          void autosave.saveNow();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [autosave]);

  return (
    <div className="space-y-6" onFocusCapture={handleFocusCapture} onBlurCapture={handleBlurCapture}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card/95 px-6 py-4 backdrop-blur-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">{definition.name}</h1>
          <p className="text-sm text-foreground/60">
            {`Version ${definition.version} · Last updated ${new Date(definition.updated_at).toLocaleString()}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator status={autosave.status} />
          <Button
            type="button"
            variant="default"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => autosave.saveNow()}
            disabled={autosave.status === 'saving' || !autosave.dirty}
          >
            <Save className="h-4 w-4" />
            {autosave.status === 'saving' ? 'Saving...' : 'Save changes'}
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
          <Button type="button" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export JSON
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-primary/40 bg-primary/12 px-3 py-2 text-sm text-primary hover:bg-primary/18">
            <Upload className="h-4 w-4" /> Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
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
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
              <Badge variant="outline" className={cn(autosave.dirty && "border-amber-500/50 text-amber-500")}>
                {autosave.dirty ? 'Unsaved changes' : 'Synced'}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <PresenceField fieldId="name" presence={others} className="sm:col-span-2">
                <div className="space-y-2" data-field-id="name">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={definition.name}
                    onChange={(event) => handleFieldChange('name', event.target.value)}
                  />
                </div>
              </PresenceField>
              <PresenceField fieldId="description" presence={others} className="sm:col-span-2">
                <div className="space-y-2" data-field-id="description">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    value={definition.description ?? ''}
                    onChange={(event) => handleFieldChange('description', event.target.value)}
                  />
                </div>
              </PresenceField>
              <PresenceField fieldId="notes" presence={others} className="sm:col-span-2">
                <div className="space-y-2" data-field-id="notes">
                  <Label htmlFor="notes">Designer notes</Label>
                  <Textarea
                    id="notes"
                    rows={4}
                    value={definition.notes ?? ''}
                    onChange={(event) => handleFieldChange('notes', event.target.value)}
                  />
                  <p className="text-xs text-foreground/50">
                    Notes are stored alongside the table and never exported to the live game.
                  </p>
                </div>
              </PresenceField>
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

              <PresenceField fieldId="awardStrategy" presence={others}>
                <section className="space-y-4" data-field-id="awardStrategy">
                <div className="space-y-2">
                  <Label>Award strategy</Label>
                  <p className="text-xs text-foreground/60">
                    Decide how the completed bundle is delivered to players.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {awardStrategyTypes.map((strategy) => (
                      <Button
                        key={strategy}
                        type="button"
                        variant={definition.awardStrategy.type === strategy ? 'default' : 'outline'}
                        onClick={() => handleAwardStrategySelection(strategy)}
                      >
                        {awardStrategyLabelMap[strategy]}
                      </Button>
                    ))}
                  </div>
                </div>

                {definition.awardStrategy.type === 'LOOT_CHEST' && (
                  <div className="space-y-4 rounded-md border border-primary/30 bg-primary/8 p-4">
                    <div className="space-y-2">
                      <Label>Loot chest type</Label>
                      <div className="flex flex-wrap gap-2">
                        {lootChestTypes.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={
                              definition.awardStrategy.type === 'LOOT_CHEST' &&
                              definition.awardStrategy.chestType === option
                                ? 'default'
                                : 'outline'
                            }
                            onClick={() => handleLootChestTypeChange(option)}
                          >
                            {lootChestLabelMap[option]}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {definition.awardStrategy.chestType === 'CUSTOM' && customAwardStrategy && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label htmlFor="custom-mythic-mob">Mythic mob name</Label>
                          <Input
                            id="custom-mythic-mob"
                            value={customAwardStrategy.mythicMobName}
                            onChange={(event) =>
                              handleCustomLootChestChange('mythicMobName', event.target.value)
                            }
                            onBlur={autosave.handleBlur}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="custom-drop-delay">Drop delay (ticks)</Label>
                            <Input
                              id="custom-drop-delay"
                              type="number"
                              min={0}
                              value={customAwardStrategy.dropDelay}
                              onChange={(event) =>
                                handleCustomLootChestChange(
                                  'dropDelay',
                                  Number.isNaN(Number(event.target.value))
                                    ? 0
                                    : Math.max(0, Math.floor(Number(event.target.value))),
                                )
                              }
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="custom-drop-interval">Drop interval (ticks)</Label>
                            <Input
                              id="custom-drop-interval"
                              type="number"
                              min={0}
                              value={customAwardStrategy.dropInterval}
                              onChange={(event) =>
                                handleCustomLootChestChange(
                                  'dropInterval',
                                  Number.isNaN(Number(event.target.value))
                                    ? 0
                                    : Math.max(0, Math.floor(Number(event.target.value))),
                                )
                              }
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Sound effect</Label>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1">
                              <Label htmlFor="custom-sound-key" className="text-xs font-medium text-foreground/70">
                                Namespace:key
                              </Label>
                              <Input
                                id="custom-sound-key"
                                value={customAwardStrategy.soundEffect?.key ?? ''}
                                onChange={(event) =>
                                  handleCustomLootChestChange('soundEffect', {
                                    ...(customAwardStrategy.soundEffect ?? { key: '', pitch: 1, volume: 1 }),
                                    key: event.target.value,
                                  })
                                }
                                onBlur={autosave.handleBlur}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="custom-sound-pitch" className="text-xs font-medium text-foreground/70">
                                Pitch
                              </Label>
                              <Input
                                id="custom-sound-pitch"
                                type="number"
                                min={0}
                                step={0.05}
                                value={customAwardStrategy.soundEffect?.pitch ?? 1}
                                onChange={(event) =>
                                  handleCustomLootChestChange('soundEffect', {
                                    ...(customAwardStrategy.soundEffect ?? { key: '', pitch: 1, volume: 1 }),
                                    pitch: Number(event.target.value) >= 0 ? Number(event.target.value) : 0,
                                  })
                                }
                                onBlur={autosave.handleBlur}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="custom-sound-volume" className="text-xs font-medium text-foreground/70">
                                Volume
                              </Label>
                              <Input
                                id="custom-sound-volume"
                                type="number"
                                min={0}
                                step={0.05}
                                value={customAwardStrategy.soundEffect?.volume ?? 1}
                                onChange={(event) =>
                                  handleCustomLootChestChange('soundEffect', {
                                    ...(customAwardStrategy.soundEffect ?? { key: '', pitch: 1, volume: 1 }),
                                    volume: Number(event.target.value) >= 0 ? Number(event.target.value) : 0,
                                  })
                                }
                                onBlur={autosave.handleBlur}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
              </PresenceField>

              <PresenceField fieldId="rollStrategy" presence={others}>
                <section className="space-y-4" data-field-id="rollStrategy">
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
                  <Button
                    type="button"
                    variant={definition.rollStrategy.type === 'EXPRESSION' ? 'default' : 'outline'}
                    onClick={() => handleRollStrategyChange({ type: 'EXPRESSION', expression: '', fallback: 1 })}
                  >
                    Expression
                  </Button>
                </div>

                {definition.rollStrategy.type === 'CONSTANT' && (
                  <div className="space-y-3 rounded-md border border-primary/30 bg-primary/8 p-4">
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
                  <div className="space-y-3 rounded-md border border-primary/30 bg-primary/8 p-4">
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

                {definition.rollStrategy.type === 'EXPRESSION' && (
                  <div className="space-y-3 rounded-md border border-primary/30 bg-primary/8 p-4">
                    <p className="text-xs text-foreground/60">
                      Evaluate a JEXL expression against the context&apos;s inputs to determine the roll count. Result is rounded to a non-negative integer.
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="expression-expr">Expression</Label>
                      <Textarea
                        id="expression-expr"
                        rows={2}
                        value={definition.rollStrategy.expression}
                        placeholder="e.g. fn:clamp(4 - slayer_standing, 1, 3)"
                        onChange={(event) => {
                          if (definition.rollStrategy.type === 'EXPRESSION') {
                            handleRollStrategyChange({
                              ...definition.rollStrategy,
                              expression: event.target.value,
                            });
                          }
                        }}
                        onBlur={autosave.handleBlur}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="expression-fallback">Fallback</Label>
                      <Input
                        id="expression-fallback"
                        type="number"
                        min={0}
                        value={definition.rollStrategy.fallback}
                        onChange={(event) => {
                          if (definition.rollStrategy.type === 'EXPRESSION') {
                            handleRollStrategyChange({
                              ...definition.rollStrategy,
                              fallback: Number(event.target.value) || 0,
                            });
                          }
                        }}
                        onBlur={autosave.handleBlur}
                      />
                      <p className="text-xs text-foreground/50">Used when the expression fails to evaluate (e.g. missing variable).</p>
                    </div>
                  </div>
                )}

                {definition.rollStrategy.type === 'RANDOM' && (
                  <div className="space-y-3 rounded-md border border-primary/30 bg-primary/8 p-4">
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
              </PresenceField>

              <PresenceField fieldId="inputs" presence={others}>
                <section className="space-y-4" data-field-id="inputs">
                  <Label>Inputs</Label>
                  <p className="text-xs text-foreground/60">
                    Document the variables that callers populate when invoking this table. These names become available inside expressions. Reserved: <code>roll_index, bundle_size, history_size, source</code>.
                  </p>
                  <div className="space-y-3">
                    {(definition.inputs ?? []).map((input, index) => (
                      <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-start rounded-md border border-foreground/10 p-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Key</Label>
                          <Input
                            value={input.key}
                            placeholder="slayer_standing"
                            onChange={(event) => {
                              const key = event.target.value;
                              applyDefinitionUpdate((prev) => ({
                                ...prev,
                                inputs: (prev.inputs ?? []).map((i, idx) => (idx === index ? { ...i, key } : i)),
                              }), 'inputs');
                            }}
                            onBlur={autosave.handleBlur}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={input.description}
                            placeholder="1 = first place, 2 = second, 3 = third"
                            onChange={(event) => {
                              const description = event.target.value;
                              applyDefinitionUpdate((prev) => ({
                                ...prev,
                                inputs: (prev.inputs ?? []).map((i, idx) => (idx === index ? { ...i, description } : i)),
                              }), 'inputs');
                            }}
                            onBlur={autosave.handleBlur}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove input"
                          onClick={() =>
                            applyDefinitionUpdate((prev) => ({
                              ...prev,
                              inputs: (prev.inputs ?? []).filter((_, idx) => idx !== index),
                            }), 'inputs')
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      applyDefinitionUpdate((prev) => ({
                        ...prev,
                        inputs: [...(prev.inputs ?? []), { key: '', description: '' }],
                      }), 'inputs')
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add input
                  </Button>
                </section>
              </PresenceField>

              <PresenceField fieldId="weightDistribution" presence={others}>
                <section className="space-y-4" data-field-id="weightDistribution">
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
                  <div className="space-y-3 rounded-md border border-primary/30 bg-primary/8 p-4">
                    <p className="text-xs text-foreground/60">
                      Each pity rule watches an entry and increases its weight after the specified number of failed rolls. The bump repeats every time the threshold is met.
                    </p>
                    {definition.pityRules.map((rule, index) => (
                      <div key={rule.entryId} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Entry</Label>
                          <Select
                            value={rule.entryId}
                            onValueChange={(entryId) => {
                              applyDefinitionUpdate((prev) => ({
                                ...prev,
                                pityRules: prev.pityRules.map((r, i) => (i === index ? { ...r, entryId } : r)),
                              }), 'pityRules');
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {definition.entries.map((entry) => (
                                <SelectItem key={entry.id} value={entry.id}>
                                  {getLootEntryLabel(entry, items)}
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
                              applyDefinitionUpdate((prev) => ({
                                ...prev,
                                pityRules: prev.pityRules.map((r, i) => (i === index ? { ...r, maxAttempts } : r)),
                              }), 'pityRules');
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
                              applyDefinitionUpdate((prev) => ({
                                ...prev,
                                pityRules: prev.pityRules.map((r, i) => (i === index ? { ...r, weightIncrement } : r)),
                              }), 'pityRules');
                            }}
                            onBlur={autosave.handleBlur}
                          />
                        </div>
                        <div className="sm:col-span-3 flex justify-end pt-1">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() =>
                              applyDefinitionUpdate((prev) => ({
                                ...prev,
                                pityRules: prev.pityRules.filter((_, i) => i !== index),
                              }), 'pityRules')
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remove rule
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        applyDefinitionUpdate((prev) => ({
                          ...prev,
                          pityRules: [
                            ...prev.pityRules,
                            {
                              entryId: prev.entries[0]?.id ?? '',
                              maxAttempts: 3,
                              weightIncrement: 1,
                            },
                          ].filter((rule) => rule.entryId),
                        }), 'pityRules')
                      }
                      disabled={definition.entries.length === 0}
                    >
                      <Plus className="h-4 w-4" /> Add pity rule
                    </Button>
                  </div>
                )}

                {definition.weightDistribution === 'PROGRESSIVE' && (
                <div className="space-y-3 rounded-md border border-primary/30 bg-primary/8 p-4">
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
                          applyDefinitionUpdate((prev) => ({
                            ...prev,
                            progressive: {
                              shiftFactor: 0,
                              varianceScaling: false,
                              ...prev.progressive,
                              maxShift
                            },
                          }), 'progressive');
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
                          applyDefinitionUpdate((prev) => ({
                            ...prev,
                            progressive: {
                              maxShift: 0,
                              varianceScaling: false,
                              ...prev.progressive,
                              shiftFactor
                            },
                          }), 'progressive');
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
                          applyDefinitionUpdate((prev) => ({
                            ...prev,
                            progressive: {
                              maxShift: 0,
                              shiftFactor: 0,
                              ...prev.progressive,
                              varianceScaling
                            },
                          }), 'progressive');
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
              </PresenceField>
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
                    value={selectedGuaranteedType}
                    onValueChange={(value) => setSelectedGuaranteedType(value as LootType)}
                  >
                    <SelectTrigger className="sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(lootTypeSelectLabels) as LootType[]).map((t) => (
                        <SelectItem key={t} value={t}>{lootTypeSelectLabels[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(selectedGuaranteedType === 'dropped_item' || selectedGuaranteedType === 'given_item') && (
                    <ItemCombobox
                      className="sm:w-64"
                      items={availableGuaranteedItems}
                      value={selectedGuaranteedItemId}
                      onSelect={setSelectedGuaranteedItemId}
                      disabled={availableGuaranteedItems.length === 0}
                      placeholder={availableGuaranteedItems.length === 0 ? 'No available items' : 'Search or select item'}
                    />
                  )}
                  {(selectedGuaranteedType === 'dropped_coin' || selectedGuaranteedType === 'given_coin') && (
                    <Select value={selectedGuaranteedCoinType} onValueChange={(value) => setSelectedGuaranteedCoinType(value as CoinType)}>
                      <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {coinTypes.map((ct) => <SelectItem key={ct} value={ct}>{coinTypeLabels[ct]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {(selectedGuaranteedType === 'dropped_clan_energy' || selectedGuaranteedType === 'given_clan_energy') && (
                    <Select value={selectedGuaranteedEnergyType} onValueChange={(value) => setSelectedGuaranteedEnergyType(value as EnergyType)}>
                      <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {energyTypes.map((et) => <SelectItem key={et} value={et}>{energyTypeLabels[et]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedGuaranteedType === 'fish' && (
                    <ItemCombobox
                      className="sm:w-64"
                      items={items}
                      value={selectedGuaranteedFishId}
                      onSelect={setSelectedGuaranteedFishId}
                      disabled={items.length === 0}
                      placeholder={items.length === 0 ? 'No items available' : 'Search or select item'}
                    />
                  )}
                  {selectedGuaranteedType === 'entity_spawn' && (
                    <Input
                      className="sm:w-48"
                      value={selectedGuaranteedEntityType}
                      onChange={(event) => setSelectedGuaranteedEntityType(event.target.value.toUpperCase())}
                      placeholder="e.g. DROWNED"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => addEntry('guaranteed')}
                    disabled={
                      ((selectedGuaranteedType === 'given_item' || selectedGuaranteedType === 'dropped_item') &&
                      (availableGuaranteedItems.length === 0 || !selectedGuaranteedItemId)) ||
                      (selectedGuaranteedType === 'fish' && !selectedGuaranteedFishId)
                    }
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
                <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-foreground/60">
                  Add a given item to define guaranteed drops such as quest rewards.
                </p>
              )}
              {definition.guaranteed.map((entry) => {
                const label = getLootEntryLabel(entry, items);
                const { label: badgeLabel, variant: badgeVariant, className: badgeClassName } = getEntryBadgeConfig(entry.type);
                const isCollapsed = collapsedEntries.has(entry.id);
                return (
                  <div key={entry.id} className="space-y-3 rounded-md border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <Badge variant={badgeVariant} className={badgeClassName ?? ''}>
                          {badgeLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleEntryCollapse(entry.id)} aria-label={isCollapsed ? 'Expand entry' : 'Collapse entry'}>
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(entry.id, 'guaranteed')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {!isCollapsed && (<>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(entry.type === 'dropped_item' || entry.type === 'given_item') ? (
                        <>
                          <div className="space-y-1">
                            <Label>Min yield</Label>
                            <Input
                              type="number"
                              min={0}
                              value={entry.minYield}
                              onChange={(event) => handleGuaranteedChange(entry.id, { minYield: Number(event.target.value) || 0 })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Max yield</Label>
                            <Input
                              type="number"
                              min={entry.minYield}
                              value={entry.maxYield}
                              onChange={(event) => handleGuaranteedChange(entry.id, { maxYield: Number(event.target.value) || entry.maxYield })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                        </>
                      ) : (entry.type === 'dropped_coin' || entry.type === 'given_coin' || entry.type === 'dropped_clan_energy' || entry.type === 'given_clan_energy') ? (
                        <>
                          <div className="space-y-1">
                            <Label>Min amount</Label>
                            <Input
                              type="number"
                              min={0}
                              value={entry.minAmount}
                              onChange={(event) => handleGuaranteedChange(entry.id, { minAmount: Number(event.target.value) || 0 })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Max amount</Label>
                            <Input
                              type="number"
                              min={entry.minAmount}
                              value={entry.maxAmount}
                              onChange={(event) => handleGuaranteedChange(entry.id, { maxAmount: Number(event.target.value) || entry.maxAmount })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                        </>
                      ) : entry.type === 'clan_experience' ? (
                        <>
                          <div className="space-y-1">
                            <Label>Min XP</Label>
                            <Input
                              type="number"
                              min={0}
                              value={entry.minXp}
                              onChange={(event) => handleGuaranteedChange(entry.id, { minXp: Number(event.target.value) || 0 })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Max XP</Label>
                            <Input
                              type="number"
                              min={entry.minXp}
                              value={entry.maxXp}
                              onChange={(event) => handleGuaranteedChange(entry.id, { maxXp: Number(event.target.value) || entry.maxXp })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                        </>
                      ) : entry.type === 'fish' ? (
                        <>
                          <div className="space-y-1">
                            <Label>Display name</Label>
                            <Input
                              value={entry.displayName}
                              onChange={(event) => handleGuaranteedChange(entry.id, { displayName: event.target.value })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Min weight (lb)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={entry.minWeight}
                              onChange={(event) => handleGuaranteedChange(entry.id, { minWeight: Number(event.target.value) || 0 })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Max weight (lb)</Label>
                            <Input
                              type="number"
                              min={entry.minWeight}
                              value={entry.maxWeight}
                              onChange={(event) => handleGuaranteedChange(entry.id, { maxWeight: Number(event.target.value) || entry.maxWeight })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                        </>
                      ) : entry.type === 'entity_spawn' ? (
                        <>
                          <div className="space-y-1">
                            <Label>Entity type</Label>
                            <Input
                              value={entry.entityType}
                              onChange={(event) => handleGuaranteedChange(entry.id, { entityType: event.target.value.toUpperCase() })}
                              onBlur={autosave.handleBlur}
                              placeholder="e.g. DROWNED"
                            />
                          </div>
                        </>
                      ) : null}
                      <div className="space-y-1">
                        <Label>Replacement</Label>
                        <Select
                          value={entry.replacementStrategy}
                          onValueChange={(value) => handleGuaranteedChange(entry.id, { replacementStrategy: value as ReplacementStrategy })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {replacementStrategies.map((strategy) => (
                              <SelectItem key={strategy} value={strategy}>{strategy}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-foreground/50">Guarantees rarely need overrides, but the option is here for parity.</p>
                      </div>
                    </div>
                    {(entry.type === 'dropped_clan_energy' || entry.type === 'given_clan_energy') && (
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Auto deposit</Label>
                          <Select
                            value={entry.autoDeposit ? 'true' : 'false'}
                            onValueChange={(value) => handleGuaranteedChange(entry.id, { autoDeposit: value === 'true' })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="false">No</SelectItem>
                              <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-foreground/50">Automatically deposit energy into the player&apos;s clan.</p>
                        </div>
                      </div>
                    )}
                    {entry.type === 'entity_spawn' && (
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Launch at source</Label>
                          <Select
                            value={entry.launchAtSource ? 'true' : 'false'}
                            onValueChange={(value) => handleGuaranteedChange(entry.id, { launchAtSource: value === 'true' })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="false">No</SelectItem>
                              <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-foreground/50">Fling the entity toward the player after spawning.</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label>PDC marker key</Label>
                          <Input
                            value={entry.pdcMarkerKey ?? ''}
                            onChange={(event) => handleGuaranteedChange(entry.id, { pdcMarkerKey: event.target.value || undefined })}
                            onBlur={autosave.handleBlur}
                            placeholder="e.g. progression:fishing_swimmer"
                          />
                          <p className="text-xs text-foreground/50">Optional adventure Key set as a boolean PDC entry on the spawned entity.</p>
                        </div>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-4">
                      <ConditionField
                        value={entry.condition}
                        onChange={(condition) => handleGuaranteedChange(entry.id, { condition })}
                        onBlur={autosave.handleBlur}
                      />
                    </div>
                    </>)}
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
                    value={selectedWeightedType}
                    onValueChange={(value) => setSelectedWeightedType(value as LootType)}
                  >
                    <SelectTrigger className="sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(lootTypeSelectLabels) as LootType[]).map((t) => (
                        <SelectItem key={t} value={t}>{lootTypeSelectLabels[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(selectedWeightedType === 'dropped_item' || selectedWeightedType === 'given_item') && (
                    <ItemCombobox
                      className="sm:w-64"
                      items={availableWeightedItems}
                      value={selectedWeightedItemId}
                      onSelect={setSelectedWeightedItemId}
                      disabled={availableWeightedItems.length === 0}
                      placeholder={availableWeightedItems.length === 0 ? 'No available items' : 'Search or select item'}
                    />
                  )}
                  {(selectedWeightedType === 'dropped_coin' || selectedWeightedType === 'given_coin') && (
                    <Select value={selectedWeightedCoinType} onValueChange={(value) => setSelectedWeightedCoinType(value as CoinType)}>
                      <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {coinTypes.map((ct) => <SelectItem key={ct} value={ct}>{coinTypeLabels[ct]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {(selectedWeightedType === 'dropped_clan_energy' || selectedWeightedType === 'given_clan_energy') && (
                    <Select value={selectedWeightedEnergyType} onValueChange={(value) => setSelectedWeightedEnergyType(value as EnergyType)}>
                      <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {energyTypes.map((et) => <SelectItem key={et} value={et}>{energyTypeLabels[et]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedWeightedType === 'fish' && (
                    <ItemCombobox
                      className="sm:w-64"
                      items={items}
                      value={selectedWeightedFishId}
                      onSelect={setSelectedWeightedFishId}
                      disabled={items.length === 0}
                      placeholder={items.length === 0 ? 'No items available' : 'Search or select item'}
                    />
                  )}
                  {selectedWeightedType === 'entity_spawn' && (
                    <Input
                      className="sm:w-48"
                      value={selectedWeightedEntityType}
                      onChange={(event) => setSelectedWeightedEntityType(event.target.value.toUpperCase())}
                      placeholder="e.g. DROWNED"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => addEntry('entries')}
                    disabled={
                      ((selectedWeightedType === 'given_item' || selectedWeightedType === 'dropped_item') &&
                      (availableWeightedItems.length === 0 || !selectedWeightedItemId)) ||
                      (selectedWeightedType === 'fish' && !selectedWeightedFishId)
                    }
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
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3 text-sm">
                <span>Total weight</span>
                <Badge variant="default">{totalWeight}</Badge>
              </div>
              <p className="text-xs text-foreground/50">
                Each probability uses P(x) = w(x) / Σw, so increasing one weight reduces the odds of all other entries proportionally.
              </p>
              {definition.entries.length === 0 && (
                <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-foreground/60">
                  Add a dropped item to start defining weighted loot for this table.
                </p>
              )}
              {definition.entries.map((entry) => {
                const label = getLootEntryLabel(entry, items);
                const { label: badgeLabel, variant: badgeVariant, className: badgeClassName } = getEntryBadgeConfig(entry.type);
                const probability = probabilities[entry.id] ?? 0;
                const replacement = getReplacement(entry, definition.replacementStrategy);
                const isCollapsed = collapsedEntries.has(entry.id);
                return (
                  <div key={entry.id} className="space-y-3 rounded-md border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <Badge variant={badgeVariant} className={badgeClassName ?? ''}>
                          {badgeLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{(probability * 100).toFixed(2)}%</Badge>
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleEntryCollapse(entry.id)} aria-label={isCollapsed ? 'Expand entry' : 'Collapse entry'}>
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(entry.id, 'entries')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted/50">
                      <div className="h-full rounded-full bg-primary/50 transition-all duration-300" style={{ width: `${Math.min(probability * 100, 100)}%` }} />
                    </div>
                    {!isCollapsed && (<>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <WeightField
                        weight={entry.weight}
                        onChange={(weight) => handleEntryChange(entry.id, { weight })}
                        onBlur={autosave.handleBlur}
                        helperText="Higher weight increases selection odds."
                      />
                      {(entry.type === 'dropped_item' || entry.type === 'given_item') ? (
                        <>
                          <div className="space-y-1">
                            <Label>Min yield</Label>
                            <Input
                              type="number"
                              min={0}
                              value={entry.minYield}
                              onChange={(event) => handleEntryChange(entry.id, { minYield: Number(event.target.value) || 0 })}
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
                              onChange={(event) => handleEntryChange(entry.id, { maxYield: Number(event.target.value) || entry.maxYield })}
                              onBlur={autosave.handleBlur}
                            />
                            <p className="text-xs text-foreground/50">Cap the possible amount per selection.</p>
                          </div>
                        </>
                      ) : (entry.type === 'dropped_coin' || entry.type === 'given_coin' || entry.type === 'dropped_clan_energy' || entry.type === 'given_clan_energy') ? (
                        <>
                          <div className="space-y-1">
                            <Label>Min amount</Label>
                            <Input
                              type="number"
                              min={0}
                              value={entry.minAmount}
                              onChange={(event) => handleEntryChange(entry.id, { minAmount: Number(event.target.value) || 0 })}
                              onBlur={autosave.handleBlur}
                            />
                            <p className="text-xs text-foreground/50">Minimum amount awarded when this loot wins.</p>
                          </div>
                          <div className="space-y-1">
                            <Label>Max amount</Label>
                            <Input
                              type="number"
                              min={entry.minAmount}
                              value={entry.maxAmount}
                              onChange={(event) => handleEntryChange(entry.id, { maxAmount: Number(event.target.value) || entry.maxAmount })}
                              onBlur={autosave.handleBlur}
                            />
                            <p className="text-xs text-foreground/50">Cap the possible amount per selection.</p>
                          </div>
                        </>
                      ) : entry.type === 'clan_experience' ? (
                        <>
                          <div className="space-y-1">
                            <Label>Min XP</Label>
                            <Input
                              type="number"
                              min={0}
                              value={entry.minXp}
                              onChange={(event) => handleEntryChange(entry.id, { minXp: Number(event.target.value) || 0 })}
                              onBlur={autosave.handleBlur}
                            />
                            <p className="text-xs text-foreground/50">Minimum clan XP awarded when this loot wins.</p>
                          </div>
                          <div className="space-y-1">
                            <Label>Max XP</Label>
                            <Input
                              type="number"
                              min={entry.minXp}
                              value={entry.maxXp}
                              onChange={(event) => handleEntryChange(entry.id, { maxXp: Number(event.target.value) || entry.maxXp })}
                              onBlur={autosave.handleBlur}
                            />
                            <p className="text-xs text-foreground/50">Cap the possible XP per selection.</p>
                          </div>
                        </>
                      ) : entry.type === 'fish' ? (
                        <>
                          <div className="space-y-1">
                            <Label>Display name</Label>
                            <Input
                              value={entry.displayName}
                              onChange={(event) => handleEntryChange(entry.id, { displayName: event.target.value })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Min weight (lb)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={entry.minWeight}
                              onChange={(event) => handleEntryChange(entry.id, { minWeight: Number(event.target.value) || 0 })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Max weight (lb)</Label>
                            <Input
                              type="number"
                              min={entry.minWeight}
                              value={entry.maxWeight}
                              onChange={(event) => handleEntryChange(entry.id, { maxWeight: Number(event.target.value) || entry.maxWeight })}
                              onBlur={autosave.handleBlur}
                            />
                          </div>
                        </>
                      ) : entry.type === 'entity_spawn' ? (
                        <>
                          <div className="space-y-1">
                            <Label>Entity type</Label>
                            <Input
                              value={entry.entityType}
                              onChange={(event) => handleEntryChange(entry.id, { entityType: event.target.value.toUpperCase() })}
                              onBlur={autosave.handleBlur}
                              placeholder="e.g. DROWNED"
                            />
                          </div>
                        </>
                      ) : null}
                      <div className="space-y-1">
                        <Label>Replacement</Label>
                        <Select
                          value={replacement}
                          onValueChange={(value) => handleEntryChange(entry.id, { replacementStrategy: value as ReplacementStrategy })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {replacementStrategies.map((strategy) => (
                              <SelectItem key={strategy} value={strategy}>{strategy}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-foreground/50">Override the table replacement rule when needed.</p>
                      </div>
                    </div>
                    {(entry.type === 'dropped_clan_energy' || entry.type === 'given_clan_energy') && (
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Auto deposit</Label>
                          <Select
                            value={entry.autoDeposit ? 'true' : 'false'}
                            onValueChange={(value) => handleEntryChange(entry.id, { autoDeposit: value === 'true' })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="false">No</SelectItem>
                              <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-foreground/50">Automatically deposit energy into the player&apos;s clan.</p>
                        </div>
                      </div>
                    )}
                    {entry.type === 'entity_spawn' && (
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Launch at source</Label>
                          <Select
                            value={entry.launchAtSource ? 'true' : 'false'}
                            onValueChange={(value) => handleEntryChange(entry.id, { launchAtSource: value === 'true' })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="false">No</SelectItem>
                              <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-foreground/50">Fling the entity toward the player after spawning.</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label>PDC marker key</Label>
                          <Input
                            value={entry.pdcMarkerKey ?? ''}
                            onChange={(event) => handleEntryChange(entry.id, { pdcMarkerKey: event.target.value || undefined })}
                            onBlur={autosave.handleBlur}
                            placeholder="e.g. progression:fishing_swimmer"
                          />
                          <p className="text-xs text-foreground/50">Optional adventure Key set as a boolean PDC entry on the spawned entity.</p>
                        </div>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-4">
                      <ConditionField
                        value={entry.condition}
                        onChange={(condition) => handleEntryChange(entry.id, { condition })}
                        onBlur={autosave.handleBlur}
                      />
                    </div>
                    </>)}
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
              <div className="rounded-md border bg-muted/30 p-4 text-xs text-foreground/60">
                <p>
                  Manual saves write directly to Supabase. Snapshots advance the table version, and remote field edits resolve with last-writer-wins semantics.
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
              'rounded-md border px-4 py-3 text-sm shadow-lg transition-all duration-300 animate-in slide-in-from-bottom-2',
              notification.type === 'success' &&
                'border-green-500/40 bg-green-500/10 text-green-300',
              notification.type === 'info' &&
                'border-primary/40 bg-primary/12 text-primary',
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

      {/* Floating Run Simulation button */}
      <Link
        href={`/loot-tables/${tableId}/simulate`}
        className="group fixed bottom-6 right-6 z-50 flex items-center overflow-hidden rounded-xl bg-blue-600 shadow-lg shadow-blue-900/40 transition-all duration-150 ease-out hover:shadow-xl hover:shadow-blue-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <span className="flex max-w-0 items-center overflow-hidden whitespace-nowrap pl-0 text-sm font-medium text-white transition-all duration-150 ease-out group-hover:max-w-[8rem] group-hover:pl-4">
          Run simulation
        </span>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center">
          <Wand2 className="h-5 w-5 text-white" />
        </span>
      </Link>
    </div>
  );
}
