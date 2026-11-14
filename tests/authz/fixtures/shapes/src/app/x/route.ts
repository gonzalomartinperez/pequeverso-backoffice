export async function GET(): Promise<Response> {
  return new Response(null);
}
export const POST = async (): Promise<Response> => new Response(null);
async function remove(): Promise<Response> {
  return new Response(null);
}

export { remove as DELETE };
export const dynamic = "force-dynamic";
