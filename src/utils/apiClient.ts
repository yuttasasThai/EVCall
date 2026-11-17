import {
  REPAIR_STATUS_STEPS,
  VEHICLE_LABELS,
  type BranchLink,
  type CreateBranchPayload,
  type CreateRepairPayload,
  type PublicShopInfo,
  type RepairTicket,
  type TechnicianSettingsPayload,
  type UpdateBranchPayload,
  type UpdateRepairPayload,
} from '../types/repair';

const LS_REPAIRS = 'ev_care_fallback_repairs_v1';
const LS_SETTINGS = 'ev_care_fallback_settings_v1';
const LS_BRANCHES = 'ev_care_fallback_branches_v1';
const BROADCAST_CHANNEL_NAME = 'ev_care_realtime_sync';
const ADMIN_FALLBACK_CODE = '0992256601';

interface LocalTechSettings {
  branchCode: string;
  technicianName: string;
  technicianPhone: string;
  passcode: string;
}

const DEFAULT_MAIN_TECH: LocalTechSettings = {
  branchCode: 'main',
  technicianName: 'สมชาย',
  technicianPhone: '080-000-0000',
  passcode: '1234',
};

let serverAvailableCache: boolean | null = null;
let serverProbePromise: Promise<boolean> | null = null;

export async function isExpressServerAvailable(): Promise<boolean> {
  if (serverAvailableCache !== null) return serverAvailableCache;
  if (serverProbePromise) return serverProbePromise;

  serverProbePromise = (async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        serverAvailableCache = false;
        return false;
      }
      const data = (await res.json()) as { ok?: boolean; engine?: string };
      serverAvailableCache = Boolean(data.ok && data.engine === 'express');
      return serverAvailableCache;
    } catch {
      serverAvailableCache = false;
      return false;
    } finally {
      serverProbePromise = null;
    }
  })();

  return serverProbePromise;
}

async function safeJson<T>(res: Response): Promise<T | null> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export type LocalSyncMessage =
  | { type: 'repair:created'; repair: RepairTicket }
  | { type: 'repair:updated'; repair: RepairTicket }
  | { type: 'repair:deleted'; id: string }
  | {
      type: 'shop:updated';
      branchCode: string;
      technicianName: string;
      technicianPhone: string;
    }
  | { type: 'branch:updated'; branch: BranchLink }
  | { type: 'branch:deleted'; id: string };

function emitLocalSync(msg: LocalSyncMessage): void {
  try {
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      ch.postMessage(msg);
      ch.close();
    }
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('ev-care-local-sync', { detail: msg }));
}

export function subscribeLocalSync(handler: (msg: LocalSyncMessage) => void): () => void {
  let ch: BroadcastChannel | null = null;
  try {
    if ('BroadcastChannel' in window) {
      ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      ch.onmessage = (e) => {
        if (e.data) handler(e.data as LocalSyncMessage);
      };
    }
  } catch {
    // ignore
  }

  const onCustom = (e: Event) => {
    const custom = e as CustomEvent<LocalSyncMessage>;
    if (custom.detail) handler(custom.detail);
  };
  window.addEventListener('ev-care-local-sync', onCustom);

  return () => {
    ch?.close();
    window.removeEventListener('ev-care-local-sync', onCustom);
  };
}

function getLocalSettingsMap(): Record<string, LocalTechSettings> {
  const map = readLocal<Record<string, LocalTechSettings>>(LS_SETTINGS, {});
  if (!map.main) {
    map.main = { ...DEFAULT_MAIN_TECH };
    writeLocal(LS_SETTINGS, map);
  }
  return map;
}

function getLocalShopInfo(branchCode = 'main'): PublicShopInfo {
  const code = branchCode.trim() || 'main';
  const settingsMap = getLocalSettingsMap();

  if (code === 'main') {
    const s = settingsMap.main || DEFAULT_MAIN_TECH;
    return {
      branchCode: 'main',
      branchName: 'สาขาหลัก',
      technicianName: s.technicianName,
      technicianPhone: s.technicianPhone,
      isExpired: false,
      isNotFound: false,
      expiresAt: null,
    };
  }

  const branches = readLocal<BranchLink[]>(LS_BRANCHES, []);
  const branch = branches.find((b) => b.code === code);
  if (!branch) {
    return {
      branchCode: code,
      branchName: 'ไม่พบสาขา',
      technicianName: DEFAULT_MAIN_TECH.technicianName,
      technicianPhone: DEFAULT_MAIN_TECH.technicianPhone,
      isExpired: true,
      isNotFound: true,
      expiresAt: null,
    };
  }

  const exp = Date.parse(branch.expiresAt);
  const expired = !branch.isActive || Number.isNaN(exp) || Date.now() > exp;
  const s = settingsMap[code];

  return {
    branchCode: branch.code,
    branchName: branch.branchName,
    technicianName: s?.technicianName || branch.technicianName || 'ช่างประจำสาขา',
    technicianPhone: s?.technicianPhone || branch.technicianPhone || '',
    isExpired: expired,
    isNotFound: false,
    expiresAt: branch.expiresAt,
  };
}

