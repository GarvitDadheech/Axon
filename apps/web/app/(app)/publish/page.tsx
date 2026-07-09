"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers";
import { PlusCircle, ExternalLink, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, shortenAddress } from "@/lib/utils";

interface PublishedApi {
  id: number;
  name: string;
  description: string | null;
  endpoint_url: string;
  price_per_call: string;
  chain: string;
  sample_request: Record<string, unknown> | null;
  sample_response: Record<string, unknown> | null;
  created_at: string;
}

const CHAIN = { value: "arbitrum-sepolia", label: "Arbitrum Sepolia" };

const SAMPLE_REQUEST_PLACEHOLDER = `{
  "query": "string — search term",
  "limit": "number — max results (default 10)",
  "filters": {
    "category": "string — optional filter"
  }
}`;

const SAMPLE_RESPONSE_PLACEHOLDER = `{
  "results": [
    {
      "id": "string",
      "title": "string",
      "score": "number"
    }
  ],
  "total": "number"
}`;

function JsonError({ text }: { text: string }) {
  if (!text.trim()) return null;
  try { JSON.parse(text); return null; } catch {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive mt-1">
        <AlertCircle className="h-3 w-3" /> Invalid JSON
      </p>
    );
  }
}

function isValidJson(text: string) {
  if (!text.trim()) return true;
  try { JSON.parse(text); return true; } catch { return false; }
}

export default function PublishPage() {
  const { getIdToken } = useAuth();
  const [apis, setApis] = useState<PublishedApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingApis, setFetchingApis] = useState(true);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    endpointUrl: "",
    pricePerCall: "",
    sampleRequest: "",
    sampleResponse: "",
    chain: "arbitrum-sepolia",
  });

  const fetchMyApis = useCallback(async () => {
    const token = await getIdToken();
    const res = await fetch("/api/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { publishedApis } = await res.json();
      setApis(publishedApis ?? []);
    }
    setFetchingApis(false);
  }, [getIdToken]);

  useEffect(() => { fetchMyApis(); }, [fetchMyApis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidJson(form.sampleRequest) || !isValidJson(form.sampleResponse)) return;
    setLoading(true);
    setSuccess(false);

    const token = await getIdToken();
    const res = await fetch("/api/apis", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        endpointUrl: form.endpointUrl,
        pricePerCall: form.pricePerCall,
        chain: form.chain,
        sampleRequest: form.sampleRequest.trim() ? JSON.parse(form.sampleRequest) : undefined,
        sampleResponse: form.sampleResponse.trim() ? JSON.parse(form.sampleResponse) : undefined,
      }),
    });

    if (res.ok) {
      setSuccess(true);
      setForm({ name: "", description: "", endpointUrl: "", pricePerCall: "", sampleRequest: "", sampleResponse: "", chain: "arbitrum-sepolia" });
      fetchMyApis();
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  const jsonInvalid = !isValidJson(form.sampleRequest) || !isValidJson(form.sampleResponse);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Publish API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register your API endpoint for agents to discover and pay for.
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name + Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">API Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Weather Data"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per Call (USDC) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="0.01"
                  value={form.pricePerCall}
                  onChange={(e) => setForm({ ...form, pricePerCall: e.target.value })}
                  required
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Endpoint */}
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint URL *</Label>
              <Input
                id="endpoint"
                type="url"
                placeholder="https://api.example.com/v1/data"
                value={form.endpointUrl}
                onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  — tell agents what this API does and when to use it
                </span>
              </Label>
              <Textarea
                id="description"
                placeholder="Returns real-time weather data for a given city. Use this when you need current temperature, humidity, or forecast information."
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Sample Request + Response */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sampleRequest">
                  Sample Request Body
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">JSON</span>
                </Label>
                <Textarea
                  id="sampleRequest"
                  placeholder={SAMPLE_REQUEST_PLACEHOLDER}
                  rows={8}
                  className="font-mono text-xs resize-none"
                  value={form.sampleRequest}
                  onChange={(e) => setForm({ ...form, sampleRequest: e.target.value })}
                />
                <JsonError text={form.sampleRequest} />
                <p className="text-xs text-muted-foreground/60">Describe each field so agents know what to send</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sampleResponse">
                  Sample Response
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">JSON</span>
                </Label>
                <Textarea
                  id="sampleResponse"
                  placeholder={SAMPLE_RESPONSE_PLACEHOLDER}
                  rows={8}
                  className="font-mono text-xs resize-none"
                  value={form.sampleResponse}
                  onChange={(e) => setForm({ ...form, sampleResponse: e.target.value })}
                />
                <JsonError text={form.sampleResponse} />
                <p className="text-xs text-muted-foreground/60">Show agents what fields to expect in the response</p>
              </div>
            </div>

            {/* Chain */}
            <div className="space-y-2">
              <Label>Chain</Label>
              <div className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground gap-2 w-full">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                {CHAIN.label}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={loading || jsonInvalid} className="min-w-[130px]">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Publish API
                  </>
                )}
              </Button>
              {success && (
                <span className="flex items-center gap-1.5 text-sm text-primary font-medium animate-fade-up">
                  <CheckCircle2 className="h-4 w-4" />
                  Published successfully!
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* My APIs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your APIs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fetchingApis ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : !apis.length ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No APIs published yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Chain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apis.map((api) => (
                  <TableRow key={api.id}>
                    <TableCell className="font-medium">{api.name}</TableCell>
                    <TableCell>
                      <a
                        href={api.endpoint_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {shortenAddress(api.endpoint_url.replace(/^https?:\/\//, ""), 8)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatAmount(api.price_per_call)} USDC
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{api.chain}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
