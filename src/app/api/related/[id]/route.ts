import { handleApiRequest } from "@/lib/api-core";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApiRequest(request, {
    GATEWAY_URL: process.env.ANTRA_GATEWAY_URL,
    API_KEY: process.env.ANTRA_API_KEY,
    STREAM_TEMPLATE: process.env.ANTRA_STREAM_TEMPLATE,
  });
}

export async function OPTIONS(request: Request) {
  return handleApiRequest(request, {});
}
