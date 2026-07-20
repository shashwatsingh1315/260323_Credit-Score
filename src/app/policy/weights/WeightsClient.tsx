"use client";
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteWeightMatrix, upsertWeightMatrix } from '../actions';

export default function WeightsClient({ matrices, personas, parameters }: { matrices: any[]; personas: any[]; parameters: any[] }) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const matrixByCell = useMemo(() => new Map<string, any>(matrices.map((matrix) => [`${matrix.parameter_id}:${matrix.persona_id}`, matrix])), [matrices]);
  const sortedParameters = [...parameters].sort((a, b) => a.stage - b.stage || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Weight matrix</h1>
        <p className="text-sm text-muted-foreground">Default parameter weights stay visible beside every persona override. Select a cell to edit it; clear an override to inherit the default.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Parameters × personas</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Parameter</TableHead>
                <TableHead className="min-w-28">Default</TableHead>
                {personas.map((persona) => <TableHead key={persona.id} className="min-w-36">{persona.name}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedParameters.map((parameter, index) => {
                const startsStage = index === 0 || sortedParameters[index - 1]?.stage !== parameter.stage;
                return [
                  ...(startsStage ? [
                    <TableRow key={`stage-${parameter.stage}`} className="bg-muted/40">
                      <TableCell colSpan={personas.length + 2} className="py-2 text-tiny font-bold uppercase tracking-wider text-muted-foreground">Stage {parameter.stage}</TableCell>
                    </TableRow>,
                  ] : []),
                  <TableRow key={parameter.id}>
                    <TableCell className="font-medium">{parameter.name}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{parameter.weight}</TableCell>
                    {personas.map((persona) => {
                      const cellKey = `${parameter.id}:${persona.id}`;
                      const matrix = matrixByCell.get(cellKey);
                      const isEditing = editingCell === cellKey;
                      return (
                        <TableCell key={persona.id}>
                          {isEditing ? (
                            <form action={async (formData) => { await upsertWeightMatrix(formData); setEditingCell(null); }} className="flex items-center gap-1">
                              {matrix?.id && <input type="hidden" name="id" value={matrix.id} />}
                              <input type="hidden" name="persona_id" value={persona.id} />
                              <input type="hidden" name="parameter_id" value={parameter.id} />
                              <Input name="weight" type="number" step="0.01" min="0" defaultValue={matrix?.weight ?? parameter.weight} className="h-8 w-20" autoFocus />
                              <Button size="sm" className="h-8 px-2">Save</Button>
                              {matrix?.id && (
                                <Button formAction={async () => { const fd = new FormData(); fd.set('id', matrix.id); await deleteWeightMatrix(fd); setEditingCell(null); }} type="submit" size="sm" variant="ghost" className="h-8 px-2">Clear</Button>
                              )}
                            </form>
                          ) : (
                            <button type="button" onClick={() => setEditingCell(cellKey)} className={`w-full rounded px-2 py-1.5 text-left text-sm tabular-nums hover:bg-muted ${matrix ? 'font-semibold text-foreground' : 'text-muted-foreground'}`} title={matrix ? 'Persona override' : `Inherited default: ${parameter.weight}`}>
                              {matrix?.weight ?? parameter.weight}
                              {!matrix && <span className="ml-1 text-tiny">inherited</span>}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>,
                ];
              })}
              {sortedParameters.length === 0 && <TableRow><TableCell colSpan={personas.length + 2} className="py-8 text-center text-muted-foreground">No parameters configured.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
