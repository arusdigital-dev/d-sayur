import type { ApiEnvelope } from "@/types/store";

export class StoreApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function storeApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/store/${path}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    cache: "no-store",
  });
  const result = await response.json() as ApiEnvelope<T> | { success: false; error?: { message?: string } };
  if (!response.ok || !result.success) {
    throw new StoreApiError(!result.success ? result.error?.message ?? "Permintaan belum berhasil." : "Permintaan belum berhasil.", response.status);
  }
  return result.data;
}

export function moneyLabel(money: { amount: number; currency: string }) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount);
}