export async function apiGetShopInfo(branchCode: string): Promise<PublicShopInfo> {
  if (await isExpressServerAvailable()) {
    try {
      const res = await fetch(`/api/shop-info?branch=${encodeURIComponent(branchCode)}`);
      const data = await safeJson<{ shop?: PublicShopInfo }>(res);
      if (res.ok && data?.shop) return data.shop;
    } catch {
      // fall through
    }
  }
  return getLocalShopInfo(branchCode);
}

export async function apiListRepairs(): Promise<RepairTicket[]> {
  if (await isExpressServerAvailable()) {
    try {
      const res = await fetch('/api/repairs');
      const data = await safeJson<{ repairs?: RepairTicket[] }>(res);
      if (res.ok && Array.isArray(data?.repairs)) return data.repairs;
    } catch {
      // fall through
    }
  }
  return readLocal<RepairTicket[]>(LS_REPAIRS, []);
}

export async function apiCreateRepair(
  payload: CreateRepairPayload,
  branchCode: string,
): Promise<RepairTicket> {
  if (await isExpressServerAvailable()) {
    try {
      const res = await fetch('/api/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, branchCode }),
      });
      const data = await safeJson<{ repair?: RepairTicket; error?: string }>(res);
      if (data) {
        if (!res.ok || !data.repair) {
          throw new Error(data.error || 'ไม่สามารถส่งข้อมูลแจ้งซ่อมได้');
        }
        return data.repair;
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes('JSON')) {
        throw err;
      }
    }
  }

  // Fallback local persistence (works on static hosts like Vercel)
  const shop = getLocalShopInfo(branchCode);
  if (branchCode !== 'main' && (shop.isNotFound || shop.isExpired)) {
    throw new Error('ลิงก์สาขานี้หมดอายุหรือไม่พร้อมใช้งาน');
  }

  const list = readLocal<RepairTicket[]>(LS_REPAIRS, []);
  const datePart = new Date().toISOString().slice(2, 7).replace('-', '');
  const now = new Date().toISOString();

  const newRepair: RepairTicket = {
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    code: `EV-${datePart}-${String(list.length + 1).padStart(3, '0')}`,
    branchCode: shop.branchCode,
    branchName: shop.branchName,
    vehicleType: payload.vehicleType,
    vehicleLabel: VEHICLE_LABELS[payload.vehicleType],
    customerName: payload.customerName.trim().slice(0, 100),
    phone: payload.phone.trim().slice(0, 30),
    issue: payload.issue.trim().slice(0, 500),
    location: payload.location,
    status: 'pending',
    technicianNote: '',
    estimatedCost: '',
    createdAt: now,
    updatedAt: now,
    statusHistory: [
      {
        status: 'pending',
        timestamp: now,
        note: 'ลูกค้าส่งคำขอแจ้งซ่อมเข้าระบบ',
      },
    ],
  };

  writeLocal(LS_REPAIRS, [newRepair, ...list]);
  emitLocalSync({ type: 'repair:created', repair: newRepair });
  return newRepair;
}

