import { Download, ExternalLink, FileSpreadsheet, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { REPAIR_STATUS_STEPS, type RepairStatus, type RepairTicket } from '../types/repair';
import { exportRepairsToExcelCsv, formatThaiDateTime } from '../utils/notifications';

interface ExcelHistoryTableProps {
  repairs: RepairTicket[];
  onChangeStatus: (id: string, status: RepairStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EXCEL_COLUMNS = [
  { letter: 'A', title: 'รหัสงาน', width: 'w-24' },
  { letter: 'B', title: 'วัน-เวลา', width: 'w-28' },
  { letter: 'C', title: 'ชื่อลูกค้า', width: 'w-28' },
  { letter: 'D', title: 'เบอร์โทร', width: 'w-28' },
  { letter: 'E', title: 'ชนิดรถ', width: 'w-28' },
  { letter: 'F', title: 'อาการเสีย', width: 'w-44' },
  { letter: 'G', title: 'ปักหมุด', width: 'w-24' },
  { letter: 'H', title: 'สถานะงาน', width: 'w-32' },
  { letter: 'I', title: 'ค่าซ่อม', width: 'w-20' },
  { letter: 'J', title: 'จัดการ', width: 'w-14' },
];

export function ExcelHistoryTable({
  repairs,
  onChangeStatus,
  onDelete,
}: ExcelHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RepairStatus>('all');
  const [compactMobile, setCompactMobile] = useState(true);

  const filteredRepairs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return repairs.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.vehicleLabel.toLowerCase().includes(q) ||
        r.issue.toLowerCase().includes(q) ||
        r.location.addressNote.toLowerCase().includes(q)
      );
    });
  }, [repairs, searchQuery, statusFilter]);

  return (
    <section className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
      {/* Excel Ribbon Header */}
      <div className="bg-[#15803D] text-white px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className="w-5 h-5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight truncate">
              ตารางบันทึกประวัติลูกค้าแจ้งซ่อม (Excel)
            </h3>
            <p className="text-[11px] text-emerald-100 tabular-nums">
              ทั้งหมด {filteredRepairs.length} รายการ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCompactMobile((v) => !v)}
            className="sm:hidden px-2.5 py-1.5 min-h-[36px] rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-medium whitespace-nowrap transition-colors"
          >
            {compactMobile ? 'ตารางกว้าง' : 'พอดีจอมือถือ'}
          </button>
          <button
            type="button"
            onClick={() => exportRepairsToExcelCsv(filteredRepairs)}
            disabled={filteredRepairs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-white text-[#15803D] hover:bg-emerald-50 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            ดาวน์โหลด Excel
          </button>
        </div>
      </div>

      {/* Formula / Filter Bar */}
      <div className="bg-slate-50 border-b border-slate-300 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, อาการ, รหัสงาน..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#15803D]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | RepairStatus)}
          aria-label="กรองตามสถานะงาน"
          className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15803D]"
        >
          <option value="all">ทุกสถานะ ({repairs.length})</option>
          {REPAIR_STATUS_STEPS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile Compact Fit View vs Full Excel Grid */}
      {compactMobile && (
        <div className="sm:hidden overflow-x-auto">
          <table className="w-full border-collapse text-[11px] leading-tight">
            <thead>
              <tr className="bg-slate-200 text-slate-600 font-mono-tabular text-[10px]">
                <th className="border border-slate-300 px-1 py-1 w-6 text-center bg-slate-200">#</th>
                <th className="border border-slate-300 px-1.5 py-1 text-center">A · ลูกค้า/โทร</th>
                <th className="border border-slate-300 px-1.5 py-1 text-center">B · รถ/อาการ</th>
                <th className="border border-slate-300 px-1.5 py-1 text-center">C · สถานะ/หมุด</th>
              </tr>
              <tr className="bg-emerald-50 text-slate-800 font-semibold">
                <th className="border border-slate-300 px-1 py-1.5 text-center bg-slate-100" />
                <th className="border border-slate-300 px-1.5 py-1.5 text-left">ชื่อ · เบอร์ · เวลา</th>
                <th className="border border-slate-300 px-1.5 py-1.5 text-left">ชนิดรถ · อาการ</th>
                <th className="border border-slate-300 px-1.5 py-1.5 text-left">สถานะ · แผนที่</th>
              </tr>
            </thead>
            <tbody>
              {filteredRepairs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-300 py-8 text-center text-slate-500">
                    ยังไม่มีข้อมูลรายการแจ้งซ่อม
                  </td>
                </tr>
              ) : (
                filteredRepairs.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-emerald-50/40 align-top">
                    <td className="border border-slate-300 bg-slate-100 text-slate-500 font-mono-tabular text-center py-2 px-1">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-300 p-1.5 min-w-[106px]">
                      <div className="font-semibold text-slate-900 truncate max-w-[104px]">
                        {item.customerName}
                      </div>
                      <a
                        href={`tel:${item.phone}`}
                        className="font-mono-tabular text-sky-700 underline block mt-0.5"
                      >
                        {item.phone}
                      </a>
                      <div className="font-mono-tabular text-[10px] text-slate-400 mt-0.5">
                        {formatThaiDateTime(item.createdAt)}
                      </div>
                    </td>
                    <td className="border border-slate-300 p-1.5 min-w-[110px]">
                      <div className="font-medium text-slate-800">{item.vehicleLabel}</div>
                      <div className="text-slate-600 line-clamp-2 mt-0.5">{item.issue}</div>
                      {item.estimatedCost && (
                        <div className="font-mono-tabular text-emerald-700 font-medium mt-0.5">
                          {item.estimatedCost} ฿
                        </div>
                      )}
                    </td>
                    <td className="border border-slate-300 p-1.5 min-w-[108px]">
                      <select
                        value={item.status}
                        onChange={(e) => void onChangeStatus(item.id, e.target.value as RepairStatus)}
                        aria-label={`เปลี่ยนสถานะ ${item.customerName}`}
                        className="w-full h-7 px-1 rounded border border-slate-300 bg-white text-[10px] font-medium text-slate-800"
                      >
                        {REPAIR_STATUS_STEPS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.shortLabel}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between mt-1.5 gap-1">
                        <a
                          href={`https://maps.google.com/?q=${item.location.lat},${item.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sky-700 underline inline-flex items-center gap-0.5"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          หมุด
                        </a>
                        <button
                          type="button"
                          onClick={() => void onDelete(item.id)}
                          aria-label={`ลบรายการ ${item.code}`}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Desktop & Wide Excel Grid */}
      <div className={`${compactMobile ? 'hidden sm:block' : 'block'} overflow-x-auto`}>
        <table className="w-full min-w-[920px] border-collapse text-xs">
          <thead>
            {/* Excel Column Letters A-J */}
            <tr className="bg-slate-200/90 text-slate-600 font-mono-tabular text-[11px]">
              <th className="border border-slate-300 w-10 py-1 text-center bg-slate-200 sticky left-0 z-10" />
              {EXCEL_COLUMNS.map((col) => (
                <th
                  key={col.letter}
                  className={`border border-slate-300 py-1 px-2 text-center font-semibold ${col.width}`}
                >
                  {col.letter}
                </th>
              ))}
            </tr>
            {/* Field Header Row */}
            <tr className="bg-emerald-50/90 text-slate-900 font-semibold">
              <th className="border border-slate-300 w-10 py-2 text-center bg-slate-100 font-mono-tabular text-slate-500 sticky left-0 z-10">
                #
              </th>
              {EXCEL_COLUMNS.map((col) => (
                <th
                  key={col.title}
                  className="border border-slate-300 py-2 px-2.5 text-left whitespace-nowrap"
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRepairs.length === 0 ? (
              <tr>
                <td
                  colSpan={EXCEL_COLUMNS.length + 1}
                  className="border border-slate-300 py-10 text-center text-slate-500"
                >
                  ยังไม่มีประวัติการแจ้งซ่อมในตาราง Excel
                </td>
              </tr>
            ) : (
              filteredRepairs.map((item, idx) => (
                <tr key={item.id} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="border border-slate-300 bg-slate-100 text-slate-500 font-mono-tabular text-center py-2 px-1 sticky left-0 z-10">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-2 font-mono-tabular font-medium text-slate-800 whitespace-nowrap">
                    {item.code}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-2 font-mono-tabular text-slate-600 whitespace-nowrap">
                    {formatThaiDateTime(item.createdAt)}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-2 font-semibold text-slate-900 whitespace-nowrap">
                    {item.customerName}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-2 font-mono-tabular whitespace-nowrap">
                    <a href={`tel:${item.phone}`} className="text-sky-700 hover:underline">
                      {item.phone}
                    </a>
                  </td>
                  <td className="border border-slate-300 px-2.5 py-2 text-slate-800 whitespace-nowrap">
                    {item.vehicleLabel}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-2 text-slate-700 max-w-[220px]">
                    <div className="line-clamp-2" title={item.issue}>
                      {item.issue}
                    </div>
                  </td>
                  <td className="border border-slate-300 px-2.5 py-2 whitespace-nowrap">
                    <a
                      href={`https://maps.google.com/?q=${item.location.lat},${item.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sky-700 hover:underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      เปิดหมุด
                    </a>
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5">
                    <select
                      value={item.status}
                      onChange={(e) => void onChangeStatus(item.id, e.target.value as RepairStatus)}
                      aria-label={`สถานะของ ${item.customerName}`}
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#15803D]"
                    >
                      {REPAIR_STATUS_STEPS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-slate-300 px-2.5 py-2 font-mono-tabular text-right text-slate-800 whitespace-nowrap">
                    {item.estimatedCost ? `${item.estimatedCost}` : '-'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => void onDelete(item.id)}
                      aria-label={`ลบรายการ ${item.code}`}
                      className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
