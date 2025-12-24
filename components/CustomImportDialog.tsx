/**
 * Custom Import Dialog Component for PVEScriptsLocal
 *
 * This React component provides a web interface for importing
 * GitHub/Claude Code repositories into PVEScriptsLocal.
 *
 * Add this to your PVEScriptsLocal installation's components directory.
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Loader2, Github, Package, Download, Settings, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface ResourceConfig {
  cpu?: number;
  ram?: number;
  hdd?: number;
  os?: 'debian' | 'ubuntu' | 'alpine';
  version?: string;
}

interface ImportPreview {
  manifest: {
    name: string;
    slug: string;
    description: string;
    source: {
      project_type: string;
      owner: string;
      repo: string;
      branch: string;
    };
    install_methods: Array<{
      resources: ResourceConfig;
    }>;
  };
  hasExistingManifest: boolean;
  installScriptPreview: string;
}

interface ImportResult {
  success: boolean;
  manifest: ImportPreview['manifest'];
  message: string;
}

interface CustomImportDialogProps {
  onImportComplete?: (result: ImportResult) => void;
  trigger?: React.ReactNode;
}

const OS_VERSIONS: Record<string, string[]> = {
  debian: ['13', '12', '11'],
  ubuntu: ['24.04', '22.04', '20.04'],
  alpine: ['3.23', '3.22', '3.21'],
};

export function CustomImportDialog({
  onImportComplete,
  trigger,
}: CustomImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'input' | 'preview' | 'configure' | 'importing' | 'complete'>('input');
  const [githubUrl, setGithubUrl] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [resources, setResources] = useState<ResourceConfig>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  // API calls (replace with your actual tRPC client)
  const fetchPreview = async (url: string): Promise<ImportPreview> => {
    const response = await fetch('/api/trpc/customImport.preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error('Failed to fetch preview');
    return response.json();
  };

  const submitImport = async (data: {
    url: string;
    customName?: string;
    customDescription?: string;
    customResources?: ResourceConfig;
  }): Promise<ImportResult> => {
    const response = await fetch('/api/trpc/customImport.import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to import');
    return response.json();
  };

  const handlePreview = useCallback(async () => {
    if (!githubUrl.trim()) {
      setError('Please enter a GitHub URL');
      return;
    }

    setError(null);
    setStep('importing');

    try {
      const previewData = await fetchPreview(githubUrl);
      setPreview(previewData);
      setCustomName(previewData.manifest.name);
      setCustomDescription(previewData.manifest.description);
      setResources(previewData.manifest.install_methods[0]?.resources || {});
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repository info');
      setStep('input');
    }
  }, [githubUrl]);

  const handleImport = useCallback(async () => {
    setError(null);
    setStep('importing');

    try {
      const importResult = await submitImport({
        url: githubUrl,
        customName: customName !== preview?.manifest.name ? customName : undefined,
        customDescription: customDescription !== preview?.manifest.description ? customDescription : undefined,
        customResources: resources,
      });

      setResult(importResult);
      setStep('complete');
      onImportComplete?.(importResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import repository');
      setStep('configure');
    }
  }, [githubUrl, customName, customDescription, resources, preview, onImportComplete]);

  const resetDialog = useCallback(() => {
    setStep('input');
    setGithubUrl('');
    setPreview(null);
    setCustomName('');
    setCustomDescription('');
    setResources({});
    setError(null);
    setResult(null);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetDialog();
    }
  }, [resetDialog]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Github className="h-4 w-4" />
            Import from GitHub
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Import Custom Script
          </DialogTitle>
          <DialogDescription>
            Import a GitHub repository to deploy as a PVE container or VM.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="github-url">GitHub Repository URL</Label>
              <Input
                id="github-url"
                placeholder="https://github.com/owner/repo or https://github.com/owner/repo/tree/branch"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
              />
              <p className="text-xs text-muted-foreground">
                Supports main branch or specific branch URLs. Claude Code projects will be auto-detected.
              </p>
            </div>

            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium mb-2">Supported project types:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Node.js</Badge>
                <Badge variant="secondary">Python</Badge>
                <Badge variant="secondary">Docker</Badge>
                <Badge variant="secondary">Go</Badge>
                <Badge variant="secondary">Rust</Badge>
                <Badge variant="secondary">Generic</Badge>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4 py-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{preview.manifest.name}</CardTitle>
                  <Badge variant={preview.hasExistingManifest ? 'default' : 'secondary'}>
                    {preview.hasExistingManifest ? 'Has Manifest' : 'Auto-detected'}
                  </Badge>
                </div>
                <CardDescription>
                  {preview.manifest.source.owner}/{preview.manifest.source.repo}
                  {preview.manifest.source.branch !== 'main' && ` (${preview.manifest.source.branch})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {preview.manifest.description}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Type:</span>
                    <Badge variant="outline">{preview.manifest.source.project_type}</Badge>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Slug:</span>
                    <code className="px-1 bg-muted rounded">{preview.manifest.slug}</code>
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground">
              Click &quot;Configure&quot; to customize settings or &quot;Import Now&quot; to use defaults.
            </div>
          </div>
        )}

        {step === 'configure' && preview && (
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="custom-name">Display Name</Label>
              <Input
                id="custom-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-description">Description</Label>
              <Textarea
                id="custom-description"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                rows={2}
              />
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="resources">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Container Resources
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="cpu">CPU Cores</Label>
                      <Input
                        id="cpu"
                        type="number"
                        min={1}
                        max={16}
                        value={resources.cpu || ''}
                        onChange={(e) => setResources({ ...resources, cpu: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ram">RAM (MB)</Label>
                      <Input
                        id="ram"
                        type="number"
                        min={128}
                        max={32768}
                        step={128}
                        value={resources.ram || ''}
                        onChange={(e) => setResources({ ...resources, ram: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hdd">Disk (GB)</Label>
                      <Input
                        id="hdd"
                        type="number"
                        min={1}
                        max={500}
                        value={resources.hdd || ''}
                        onChange={(e) => setResources({ ...resources, hdd: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="os">Operating System</Label>
                      <Select
                        value={resources.os || 'debian'}
                        onValueChange={(value: 'debian' | 'ubuntu' | 'alpine') =>
                          setResources({ ...resources, os: value, version: OS_VERSIONS[value][0] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debian">Debian</SelectItem>
                          <SelectItem value="ubuntu">Ubuntu</SelectItem>
                          <SelectItem value="alpine">Alpine</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="version">OS Version</Label>
                      <Select
                        value={resources.version || OS_VERSIONS[resources.os || 'debian'][0]}
                        onValueChange={(value) => setResources({ ...resources, version: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OS_VERSIONS[resources.os || 'debian'].map((version) => (
                            <SelectItem key={version} value={version}>
                              {resources.os === 'ubuntu' ? `${version} LTS` : version}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {preview ? 'Importing repository...' : 'Fetching repository info...'}
            </p>
          </div>
        )}

        {step === 'complete' && result && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h3 className="font-semibold text-lg">Import Successful!</h3>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>

            <Card>
              <CardContent className="pt-4">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="font-medium">Name:</dt>
                  <dd>{result.manifest.name}</dd>
                  <dt className="font-medium">Slug:</dt>
                  <dd><code className="px-1 bg-muted rounded">{result.manifest.slug}</code></dd>
                  <dt className="font-medium">Type:</dt>
                  <dd>{result.manifest.source.project_type}</dd>
                </dl>
              </CardContent>
            </Card>

            <p className="text-sm text-center text-muted-foreground">
              Your script is now available in the &quot;Custom&quot; category.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <Button onClick={handlePreview} disabled={!githubUrl.trim()}>
              <Download className="h-4 w-4 mr-2" />
              Fetch Repository
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('configure')}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
              <Button onClick={handleImport}>
                Import Now
              </Button>
            </>
          )}

          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setStep('preview')}>
                Back
              </Button>
              <Button onClick={handleImport}>
                Import
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomImportDialog;