export async function apiUpdateRepair(
  id: string,
  payload: UpdateRepairPayload,
  authHeaders: Record<string, string>,
): Promise<RepairTicket> {
  if (await isExpressServerAvailable()) {
    try {
      const res = await fetch(`/api/repairs/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      });
      const data = await safeJson<{ repair?: RepairTicket; error?: string }>(res);
      if (data) {
        if (!res.ok || !data.repair) {
          throw new Error(data.error || 'ไม่สามารถอัปเดตสถานะงานซ่อมได้');
        }
        return data.repair;
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes('JSON')) {
        throw err;
      }
    }
  }

  const list = readLocal<RepairTicket[]>(LS_REPAIRS, []);
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) {
    throw new Error('ไม่พบรายการแจ้งซ่อมที่ต้องการอัปเดต');
  }

  const current = list[idx];
  const now = new Date().toISOString();
  const nextHistory = [...current.statusHistory];
  let nextStatus = current.status;

  if (payload.status && payload.status !== current.status) {
    nextStatus = payload.status;
    const stepMeta = REPAIR_STATUS_STEPS.find((s) => s.id === payload.status);
    nextHistory.push({
      status: payload.status,
      timestamp: now,
      note:
        typeof payload.technicianNote === 'string' && payload.technicianNote.trim()
          ? payload.technicianNote.trim()
          : stepMeta?.label,
    });
  }

  const updated: RepairTicket = {
    ...current,
    status: nextStatus,
    technicianNote:
      typeof payload.technicianNote === 'string'
        ? payload.technicianNote.trim().slice(0, 300)
        : current.technicianNote,
    estimatedCost:
      typeof payload.estimatedCost === 'string'
        ? payload.estimatedCost.trim().slice(0, 40)
        : current.estimatedCost,
    updatedAt: now,
    statusHistory: nextHistory,
  };

  list[idx] = updated;
  writeLocal(LS_REPAIRS, list);
  emitLocalSync({ type: 'repair:updated', repair: updated });
  return updated;
}

export async function apiDeleteRepair(
  id: string,
  authHeaders: Record<string, string>,
): Promise<void> {
  if (await isExpressServerAvailable()) {
    try {
      const res = await fetch(`/api/repairs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await safeJson<{ ok?: boolean; error?: string }>(res);
      if (data) {
        if (!res.ok) throw new Error(data.error || 'ไม่สามารถลบรายการได้');
        return;
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes('JSON')) {
        throw err;
      }
    }
  }

  const list = readLocal<RepairTicket[]>(LS_REPAIRS, []);
  writeLocal(
    LS_REPAIRS,
    list.filter((r) => r.id !== id),
  );
  emitLocalSync({ type: 'repair:deleted', id });
}

export async function apiAdminLogin(passcode: string): Promise<string> {
  if (await isExpressServerAvailable()) {
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = await safeJson<{ ok?: boolean; token?: string; error?: string }>(res);
    if (data) {
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'รหัสผ่าน Admin ไม่ถูกต้อง');
      }
      return data.token;
    }
  }

  if (passcode.trim() !== ADMIN_FALLBACK_CODE) {
    throw new Error('รหัสผ่าน Admin ไม่ถูกต้อง');
  }
  return `local_admin_${Date.now()}`;
}

