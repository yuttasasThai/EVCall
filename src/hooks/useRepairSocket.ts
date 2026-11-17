import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BranchLink,
  CreateRepairPayload,
  PublicShopInfo,
  RepairTicket,
  ServerWsEvent,
  UpdateRepairPayload,
} from '../types/repair';
import {
  apiCreateRepair,
  apiDeleteRepair,
  apiGetShopInfo,
  apiListRepairs,
  apiUpdateRepair,
  isExpressServerAvailable,
  subscribeLocalSync,
} from '../utils/apiClient';

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
    const info = await apiGetShopInfo(branchCode);
    setShopInfo(info);
  }, [branchCode]);

  const fetchRepairs = useCallback(async () => {
    try {
      const list = await apiListRepairs();
      setRepairs(list);
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

    const unsubLocal = subscribeLocalSync((msg) => {
      if (disposed) return;
      if (msg.type === 'repair:created') {
        setRepairs((prev) => {
          if (prev.some((r) => r.id === msg.repair.id)) return prev;
          return [msg.repair, ...prev];
        });
        onCreatedRef.current?.(msg.repair);
      } else if (msg.type === 'repair:updated') {
        upsertRepair(msg.repair);
        onUpdatedRef.current?.(msg.repair);
      } else if (msg.type === 'repair:deleted') {
        setRepairs((prev) => prev.filter((r) => r.id !== msg.id));
      } else if (msg.type === 'shop:updated') {
        if (msg.branchCode === branchCode) {
          setShopInfo((prev) => ({
            ...prev,
            technicianName: msg.technicianName,
            technicianPhone: msg.technicianPhone,
          }));
        }
      } else if (msg.type === 'branch:updated') {
        if (msg.branch.code === branchCode) {
          void fetchShopInfo();
        }
        onBranchUpdatedRef.current?.(msg.branch);
      } else if (msg.type === 'branch:deleted') {
        if (branchCode !== 'main') {
          void fetchShopInfo();
        }
        onBranchDeletedRef.current?.(msg.id);
      }
    });

    const initRealtime = async () => {
      const hasExpress = await isExpressServerAvailable();
      if (disposed) return;

      if (!hasExpress) {
        // Static Vercel / browser-persistent mode
        setIsConnected(true);
        return;
      }

      const connect = () => {
        if (disposed) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!disposed) setIsConnected(true);
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
                if (prev.some((r) => r.id === data.repair.id)) return prev;
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
          reconnectTimer = window.setTimeout(connect, 2500);
        };

        ws.onerror = () => {
          ws?.close();
        };
      };

      connect();
    };

    void initRealtime();

    return () => {
      disposed = true;
      unsubLocal();
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      ws?.close();
    };
  }, [branchCode, fetchRepairs, fetchShopInfo, upsertRepair]);

  const createRepair = useCallback(
    async (payload: CreateRepairPayload): Promise<RepairTicket> => {
      const created = await apiCreateRepair(payload, branchCode);
      upsertRepair(created);
      return created;
    },
    [branchCode, upsertRepair],
  );

  const updateRepair = useCallback(
    async (
      id: string,
      payload: UpdateRepairPayload,
      authHeaders: Record<string, string> = {},
    ): Promise<RepairTicket> => {
      const updated = await apiUpdateRepair(id, payload, authHeaders);
      upsertRepair(updated);
      return updated;
    },
    [upsertRepair],
  );

  const deleteRepair = useCallback(
    async (id: string, authHeaders: Record<string, string> = {}): Promise<void> => {
      await apiDeleteRepair(id, authHeaders);
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
