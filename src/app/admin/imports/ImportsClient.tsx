"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, AlertCircle, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse'; // Ensure papaparse is installed or handled via CDN. Assuming standard import here.
import { processImportJob } from './actions';

export default function ImportsClient({ jobs }: { jobs: any[] }) {
  const [importType, setImportType] = useState('party_master');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError('');

    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV Parsing Error: ${results.errors[0].message}`);
        } else {
          setPreview(results.data);
        }
      }
    });
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    setProcessing(true);
    setError('');

    try {
      const fd = new FormData();
      fd.set('import_type', importType);
      fd.set('payload', JSON.stringify(preview));

      await processImportJob(fd);

      setFile(null);
      setPreview([]);
      (document.getElementById('csv-upload') as HTMLInputElement).value = '';
    } catch (err: any) {
      setError(err.message || 'Import failed.');
    } finally {
      setProcessing(false);
    }
  };

  const templates = {
    'party_master': 'legal_name,customer_code,industry_category\nAcme Corp,CUST-101,Manufacturing',
    'historical_exposure': 'party_id,order_count,total_volume,payment_recency_days,average_delay_days,max_delay_days,data_as_of\nUUID-HERE,50,5000000,14,2.5,15,2024-01-01',
    'outstanding_exposure': 'party_id,outstanding_amount,overdue_amount,overdue_days,data_as_of\nUUID-HERE,1500000,0,0,2024-01-01'
  };

  const downloadTemplate = () => {
    const csvContent = templates[importType as keyof typeof templates];
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${importType}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Data Imports</h1>
          <p className="text-sm text-muted-foreground">Import Party Master, History, and Exposure via CSV.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>New Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Import Type</label>
              <select
                value={importType}
                onChange={(e) => { setImportType(e.target.value); setPreview([]); setFile(null); }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="party_master">Party Master</option>
                <option value="historical_exposure">Historical History & Metrics</option>
                <option value="outstanding_exposure">Outstanding Exposure (Live)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download size={14} className="mr-2" /> Download Template
              </Button>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 hover:bg-muted/50 transition-colors">
              <FileSpreadsheet size={32} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Select a CSV file to upload</p>
                <p className="text-xs text-muted-foreground">Must match the selected template structure</p>
              </div>
              <input id="csv-upload" type="file" accept=".csv" onChange={handleFile} className="text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {preview.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Preview ({preview.length} rows)</p>
                  <Button onClick={handleUpload} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700">
                    {processing ? 'Processing...' : `Confirm & Import ${preview.length} rows`}
                  </Button>
                </div>
                <div className="max-h-40 overflow-auto border rounded text-xs bg-muted/30">
                  <table className="w-full text-left">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {Object.keys(preview[0]).map(k => <th key={k} className="p-2 font-semibold">{k}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v: any, j) => <td key={j} className="p-2 truncate max-w-[150px]">{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 5 && <p className="text-center p-2 text-muted-foreground italic">... and {preview.length - 5} more rows</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="capitalize text-xs font-medium">{j.import_type.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <Badge variant={j.status === 'completed' ? 'success' : j.status === 'failed' ? 'destructive' : 'warning'} className="text-[10px]">
                          {j.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {j.records_processed} / {j.records_total}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {new Date(j.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {jobs.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No import jobs history.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}