export async function apiTechnicianLogin(params: {
  branchCode: string;
  username?: string;
  passcode: string;
}): Promise<{ token: string; shop: PublicShopInfo }> {
  if (await isExpressServerAvailable()) {
    const res = await fetch('/api/auth/technician', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await safeJson<{
      ok?: boolean;
      token?: string;
      shop?: PublicShopInfo;
      error?: string;
    }>(res);
    if (data) {
      if (!res.ok || !data.token || !data.shop) {
        throw new Error(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
      return { token: data.token, shop: data.shop };
    }
  }

  const code = params.branchCode || 'main';
  const settingsMap = getLocalSettingsMap();

  if (code === 'main') {
    const main = settingsMap.main || DEFAULT_MAIN_TECH;
    if (params.passcode.trim() !== main.passcode) {
      throw new Error('รหัสผ่านช่างไม่ถูกต้อง');
    }
    return { token: `local_tech_main_${Date.now()}`, shop: getLocalShopInfo('main') };
  }

  const branches = readLocal<BranchLink[]>(LS_BRANCHES, []);
  const branch = branches.find((b) => b.code === code);
  if (!branch) throw new Error('ไม่พบข้อมูลสาขานี้');
  if (!branch.isActive || Date.now() > Date.parse(branch.expiresAt)) {
    throw new Error('ลิงก์สาขานี้หมดอายุแล้ว กรุณาติดต่อ Admin');
  }
  const expectedPass = settingsMap[code]?.passcode || branch.password;
  if (
    !params.username ||
    params.username.trim() !== branch.username ||
    params.passcode.trim() !== expectedPass
  ) {
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านสาขาไม่ถูกต้อง');
  }

  return { token: `local_tech_${code}_${Date.now()}`, shop: getLocalShopInfo(code) };
}

export async function apiUpdateTechSettings(
  payload: TechnicianSettingsPayload,
  authHeaders: Record<string, string>,
): Promise<PublicShopInfo> {
  if (await isExpressServerAvailable()) {
    const res = await fetch('/api/technician/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
    });
    const data = await safeJson<{ shop?: PublicShopInfo; error?: string }>(res);
    if (data) {
      if (!res.ok || !data.shop) {
        throw new Error(data.error || 'บันทึกการตั้งค่าไม่สำเร็จ');
      }
      return data.shop;
    }
  }

  const map = getLocalSettingsMap();
  const code = payload.branchCode || 'main';
  const prev = map[code] || {
    branchCode: code,
    technicianName: payload.technicianName,
    technicianPhone: payload.technicianPhone,
    passcode: DEFAULT_MAIN_TECH.passcode,
  };
  const nextPass =
    payload.newPasscode && payload.newPasscode.trim().length >= 4
      ? payload.newPasscode.trim()
      : prev.passcode;

  map[code] = {
    branchCode: code,
    technicianName: payload.technicianName.trim().slice(0, 60),
    technicianPhone: payload.technicianPhone.trim().slice(0, 30),
    passcode: nextPass,
  };
  writeLocal(LS_SETTINGS, map);

  if (code !== 'main') {
    const branches = readLocal<BranchLink[]>(LS_BRANCHES, []);
    const idx = branches.findIndex((b) => b.code === code);
    if (idx !== -1) {
      branches[idx] = {
        ...branches[idx],
        technicianName: map[code].technicianName,
        technicianPhone: map[code].technicianPhone,
        password: nextPass,
        updatedAt: new Date().toISOString(),
      };
      writeLocal(LS_BRANCHES, branches);
    }
  }

  emitLocalSync({
    type: 'shop:updated',
    branchCode: code,
    technicianName: map[code].technicianName,
    technicianPhone: map[code].technicianPhone,
  });

  return getLocalShopInfo(code);
}

export async function apiListBranches(adminToken: string): Promise<BranchLink[]> {
  if (await isExpressServerAvailable()) {
    const res = await fetch('/api/admin/branches', {
      headers: { 'x-admin-token': adminToken },
    });
    const data = await safeJson<{ branches?: BranchLink[] }>(res);
    if (res.ok && Array.isArray(data?.branches)) return data.branches;
  }
  return readLocal<BranchLink[]>(LS_BRANCHES, []);
}

export async function apiCreateBranch(
  payload: CreateBranchPayload,
  adminToken: string,
): Promise<BranchLink> {
  if (await isExpressServerAvailable()) {
    const res = await fetch('/api/admin/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify(payload),
    });
    const data = await safeJson<{ branch?: BranchLink; error?: string }>(res);
    if (data) {
      if (!res.ok || !data.branch) {
        throw new Error(data.error || 'ไม่สามารถสร้างลิงก์สาขาได้');
      }
      return data.branch;
    }
  }

  const branches = readLocal<BranchLink[]>(LS_BRANCHES, []);
  let code = '';
  do {
    code = `BR-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (branches.some((b) => b.code === code));

  const now = new Date().toISOString();
  const branch: BranchLink = {
    id: `br_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    code,
    branchName: payload.branchName.trim(),
    username: payload.username.trim(),
    password: payload.password.trim(),
    technicianName: payload.technicianName?.trim() || payload.branchName.trim(),
    technicianPhone: payload.technicianPhone?.trim() || '080-000-0000',
    expiresAt: new Date(payload.expiresAt).toISOString(),
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };

  writeLocal(LS_BRANCHES, [branch, ...branches]);
  const map = getLocalSettingsMap();
  map[code] = {
    branchCode: code,
    technicianName: branch.technicianName,
    technicianPhone: branch.technicianPhone,
    passcode: branch.password,
  };
  writeLocal(LS_SETTINGS, map);
  emitLocalSync({ type: 'branch:updated', branch });
  return branch;
}

export async function apiUpdateBranch(
  id: string,
  payload: UpdateBranchPayload,
  adminToken: string,
): Promise<BranchLink> {
  if (await isExpressServerAvailable()) {
    const res = await fetch(`/api/admin/branches/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify(payload),
    });
    const data = await safeJson<{ branch?: BranchLink; error?: string }>(res);
    if (data) {
      if (!res.ok || !data.branch) {
        throw new Error(data.error || 'อัปเดตสาขาไม่สำเร็จ');
      }
      return data.branch;
    }
  }

  const branches = readLocal<BranchLink[]>(LS_BRANCHES, []);
  const idx = branches.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error('ไม่พบข้อมูลสาขานี้');
  const current = branches[idx];
  const updated: BranchLink = {
    ...current,
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  branches[idx] = updated;
  writeLocal(LS_BRANCHES, branches);
  emitLocalSync({ type: 'branch:updated', branch: updated });
  return updated;
}

export async function apiDeleteBranch(id: string, adminToken: string): Promise<void> {
  if (await isExpressServerAvailable()) {
    const res = await fetch(`/api/admin/branches/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken },
    });
    if (res.ok) return;
  }

  const branches = readLocal<BranchLink[]>(LS_BRANCHES, []);
  writeLocal(
    LS_BRANCHES,
    branches.filter((b) => b.id !== id),
  );
  emitLocalSync({ type: 'branch:deleted', id });
}
