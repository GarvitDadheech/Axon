'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers';

export default function MCPLoginPage() {
  const { ready, authenticated, login, getIdToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated) return;

    // The Magic DID token itself is what Axon's APIs (and /api/mcp) accept
    // as a Bearer token — no separate token-minting endpoint needed.
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-slate-700 rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6">MCP Authentication</h1>

        {!ready ? (
          <div className="text-slate-300 text-center">Loading...</div>
        ) : !authenticated ? (
          <div>
            <p className="text-slate-300 mb-4">
              You need to log in with Google to authenticate with MCP.
            </p>
            <button
              onClick={() => login()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            >
              Sign in with Google
            </button>
          </div>
        ) : isGenerating ? (
          <div className="text-slate-300 text-center">Generating token...</div>
        ) : token ? (
          <div>
            <p className="text-slate-300 mb-4">
              ✅ Authentication successful! Copy your access token and paste it into the MCP command:
            </p>
            <div className="bg-slate-800 rounded p-3 mb-4 break-all">
              <code className="text-green-400 text-sm font-mono">{token}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(token);
                alert('Token copied to clipboard!');
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              Copy Token
            </button>
            <p className="text-slate-400 text-sm mt-4">
              In MCP, run: <code className="bg-slate-800 px-2 py-1 rounded">x402_set_token(&lt;paste-token&gt;)</code>
            </p>
            <p className="text-slate-400 text-xs mt-2">
              Note: Magic DID tokens expire quickly — re-run this page to fetch a fresh one if a call starts failing with 401.
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
