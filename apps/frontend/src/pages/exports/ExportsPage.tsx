// Export-Seite (nur Abteilungsleitung)

import { Download, FileText, BarChart2, Users } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';

type ExportState = {
  loadingEndpoint: string | null;
  message: string | null;
  tone: 'success' | 'error' | null;
};

export default function ExportsPage() {
  const [exportState, setExportState] = useState<ExportState>({
    loadingEndpoint: null,
    message: null,
    tone: null,
  });

  const handleExport = async (endpoint: string, filename: string): Promise<void> => {
    try {
      setExportState({ loadingEndpoint: endpoint, message: null, tone: null });
      const response = await apiClient.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExportState({
        loadingEndpoint: null,
        message: `${filename} wurde heruntergeladen.`,
        tone: 'success',
      });
    } catch {
      setExportState({
        loadingEndpoint: null,
        message: 'Export fehlgeschlagen. Bitte versuche es erneut.',
        tone: 'error',
      });
    }
  };

  const exportCards = [
    {
      endpoint: '/api/v1/exports/absences/csv',
      filename: 'absenzen.csv',
      title: 'Absenzen (CSV)',
      description: 'Alle Absenzen als CSV-Datei exportieren',
      icon: Users,
      accent: 'bg-orange-50 text-orange-600',
      cta: 'CSV exportieren',
    },
    {
      endpoint: '/api/v1/exports/grades/excel',
      filename: 'noten.xlsx',
      title: 'Noten (Excel)',
      description: 'Notenliste als Excel-Datei exportieren',
      icon: BarChart2,
      accent: 'bg-green-50 text-green-600',
      cta: 'Excel exportieren',
    },
    {
      endpoint: '/api/v1/exports/statistics/promotion',
      filename: 'promotion.xlsx',
      title: 'Promotionsbericht',
      description: 'Bestehensquote und Promotionsstatus (Excel)',
      icon: FileText,
      accent: 'bg-blue-50 text-blue-600',
      cta: 'Bericht exportieren',
    },
    {
      endpoint: '/api/v1/exports/audit-log',
      filename: 'audit-log.csv',
      title: 'Audit-Log',
      description: 'Alle kritischen Aktionen als CSV (nDSG)',
      icon: FileText,
      accent: 'bg-purple-50 text-purple-600',
      cta: 'Log exportieren',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Berichte"
        title="Exporte & Berichte"
        description="Alle wichtigsten Exporte an einem Ort. Jeder Export zeigt jetzt klaren Status statt eines störenden Browser-Alerts."
      />

      {exportState.message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            exportState.tone === 'success'
              ? 'border border-green-200 bg-green-50 text-green-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {exportState.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {exportCards.map((card) => (
          <div key={card.endpoint} className="surface-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className={`rounded-2xl p-3 ${card.accent}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900">{card.title}</h3>
            </div>
            <p className="mb-5 text-sm leading-6 text-slate-500">{card.description}</p>
            <button
              type="button"
              onClick={() => void handleExport(card.endpoint, card.filename)}
              className="btn-primary"
              disabled={exportState.loadingEndpoint === card.endpoint}
            >
              <Download className="h-4 w-4" />
              {exportState.loadingEndpoint === card.endpoint ? 'Export läuft...' : card.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
