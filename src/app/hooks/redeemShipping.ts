import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { storage } from "lib/ext/storage";

export type RedeemShippingInput = {
  name: string;
  address: string;
  phone: string;
  email: string;
  note?: string | null;
};

export type RedeemShippingEntry = RedeemShippingInput & {
  updatedAt: number;
};

export type RedeemShippingEntryWithId = RedeemShippingEntry & {
  id: string;
};

const STORAGE_PREFIX = "redeem_shipping_history_";
const MAX_HISTORY = 5;

const normalizeText = (value: string) => value.trim();
const normalizePhone = (value: string) => value.replace(/\s+/g, "").trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();

function normalizeInput(input: RedeemShippingInput): RedeemShippingInput {
  return {
    name: normalizeText(input.name),
    address: normalizeText(input.address),
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    note: normalizeText(input.note ?? "") || null,
  };
}

function entryKey(entry: RedeemShippingInput) {
  const normalized = normalizeInput(entry);
  return [
    normalized.name,
    normalized.address,
    normalized.phone,
    normalized.email,
    normalized.note ?? "",
  ].join("|");
}

export function useRedeemShippingHistory(walletAddress?: string) {
  const [items, setItems] = useState<RedeemShippingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const storageKey = useMemo(() => {
    if (!walletAddress) return null;
    return `${STORAGE_PREFIX}${walletAddress.toLowerCase()}`;
  }, [walletAddress]);

  const reload = useCallback(async () => {
    if (!storageKey) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const cached =
        await storage.fetchForce<RedeemShippingEntry[]>(storageKey);
      setItems(Array.isArray(cached) ? cached : []);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    reload().catch(() => {
      setItems([]);
    });
  }, [reload]);

  const saveEntry = useCallback(
    async (input: RedeemShippingInput) => {
      if (!storageKey) return;

      const normalized = normalizeInput(input);
      const nextEntry: RedeemShippingEntry = {
        ...normalized,
        updatedAt: Date.now(),
      };

      const nextItems = [
        nextEntry,
        ...itemsRef.current.filter(
          (entry) => entryKey(entry) !== entryKey(nextEntry),
        ),
      ].slice(0, MAX_HISTORY);

      setItems(nextItems);
      await storage.put(storageKey, nextItems);
    },
    [storageKey],
  );

  const clearHistory = useCallback(async () => {
    if (!storageKey) return;
    setItems([]);
    await storage.remove(storageKey);
  }, [storageKey]);

  const itemsWithId = useMemo(
    () =>
      items.map((entry) => ({
        ...entry,
        id: entryKey(entry),
      })),
    [items],
  );

  return { items: itemsWithId, loading, saveEntry, clearHistory, reload };
}
