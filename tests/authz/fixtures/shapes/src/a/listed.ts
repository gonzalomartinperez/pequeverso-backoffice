"use server";
async function hidden(): Promise<void> {}
export async function first(): Promise<void> {}
export const second = async (): Promise<void> => {};
export { hidden as renamed };
export type Ignored = string;
