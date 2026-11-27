export type VehicleTypeId = 'ebike' | 'etrike' | 'emoto' | 'eother';

export type RepairStatus = 'pending' | 'accepted' | 'inspecting' | 'repairing' | 'completed';

export interface RepairLocation {
  lat: number;
  lng: number;
  addressNote: string;
  source: 'gps' | 'manual';
}

export interface StatusHistoryEntry {
  status: RepairStatus;
  timestamp: string;
  note?: string;
}

export interface RepairTicket {
  id: string;
  code: string;
  branchCode: string;
  branchName: string;
  vehicleType: VehicleTypeId;
  vehicleLabel: string;
  customerName: string;
  phone: string;
  issue: string;
  location: RepairLocation;
  status: RepairStatus;
  technicianNote: string;
  estimatedCost: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusHistoryEntry[];
}

export interface CreateRepairPayload {
  branchCode?: string;
  vehicleType: VehicleTypeId;
  vehicleLabel: string;
  customerName: string;
  phone: string;
  issue: string;
  location: RepairLocation;
}

export interface UpdateRepairPayload {
  status?: RepairStatus;
  technicianNote?: string;
  estimatedCost?: string;
}

export interface PublicShopInfo {
  branchCode: string;
  branchName: string;
  technicianName: string;
  technicianPhone: string;
  isExpired: boolean;
  isNotFound: boolean;
  expiresAt: string | null;
}

export interface TechnicianSettingsPayload {
  branchCode: string;
  technicianName: string;
  technicianPhone: string;
  newPasscode?: string;
  currentPasscode?: string;
}

export interface BranchLink {
  id: string;
  code: string;
  branchName: string;
  username: string;
  password: string;
  technicianName: string;
  technicianPhone: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface CreateBranchPayload {
  branchName: string;
  username: string;
  password: string;
  technicianName?: string;
  technicianPhone?: string;
  expiresAt: string;
}

export interface UpdateBranchPayload {
  branchName?: string;
  username?: string;
  password?: string;
  technicianName?: string;
  technicianPhone?: string;
  expiresAt?: string;
  isActive?: boolean;
}

export type ServerWsEvent =
  | { type: 'init'; repairs: RepairTicket[] }
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

export interface StatusStepMeta {
  id: RepairStatus;
  label: string;
  shortLabel: string;
  description: string;
}

export const REPAIR_STATUS_STEPS: StatusStepMeta[] = [
  {
    id: 'pending',
    label: 'รอช่างรับงาน',
    shortLabel: 'รอรับงาน',
    description: 'ระบบส่งข้อมูลถึงศูนย์ซ่อมแล้ว กำลังรอช่างยืนยันรับงาน',
  },
  {
    id: 'accepted',
    label: 'ช่างรับงานแล้ว',
    shortLabel: 'รับงานแล้ว',
    description: 'ช่างได้รับแจ้งซ่อมเรียบร้อย เตรียมตรวจสอบรายละเอียด',
  },
  {
    id: 'inspecting',
    label: 'กำลังเดินทาง / ตรวจเช็ค',
    shortLabel: 'ตรวจเช็ค',
    description: 'ช่างกำลังเดินทางไปจุดปักหมุดหรือตรวจเช็คอาการรถเบื้องต้น',
  },
  {
    id: 'repairing',
    label: 'กำลังดำเนินการซ่อม',
    shortLabel: 'กำลังซ่อม',
    description: 'ช่างกำลังแก้ไขและเปลี่ยนอะไหล่ระบบไฟฟ้า',
  },
  {
    id: 'completed',
    label: 'ซ่อมเสร็จเรียบร้อย',
    shortLabel: 'เสร็จสิ้น',
    description: 'การซ่อมเสร็จสมบูรณ์ พร้อมทดสอบใช้งานรถไฟฟ้า',
  },
];

export const VEHICLE_LABELS: Record<VehicleTypeId, string> = {
  ebike: 'จักรยานไฟฟ้า',
  etrike: 'สามล้อไฟฟ้า',
  emoto: 'มอไซไฟฟ้า',
  eother: 'รถไฟฟ้าอื่นๆ',
};
