// Export- & Statistik-Seite (Leiter)

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, BarChart2, Users } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { Class } from '@schuladmin/shared';

interface AbsenceStats {
  totalAbsences: number;
  entschuldigt: number;
  unentschuldigt: number;
  quote: number;
}

export default function ExportsPage() {
  const [gradesClassId, setGradesClassId] = useState('');
  const [promoClassId, setPromoClassId] = useState('');
  const [schoolYear, setSchoolYear] = useState('2024/25');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Class[] }>('/api/v1/classes');
      return data.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['absence-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AbsenceStats }>('/api/v1/absences/stats');
      return data.data;
    },
  });

  const handleExport = async (endpoint: string, filename: string): Promise<void> => {
    try {
      const response = await apiClient.get<ArrayBuffer>(endpoint, { responseType: 'arraybuffer' });
      const lower = filename.toLowerCase();
      const bytes = new Uint8Array(response.data);

      // Sicherstellen, dass wirklich eine Excel-Datei ankommt (nicht CSV/JSON-Fehler)
      if (lower.endsWith('.xlsx')) {
        const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // PK.. = ZIP/XLSX
        if (!isZip) {
          const text = new TextDecoder().decode(bytes.slice(0, 200));
          alert(`Excel-Export fehlgeschlagen: ${text || 'Unerwartete Antwort vom Server.'}`);
          return;
        }
      }

      const mime = lower.endsWith('.pdf')
        ? 'application/pdf'
        : lower.endsWith('.xlsx')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8';
      const url = window.URL.createObjectURL(new Blob([bytes], { type: mime }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Export fehlgeschlagen. Bitte versuche es erneut.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Download className="w-6 h-6 text-brand-red" />
        <h1 className="text-2xl font-bold text-neutral-900">Statistiken & Exporte</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-500">Total Absenzen</p>
            <p className="text-3xl font-bold text-neutral-900 mt-1">{stats.totalAbsences}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-500">Entschuldigt</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.entschuldigt}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-500">Unentschuldigt</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{stats.unentschuldigt}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-500">Unentschuldigt-Quote</p>
            <p className="text-3xl font-bold text-neutral-900 mt-1">{stats.quote}%</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-50 rounded-lg"><Users className="w-4 h-4 text-orange-600" /></div>
            <h3 className="font-semibold text-neutral-900">Absenzen (Excel)</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Alle Absenzen übersichtlich mit Name, Klasse und Status</p>
          <button
            onClick={() => void handleExport('/api/v1/exports/absences/excel', 'absenzen.xlsx')}
            className="flex items-center gap-2 text-sm bg-brand-red text-white px-3 py-2 rounded-lg hover:bg-brand-red-dark"
          >
            <Download className="w-4 h-4" /> Excel exportieren
          </button>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg"><BarChart2 className="w-4 h-4 text-green-600" /></div>
            <h3 className="font-semibold text-neutral-900">Noten (Excel)</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Alle Noten einer Klasse – öffnet korrekt in Excel mit Spalten</p>
          <select
            value={gradesClassId}
            onChange={(e) => setGradesClassId(e.target.value)}
            className="w-full mb-3 px-2 py-1.5 border rounded-lg text-sm"
          >
            <option value="">Klasse wählen</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            disabled={!gradesClassId}
            onClick={() => {
              const className = classes?.find((c) => c.id === gradesClassId)?.name ?? 'klasse';
              void handleExport(
                `/api/v1/exports/grades/excel?classId=${gradesClassId}`,
                `noten-${className}.xlsx`
              );
            }}
            className="flex items-center gap-2 text-sm bg-brand-red text-white px-3 py-2 rounded-lg hover:bg-brand-red-dark disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Excel exportieren
          </button>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><FileText className="w-4 h-4 text-blue-600" /></div>
            <h3 className="font-semibold text-neutral-900">Promotionsbericht</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Bestehensquote pro Klasse</p>
          <div className="flex gap-2 mb-3">
            <select value={promoClassId} onChange={(e) => setPromoClassId(e.target.value)} className="flex-1 px-2 py-1.5 border rounded-lg text-sm">
              <option value="">Klasse wählen</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} className="w-28 px-2 py-1.5 border rounded-lg text-sm" />
          </div>
          <button
            disabled={!promoClassId}
            onClick={() => void handleExport(`/api/v1/exports/statistics/promotion?classId=${promoClassId}&schoolYear=${encodeURIComponent(schoolYear)}`, 'promotion.csv')}
            className="flex items-center gap-2 text-sm bg-brand-red text-white px-3 py-2 rounded-lg hover:bg-brand-red-dark disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Bericht exportieren
          </button>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-50 rounded-lg"><FileText className="w-4 h-4 text-purple-600" /></div>
            <h3 className="font-semibold text-neutral-900">Audit-Log</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Kritische Aktionen als CSV (nDSG)</p>
          <button onClick={() => void handleExport('/api/v1/exports/audit-log', 'audit-log.csv')} className="flex items-center gap-2 text-sm bg-brand-red text-white px-3 py-2 rounded-lg hover:bg-brand-red-dark">
            <Download className="w-4 h-4" /> Log exportieren
          </button>
        </div>
      </div>
    </div>
  );
}
