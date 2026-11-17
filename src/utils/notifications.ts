import { REPAIR_STATUS_STEPS, type BranchLink, type RepairTicket } from '../types/repair';

export function playAlertChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.3);
    });
  } catch {
    // AudioContext might be blocked until first user gesture
  }
}

export function getChromeNotificationState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestChromeNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  return await Notification.requestPermission();
}

export function triggerChromeNotification(title: string, body: string, tag?: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  try {
    const notification = new Notification(title, {
      body,
      tag: tag || `ev-repair-${Date.now()}`,
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function formatThaiDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

export function exportRepairsToExcelCsv(repairs: RepairTicket[]): void {
  const headers = [
    'ลำดับ',
    'รหัสงาน',
    'สาขา',
    'วัน-เวลาแจ้งซ่อม',
    'ชื่อลูกค้า',
    'เบอร์โทร',
    'ชนิดรถไฟฟ้า',
    'อาการคร่าวๆ',
    'พิกัดปักหมุด (Lat, Lng)',
    'จุดสังเกต/สถานที่',
    'สถานะงาน',
    'บันทึกช่าง',
    'ค่าซ่อม (บาท)',
  ];

  const rows = repairs.map((r, index) => {
    const statusLabel = REPAIR_STATUS_STEPS.find((s) => s.id === r.status)?.label ?? r.status;
    return [
      String(index + 1),
      r.code,
      r.branchName || 'สาขาหลัก',
      formatThaiDateTime(r.createdAt),
      r.customerName,
      `'${r.phone}`,
      r.vehicleLabel,
      r.issue,
      `${r.location.lat}, ${r.location.lng}`,
      r.location.addressNote || '-',
      statusLabel,
      r.technicianNote || '-',
      r.estimatedCost || '-',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `ev-repair-history-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportBranchesToExcelCsv(branches: BranchLink[], origin: string): void {
  const headers = [
    'ลำดับ',
    'รหัสสาขา',
    'ชื่อสาขา',
    'User เข้าระบบ',
    'รหัสผ่าน',
    'ชื่อช่างประจำสาขา',
    'เบอร์โทรช่าง',
    'ลิงก์สาขา',
    'วันหมดอายุ',
    'สถานะ',
  ];

  const rows = branches.map((b, index) => {
    const expired = !b.isActive || Date.now() > Date.parse(b.expiresAt);
    return [
      String(index + 1),
      b.code,
      b.branchName,
      b.username,
      b.password,
      b.technicianName,
      `'${b.technicianPhone}`,
      `${origin}/?branch=${b.code}`,
      formatThaiDateTime(b.expiresAt),
      expired ? 'หมดอายุ / ปิดใช้งาน' : 'ใช้งานได้',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `ev-care-branches-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
