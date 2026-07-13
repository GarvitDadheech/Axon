'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers';

export default function MCPLoginPage() {
  const { ready, authenticated, login, getIdToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated) return;

    const fetchToken = async () => {
      setIsGenerating(true);
      try {
        setToken(await getIdToken());
      } catch (err) {
        setError('Error generating token: ' + String(err));
      } finally {
        setIsGenerating(false);
      }
    };

    fetchToken();
  }, [ready, authenticated, getIdToken]);

  const configSnippet = token
    ? `{
  "mcpServers": {
    "axon": {
      "url": "${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/mcp",
      "headers": {
        "Authorization": "Bearer ${token}"
      }
    }
  }
}`
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-slate-700 rounded-lg shadow-xl p-8 max-w-lg w-full">
        <h1 className="text-2xl font-bold text-white mb-2">MCP Authentication</h1>
        <p className="text-slate-400 text-sm mb-6">
          Axon MCP requires your Particle Auth session token (<code className="text-xs">uuid:token</code>).
          Every tool call pays from <strong className="text-slate-200">your</strong> Openfort agent wallet.
        </p>

        {!ready ? (
          <div className="text-slate-300 text-center">Loading...</div>
        ) : !authenticated ? (
          <div>
            <p className="text-slate-300 mb-4">
              Sign in with Particle Auth to get a Bearer token for Claude / Cursor MCP.
            </p>
            <button
              onClick={() => login()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            >
              Sign in with Particle
            </button>
          </div>
        ) : isGenerating ? (
          <div className="text-slate-300 text-center">Generating token...</div>
        ) : token ? (
          <div>
            <p className="text-slate-300 mb-3 text-sm">
              Paste this into your MCP host config:
            </p>
            <div className="bg-slate-800 rounded p-3 mb-3 overflow-x-auto">
              <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">{configSnippet}</pre>
            </div>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(configSnippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              {copied ? "Copied!" : "Copy MCP config"}
            </button>
            <ol className="mt-4 text-slate-400 text-xs space-y-1 list-decimal list-inside">
              <li>Enable spending policy on the dashboard</li>
              <li>Fund your Openfort agent wallet with Sepolia USDC</li>
              <li>Restart the MCP host after pasting the config</li>
            </ol>
            <p className="text-slate-500 text-xs mt-3">
              Particle session tokens expire — refresh this page for a new one if calls return 401.
            </p>
          </div>
        ) : error ? (
          <div className="text-red-400">
            <p className="mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
