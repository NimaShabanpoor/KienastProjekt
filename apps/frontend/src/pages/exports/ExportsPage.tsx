// Export-Seite (nur Abteilungsleitung)

import { Download, FileText, BarChart2, Users } from 'lucide-react';
import { apiClient } from '../../api/client';

export default function ExportsPage() {
  const handleExport = async (endpoint: string, filename: string): Promise<void> => {
    try {
      const response = await apiClient.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Export fehlgeschlagen. Bitte versuche es erneut.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Download className="w-6 h-6 text-brand-red" />
        <h1 className="text-2xl font-bold text-neutral-900">Exporte & Berichte</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Absenzen CSV */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-50 rounded-lg"><Users className="w-4 h-4 text-orange-600" /></div>
            <h3 className="font-semibold text-neutral-900">Absenzen (CSV)</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Alle Absenzen als CSV-Datei exportieren</p>
          <button
            onClick={() => void handleExport('/api/v1/exports/absences/csv', 'absenzen.csv')}
            className="flex items-center gap-2 text-sm bg-brand-red text-white px-3 py-2 rounded-lg hover:bg-brand-red-dark"
          >
            <Download className="w-4 h-4" /> CSV exportieren
          </button>
        </div>

        {/* Noten Excel */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg"><BarChart2 className="w-4 h-4 text-green-600" /></div>
            <h3 className="font-semibold text-neutral-900">Noten (Excel)</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Notenliste als Excel-Datei exportieren</p>
          <button
            onClick={() => void handleExport('/api/v1/exports/grades/excel', 'noten.xlsx')}
            className="flex items-center gap-2 text-sm bg-brand-red text-white px-3 py-2 rounded-lg hover:bg-brand-red-dark"
          >
            <Download className="w-4 h-4" /> Excel exportieren
          </button>
        </div>

        {/* Promotionsbericht */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><FileText className="w-4 h-4 text-blue-600" /></div>
            <h3 className="font-semibold text-neutral-900">Promotionsbericht</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Bestehensquote und Promotionsstatus</p>
          <button
            onClick={() => void handleExport('/api/v1/exports/statistics/promotion', 'promotion.pdf')}
            className="flex items-center gap-2 text-sm bg-brand-red text-white px-3 py-2 rounded-lg hover:bg-brand-red-dark"
          >
            <Download className="w-4 h-4" /> Bericht exportieren
          </button>
        </div>

        {/* Audit Log */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-50 rounded-lg"><FileText className="w-4 h-4 text-purple-600" /></div>
            <h3 className="font-semibold text-neutral-900">Audit-Log</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Alle kritischen Aktionen als CSV (nDSG)</p>
          <button
            onClick={() => void handleExport('/api/v1/exports/audit-log', 'audit-log.csv')}
            className="flex items-center gap-2 text-sm bg-brand-red text-white px-3 py-2 rounded-lg hover:bg-brand-red-dark"
          >
            <Download className="w-4 h-4" /> Log exportieren
          </button>
        </div>
      </div>
    </div>
  );
}
