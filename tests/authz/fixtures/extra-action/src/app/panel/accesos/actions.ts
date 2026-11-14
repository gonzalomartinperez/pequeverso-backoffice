"use server";
// Synthetic negative fixture: an action that is not in the authz matrix and does no role check.
export async function deleteEverythingAction(): Promise<void> {}
export const inlineExport = async (): Promise<void> => {};
