import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  FileCode2,
  FolderTree,
  Loader2,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isExpressServerAvailable } from '../utils/apiClient';

interface SourceFileEntry {
  path: string;
  size: number;
}

interface SourceInventoryResponse {
  version: string;
  totalFiles: number;
  totalBytes: number;
  files: SourceFileEntry[];
}

interface SourceExportPanelProps {
  adminToken: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SourceExportPanel({ adminToken }: SourceExportPanelProps) {
  const [inventory, setInventory] = useState<SourceInventoryResponse | null>(null);
  const [serverReady, setServerReady] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const hasExpress = await isExpressServerAvailable();
      setServerReady(hasExpress);
      if (!hasExpress) {
        return;
      }
      const res = await fetch('/api/admin/source-files', {
        headers: { 'x-admin-token': adminToken },
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const data = (await res.json()) as SourceInventoryResponse;
      setInventory(data);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  const filteredFiles = useMemo(() => {
    if (!inventory) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return inventory.files;
    return inventory.files.filter((f) => f.path.toLowerCase().includes(q));
  }, [inventory, searchQuery]);

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/admin/source-zip', {
        headers: { 'x-admin-token': adminToken },
      });
      if (!res.ok) {
        setStatusMessage('ไม่สามารถดาวน์โหลดไฟล์ ZIP ได้');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ev-care-v${inventory?.version || '1.4.10'}-source.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMessage('ดาวน์โหลดแพ็กเกจ Source Code (.zip) เรียบร้อยแล้ว');
    } catch {
      setStatusMessage('เกิดข้อผิดพลาดระหว่างสร้างไฟล์ ZIP');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadSingleFile = async (filePath: string) => {
    setDownloadingFile(filePath);
    try {
      const res = await fetch(
        `/api/admin/source-file?path=${encodeURIComponent(filePath)}`,
        {
          headers: { 'x-admin-token': adminToken },
        },
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filePath.split('/').pop() || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingFile(null);
    }
  };

  if (!loading && !serverReady) {
    return (
      <section className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 sm:p-6 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              การดาวน์โหลด Source Code (.zip) ใช้ได้เฉพาะตอนรัน Node Server
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ขณะนี้แอปกำลังรันบนโหมด Static Hosting (เช่น Vercel) จึงไม่มีไฟล์ต้นฉบับอยู่บนเซิร์ฟเวอร์
              หากต้องการโหลดไฟล์ `.zip` ให้เปิดหน้า Admin จากเซิร์ฟเวอร์ AI Studio หรือรันด้วยคำสั่ง `npm run start`
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-sky-600" />
            ดาวน์โหลด Source Code โปรแกรม (เฉพาะ Admin)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            รวมไฟล์โปรเจกต์ครบทุกโฟลเดอร์สำหรับอัปโหลดขึ้น GitHub (คัดแยก node_modules, dist และ data ออกให้เรียบร้อยแล้ว)
          </p>
        </div>

        <button
          type="button"
          disabled={loading || downloadingZip}
          onClick={() => void handleDownloadZip()}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 shadow-sm shrink-0 disabled:opacity-60"
        >
          {downloadingZip ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {downloadingZip ? 'กำลังบีบอัดไฟล์...' : 'ดาวน์โหลด Source Code (.zip)'}
        </button>
      </div>

      {inventory && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <span className="text-xs text-slate-500 block">เวอร์ชันโปรแกรม</span>
            <span className="text-lg font-bold text-slate-900 font-mono-tabular">
              v{inventory.version}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <span className="text-xs text-slate-500 block">จำนวนไฟล์ทั้งหมด</span>
            <span className="text-lg font-bold text-slate-900 font-mono-tabular">
              {inventory.totalFiles} ไฟล์
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <span className="text-xs text-slate-500 block">ขนาดรวมก่อนบีบอัด</span>
            <span className="text-lg font-bold text-slate-900 font-mono-tabular">
              {formatBytes(inventory.totalBytes)}
            </span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ตรวจสอบความพร้อมอัปโหลด GitHub ผ่านมือถือเรียบร้อย
        </p>
        <p className="text-emerald-800">
          แพ็กเกจนี้ประกอบด้วยโค้ดและรูปภาพครบทุกโฟลเดอร์ ไม่มีไฟล์ .html ส่วนเกิน (มีเฉพาะ index.html หลัก) และไม่รวมโฟลเดอร์ node_modules/ หรือ data/
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-xl bg-slate-900 text-white text-xs font-medium px-4 py-2.5">
          {statusMessage}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <FolderTree className="w-4 h-4 text-slate-500" />
            รายชื่อไฟล์และโฟลเดอร์ในแพ็กเกจ ({filteredFiles.length})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อไฟล์..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-500">
              กำลังตรวจสอบไฟล์ทั้งหมดในโปรเจกต์...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">ไม่พบไฟล์ที่ค้นหา</div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 sticky top-0">
                <tr>
                  <th className="py-2 px-2.5 sm:px-3 text-left font-semibold border-b border-slate-200">
                    เส้นทางไฟล์ (Path)
                  </th>
                  <th className="py-2 px-2 sm:px-3 text-right font-semibold border-b border-slate-200 w-16 sm:w-24">
                    ขนาด
                  </th>
                  <th className="py-2 px-2 sm:px-3 text-center font-semibold border-b border-slate-200 w-16 sm:w-24">
                    โหลดแยก
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map((file) => (
                  <tr key={file.path} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono-tabular text-slate-800 break-all">
                      <span className="inline-flex items-center gap-1.5">
                        <FileCode2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {file.path}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-slate-500 whitespace-nowrap">
                      {formatBytes(file.size)}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        type="button"
                        disabled={downloadingFile === file.path}
                        onClick={() => void handleDownloadSingleFile(file.path)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 text-sky-700 font-medium inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <Download className="w-3 h-3" />
                        โหลด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
