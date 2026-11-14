// Synthetic negative fixture: a mutating handler that is not in the authz matrix.
export async function PUT(): Promise<Response> {
  return new Response(null);
}
