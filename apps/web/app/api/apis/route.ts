import { type NextRequest } from "next/server";
import { getAuthUser, serverError } from "@/lib/auth";
import { listPublicApis, createApi } from "@/lib/queries/apis";

export async function GET() {
  try {
    const apis = await listPublicApis();
    return Response.json({ apis }, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}

interface CreateApiBody {
  name?: string;
  description?: string;
  endpointUrl?: string;
  pricePerCall?: string;
  chain?: string;
  sampleRequest?: Record<string, unknown>;
  sampleResponse?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (auth instanceof Response) return auth;

  let body: CreateApiBody = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, description, endpointUrl, pricePerCall, chain, sampleRequest, sampleResponse } = body;
  if (!name || !endpointUrl || !pricePerCall) {
    return Response.json(
      { error: "name, endpointUrl, and pricePerCall are required" },
      { status: 400 }
    );
  }

  try {
    const api = await createApi({
      ownerUserId: auth.dbUserId,
      name,
      description,
      endpointUrl,
      pricePerCall,
      chain: chain ?? "arbitrum-sepolia",
      sampleRequest: sampleRequest ?? null,
      sampleResponse: sampleResponse ?? null,
    });
    return Response.json({ api }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
