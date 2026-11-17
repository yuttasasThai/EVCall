import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BranchLink,
  CreateRepairPayload,
  PublicShopInfo,
  RepairTicket,
  ServerWsEvent,
  UpdateRepairPayload,
} from '../types/repair';

interface UseRepairSocketOptions {
  branchCode: string;
  onRepairCreated?: (repair: RepairTicket) => void;
  onRepairUpdated?: (repair: RepairTicket) => void;
  onBranchUpdated?: (branch: BranchLink) => void;
  onBranchDeleted?: (id: string) => void;
}

export function useRepairSocket(options: UseRepairSocketOptions) {
  const { branchCode } = options;
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [shopInfo, setShopInfo] = useState<PublicShopInfo>({
    branchCode,
    branchName: branchCode === 'main' ? 'สาขาหลัก' : 'กำลังตรวจสอบสาขา...',
    technicianName: 'สมชาย',
    technicianPhone: '080-000-0000',
    isExpired: false,
    isNotFound: false,
    expiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const onCreatedRef = useRef(options.onRepairCreated);
  const onUpdatedRef = useRef(options.onRepairUpdated);
  const onBranchUpdatedRef = useRef(options.onBranchUpdated);
  const onBranchDeletedRef = useRef(options.onBranchDeleted);

  onCreatedRef.current = options.onRepairCreated;
  onUpdatedRef.current = options.onRepairUpdated;
  onBranchUpdatedRef.current = options.onBranchUpdated;
  onBranchDeletedRef.current = options.onBranchDeleted;

  const upsertRepair = useCallback((incoming: RepairTicket) => {
    setRepairs((prev) => {
      const idx = prev.findIndex((item) => item.id === incoming.id);
      if (idx === -1) {
        return [incoming, ...prev];
      }
      const next = [...prev];
      next[idx] = incoming;
      return next;
    });
  }, []);

  const fetchShopInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/shop-info?branch=${encodeURIComponent(branchCode)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { shop?: PublicShopInfo };
      if (data.shop) {
        setShopInfo(data.shop);
      }
    } catch {
      // Ignore network errors
    }
  }, [branchCode]);

  const fetchRepairs = useCallback(async () => {
    try {
      const res = await fetch('/api/repairs');
      if (!res.ok) return;
      const data = (await res.json()) as { repairs?: RepairTicket[] };
      if (Array.isArray(data.repairs)) {
        setRepairs(data.repairs);
      }
    } catch {
      // Keep existing state if offline
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;

    void fetchShopInfo();
    void fetchRepairs();

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!disposed) {
          setIsConnected(true);
        }
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const data = JSON.parse(event.data) as ServerWsEvent;
          if (data.type === 'init') {
            setRepairs(data.repairs);
            setIsLoading(false);
          } else if (data.type === 'repair:created') {
            setRepairs((prev) => {
              if (prev.some((r) => r.id === data.repair.id)) {
                return prev;
              }
              return [data.repair, ...prev];
            });
            onCreatedRef.current?.(data.repair);
          } else if (data.type === 'repair:updated') {
            upsertRepair(data.repair);
            onUpdatedRef.current?.(data.repair);
          } else if (data.type === 'repair:deleted') {
            setRepairs((prev) => prev.filter((r) => r.id !== data.id));
          } else if (data.type === 'shop:updated') {
            if (data.branchCode === branchCode) {
              setShopInfo((prev) => ({
                ...prev,
                technicianName: data.technicianName,
                technicianPhone: data.technicianPhone,
              }));
            }
          } else if (data.type === 'branch:updated') {
            if (data.branch.code === branchCode) {
              void fetchShopInfo();
            }
            onBranchUpdatedRef.current?.(data.branch);
          } else if (data.type === 'branch:deleted') {
            if (branchCode !== 'main') {
              void fetchShopInfo();
            }
            onBranchDeletedRef.current?.(data.id);
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setIsConnected(false);
        reconnectTimer = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      ws?.close();
    };
  }, [branchCode, fetchRepairs, fetchShopInfo, upsertRepair]);

  const createRepair = useCallback(
    async (payload: CreateRepairPayload): Promise<RepairTicket> => {
      const res = await fetch('/api/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, branchCode }),
      });
      const data = (await res.json()) as { repair?: RepairTicket; error?: string };
      if (!res.ok || !data.repair) {
        throw new Error(data.error || 'ไม่สามารถส่งข้อมูลแจ้งซ่อมได้');
      }
      upsertRepair(data.repair);
      return data.repair;
    },
    [branchCode, upsertRepair],
  );

  const updateRepair = useCallback(
    async (
      id: string,
      payload: UpdateRepairPayload,
      authHeaders: Record<string, string> = {},
    ): Promise<RepairTicket> => {
      const res = await fetch(`/api/repairs/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { repair?: RepairTicket; error?: string };
      if (!res.ok || !data.repair) {
        throw new Error(data.error || 'ไม่สามารถอัปเดตสถานะงานซ่อมได้');
      }
      upsertRepair(data.repair);
      return data.repair;
    },
    [upsertRepair],
  );

  const deleteRepair = useCallback(
    async (id: string, authHeaders: Record<string, string> = {}): Promise<void> => {
      const res = await fetch(`/api/repairs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) {
        throw new Error('ไม่สามารถลบรายการได้');
      }
      setRepairs((prev) => prev.filter((r) => r.id !== id));
    },
    [],
  );

  return {
    repairs,
    shopInfo,
    setShopInfo,
    isLoading,
    isConnected,
    createRepair,
    updateRepair,
    deleteRepair,
    refresh: fetchRepairs,
    refreshShopInfo: fetchShopInfo,
  };
}
