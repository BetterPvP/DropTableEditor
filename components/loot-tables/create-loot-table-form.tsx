'use client';

import { FormEvent, useState, useTransition } from 'react';
import { z } from 'zod';
import { useAutosave } from '@/lib/hooks/use-autosave';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SaveIndicator } from '@/components/save-indicator';
import { createLootTableAction } from '@/app/loot-tables/new/actions';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type FormState = z.infer<typeof schema>;

const initialState: FormState = {
  name: '',
  description: '',
};

export function CreateLootTableForm() {
  const [state, setState] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [version, setVersion] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isCreating, startTransition] = useTransition();

  const autosave = useAutosave<FormState>({
    key: 'new-loot-table',
    version,
    value: state,
    onSave: async ({ value }) => {
      const validation = schema.safeParse(value);
      if (!validation.success) {
        const fieldErrors = validation.error.formErrors.fieldErrors;
        setErrors({
          name: fieldErrors.name?.[0],
          description: fieldErrors.description?.[0],
        });
        throw new Error('Validation failed');
      }
      setErrors({});
      await new Promise((resolve) => setTimeout(resolve, 250));
      setVersion((v) => v + 1);
      console.info('Autosaved new loot table draft', value);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = schema.safeParse(state);
    if (!validation.success) {
      const fieldErrors = validation.error.formErrors.fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
      });
      return;
    }
    setErrors({});
    setServerError(null);
    const formData = new FormData();
    formData.append('name', validation.data.name);
    if (validation.data.description) {
      formData.append('description', validation.data.description);
    }

    startTransition(async () => {
      const response = await createLootTableAction(formData);
      if (response && !response.ok) {
        setServerError(response.error ?? 'Unable to create loot table');
      }
    });
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Create loot table</h1>
          <p className="text-sm text-foreground/70">Draft a new table and the autosave engine will protect your changes.</p>
        </div>
        <Badge variant="info">Draft</Badge>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Give the loot table a descriptive name and optional summary.</CardDescription>
          </div>
          <SaveIndicator status={autosave.status} />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={state.name}
              onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
              onBlur={autosave.handleBlur}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={state.description}
              onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
              onBlur={autosave.handleBlur}
              rows={4}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => autosave.saveNow()}>
              Save now
            </Button>
            <Button type="button" variant="outline" onClick={() => setState(initialState)}>
              Reset form
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create loot table'}
            </Button>
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        </CardContent>
      </Card>
    </form>
  );
}
