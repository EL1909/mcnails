import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, History, Loader, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  fetchSyncPreview,
  fetchSyncStatus,
  publishSync,
  type SyncReport,
  type SyncStatusResponse,
} from '../api/sync';

const money = (value: string) =>
  parseFloat(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Las fechas llegan como YYYY-MM-DD; se formatean a mano para no pasar por
// Date (que las interpreta en UTC y en zonas negativas muestra el día anterior).
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Publicar en EsfuerzoVZ en tres pasos: elegir el rango, ver exactamente lo
// que se enviaría y confirmar. Lo que se publica es siempre el rango que se
// previsualizó: cambiar una fecha descarta la vista previa.
export function EvzSyncPanel({ token }: { token: string }) {
  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const [preview, setPreview] = useState<SyncReport | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const data = await fetchSyncStatus(token);
      setStatus(data);
      setPeriodStart(prev => prev || data.suggested_period.start);
      setPeriodEnd(prev => prev || data.suggested_period.end);
    } catch (err: any) {
      setStatusError(err.message);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const changeDate = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setPreview(null);
    setMessage(null);
  };

  const rangeInvalid = !periodStart || !periodEnd || periodStart > periodEnd;

  const handlePreview = async () => {
    if (rangeInvalid) return;
    setLoadingPreview(true);
    setMessage(null);
    setPreview(null);
    try {
      setPreview(await fetchSyncPreview(token, periodStart, periodEnd));
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePublish = async () => {
    if (!preview) return;
    setPublishing(true);
    setMessage(null);
    try {
      const { start, end } = preview.period;
      await publishSync(token, start, end);
      setMessage({ kind: 'ok', text: `Publicado en EsfuerzoVZ: ${fmtDate(start)} – ${fmtDate(end)}` });
      setPreview(null);
      loadStatus();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
      loadStatus(); // el intento fallido también queda en el historial
    } finally {
      setPublishing(false);
    }
  };

  const remote = status?.remote;

  return (
    <div className="p-4 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 space-y-4">
      {/* Estado de la conexión */}
      <div className="text-xs">
        {loadingStatus && !status ? (
          <span className="text-stone-400 flex items-center gap-1.5">
            <Loader size={12} className="animate-spin" /> Consultando estado…
          </span>
        ) : statusError ? (
          <span className="text-red-600 flex items-start gap-1.5 break-words">
            <AlertCircle size={12} className="mt-0.5 shrink-0" /> {statusError}
          </span>
        ) : remote?.available ? (
          <span className="text-emerald-700 flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={12} /> Conectado con EsfuerzoVZ
          </span>
        ) : remote ? (
          <span className="text-amber-700 flex items-start gap-1.5 font-medium break-words">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {remote.reason === 'not_configured'
              ? 'No configurado: falta EVZ_API_TOKEN en el servidor'
              : remote.detail || 'No se pudo conectar con EsfuerzoVZ'}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-stone-600">
        Envía un resumen agregado de ingresos, gastos y actividad del período a EsfuerzoVZ. Nunca se envían
        nombres ni datos de clientas.
      </p>

      {/* Rango */}
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0">
          <span className="block text-xs font-medium text-stone-500 mb-1">Desde</span>
          <input
            type="date"
            value={periodStart}
            max={periodEnd || undefined}
            onChange={changeDate(setPeriodStart)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
          />
        </label>
        <label className="min-w-0">
          <span className="block text-xs font-medium text-stone-500 mb-1">Hasta</span>
          <input
            type="date"
            value={periodEnd}
            min={periodStart || undefined}
            onChange={changeDate(setPeriodEnd)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
          />
        </label>
      </div>
      {periodStart && periodEnd && periodStart > periodEnd && (
        <p className="text-xs text-red-600">La fecha de inicio es posterior a la de fin.</p>
      )}

      {!preview && (
        <button
          onClick={handlePreview}
          disabled={rangeInvalid || loadingPreview}
          className="w-full bg-white border border-stone-300 text-stone-900 px-4 py-2.5 rounded-full text-sm font-medium hover:border-stone-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loadingPreview ? <Loader size={16} className="animate-spin" /> : <Eye size={16} />}
          {loadingPreview ? 'Generando vista previa…' : 'Ver datos a enviar'}
        </button>
      )}

      {/* Vista previa */}
      {preview && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Vista previa</p>
            <p className="text-xs text-stone-500">
              {fmtDate(preview.period.start)} – {fmtDate(preview.period.end)} · {preview.currency}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 p-3 min-w-0">
              <p className="text-xs text-emerald-700">Ingresos</p>
              <p className="text-lg font-serif text-emerald-800 truncate">${money(preview.totals.income)}</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3 min-w-0">
              <p className="text-xs text-rose-700">Gastos</p>
              <p className="text-lg font-serif text-rose-800 truncate">${money(preview.totals.expenses)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ['Órdenes', preview.metrics.orders],
              ['Clientes', preview.metrics.customers_served],
              ['Citas', preview.metrics.appointments],
              ['Unidades', preview.metrics.units_sold],
              ['Recibos', preview.metrics.receipts_issued],
              ['Ticket prom.', `$${money(preview.metrics.avg_ticket)}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-stone-100 px-3 py-2 min-w-0">
                <p className="text-[11px] text-stone-400">{label}</p>
                <p className="text-sm font-medium text-stone-900 truncate">{value}</p>
              </div>
            ))}
          </div>

          {preview.expense_breakdown.length > 0 && (
            <details className="group">
              <summary className="text-xs font-medium text-stone-500 cursor-pointer select-none">
                Gastos por categoría ({preview.expense_breakdown.length})
              </summary>
              <div className="mt-2 space-y-1">
                {preview.expense_breakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs px-2.5 py-1.5 rounded-lg bg-stone-50">
                    <span className="text-stone-700 truncate">{item.category}</span>
                    <span className="text-stone-500 shrink-0">
                      ${money(item.amount)} <span className="text-stone-400">({item.pct_of_expenses}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button
              onClick={() => setPreview(null)}
              disabled={publishing}
              className="sm:flex-1 px-4 py-2.5 rounded-full text-sm font-medium border border-stone-200 text-stone-600 hover:border-stone-400 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="sm:flex-1 bg-stone-900 text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {publishing ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
              {publishing ? 'Enviando…' : 'Confirmar y enviar'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={cn(
          'p-3 rounded-lg border text-sm font-medium break-words',
          message.kind === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        )}>
          {message.kind === 'ok' ? '✓ ' : '✗ '}{message.text}
        </div>
      )}

      {/* Historial */}
      {status && status.history.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-medium text-stone-500 flex items-center gap-1.5">
            <History size={12} /> Publicaciones anteriores
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {status.history.map((h, i) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-white border border-stone-100 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-700">{fmtDate(h.period_start)} – {fmtDate(h.period_end)}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full font-medium shrink-0',
                    h.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  )}>
                    {h.status === 'ok' ? 'Enviado' : 'Falló'}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 text-stone-400 mt-0.5">
                  <span>{new Date(h.sent_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  {h.totals && <span>${money(h.totals.income)} / ${money(h.totals.expenses)}</span>}
                </div>
                {h.status === 'failed' && h.error && (
                  <p className="text-red-600 mt-1 break-words">{h.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
