import { handleApiRequest } from "@/lib/api-core";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApiRequest(request, {
    GATEWAY_URL: process.env.ANTRA_GATEWAY_URL,
    API_KEY: process.env.ANTRA_API_KEY,
  });
}

export async function OPTIONS(request: Request) {
  return handleApiRequest(request, {});
}
