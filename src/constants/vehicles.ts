import type { VehicleTypeId } from '../types/repair';

export interface VehicleOption {
  id: VehicleTypeId;
  label: string;
  shortLabel: string;
  imageUrl: string;
  accentColor: string;
}

export const VEHICLE_OPTIONS: VehicleOption[] = [
  {
    id: 'ebike',
    label: 'จักรยานไฟฟ้า',
    shortLabel: 'จักรยานไฟฟ้า',
    imageUrl: '/src/assets/images/ev_bicycle_3d_1794886751383.jpg',
    accentColor: '#16a34a',
  },
  {
    id: 'etrike',
    label: 'สามล้อไฟฟ้า',
    shortLabel: 'สามล้อไฟฟ้า',
    imageUrl: '/src/assets/images/ev_tricycle_3d_1794886751306.jpg',
    accentColor: '#dc2626',
  },
  {
    id: 'emoto',
    label: 'มอไซไฟฟ้า',
    shortLabel: 'มอไซไฟฟ้า',
    imageUrl: '/src/assets/images/ev_motorcycle_3d_1794886751564.jpg',
    accentColor: '#0284c7',
  },
  {
    id: 'eother',
    label: 'รถไฟฟ้าอื่นๆ',
    shortLabel: 'รถไฟฟ้าอื่นๆ',
    imageUrl: '/src/assets/images/ev_other_3d_1794886751220.jpg',
    accentColor: '#ca8a04',
  },
];

export const QUICK_ISSUES: string[] = [
  'แบตไม่เก็บไฟ / ชาร์จไม่เข้า',
  'เปิดไม่ติด / ไฟหน้าปัดดับ',
  'บิดแล้วไม่วิ่ง / มอเตอร์สะดุด',
  'ยางรั่ว / เบรกมีเสียงดัง',
  'สายไฟขาด / ปลั๊กหลวม',
];
