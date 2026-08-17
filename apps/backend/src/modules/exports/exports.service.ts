// Export-Service: CSV- und Excel-Generierung für Berichte
// Nur Abteilungsleitung (Route-Guard). nDSG: Exporte enthalten Personendaten.

import * as XLSX from 'xlsx';
import { prisma } from '../../config/database';
import { checkPromotion } from '../grades/grades.service';

interface CsvColumn {
  key: string;
  label: string;
}

// CSV mit ';'-Trennung (DE-Excel) + UTF-8-BOM für korrekte Umlaute
function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(';')).join('\n');
  return '﻿' + header + '\n' + body;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------- Absenzen (CSV) ----------------
export async function absencesCsv(): Promise<string> {
  const absences = await prisma.absence.findMany({
    include: {
      student: { include: { class: { select: { name: true } } } },
      lesson: { include: { subject: { select: { name: true } } } },
    },
    orderBy: { recordedAt: 'desc' },
  });

  const rows = absences.map((a) => ({
    schueler: `${a.student.lastName}, ${a.student.firstName}`,
    klasse: a.student.class?.name ?? '',
    fach: a.lesson.subject.name,
    datum: isoDate(a.lesson.date),
    status: a.status,
    notiz: a.note ?? '',
  }));

  return toCsv(rows, [
    { key: 'schueler', label: 'Schüler' },
    { key: 'klasse', label: 'Klasse' },
    { key: 'fach', label: 'Fach' },
    { key: 'datum', label: 'Datum' },
    { key: 'status', label: 'Status' },
    { key: 'notiz', label: 'Notiz' },
  ]);
}

// ---------------- Noten (Excel) ----------------
export async function gradesWorkbook(): Promise<Buffer> {
  const grades = await prisma.grade.findMany({
    include: {
      student: { select: { firstName: true, lastName: true } },
      subject: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ subjectId: 'asc' }, { date: 'desc' }],
  });

  const rows = grades.map((g) => ({
    Schüler: `${g.student.lastName}, ${g.student.firstName}`,
    Fach: g.subject.name,
    Kategorie: g.category.name,
    Note: g.value,
    Datum: isoDate(g.date),
    Gesperrt: g.isLocked ? 'Ja' : 'Nein',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 10 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Noten');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ---------------- Promotionsbericht (Excel) ----------------
export async function promotionWorkbook(): Promise<Buffer> {
  const rules = await prisma.promotionRule.findMany();

  const rows: Record<string, unknown>[] = [];
  for (const rule of rules) {
    const cls = await prisma.class.findUnique({ where: { id: rule.classId }, select: { name: true } });
    // eslint-disable-next-line no-await-in-loop
    const result = await checkPromotion(rule.classId, rule.schoolYear);
    if (result.status !== 'OK' || !result.results) continue;
    for (const r of result.results) {
      rows.push({
        Klasse: cls?.name ?? rule.classId,
        Schuljahr: rule.schoolYear,
        Schüler: `${r.student.lastName}, ${r.student.firstName}`,
        Status: r.status,
        Durchschnitt: r.overallAverage ?? '',
        'Ungenügende Fächer': r.failingSubjects,
      });
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ Hinweis: 'Keine Promotionsregeln oder Noten vorhanden.' }]
  );
  worksheet['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Promotion');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ---------------- Audit-Log (CSV) ----------------
export async function auditLogCsv(): Promise<string> {
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { timestamp: 'desc' },
    take: 10000,
  });

  const rows = logs.map((l) => ({
    zeitpunkt: l.timestamp.toISOString(),
    benutzer: `${l.user.lastName}, ${l.user.firstName}`,
    aktion: l.action,
    entitaet: l.entityType,
    entitaetId: l.entityId,
    ip: l.ipAddress ?? '',
  }));

  return toCsv(rows, [
    { key: 'zeitpunkt', label: 'Zeitpunkt' },
    { key: 'benutzer', label: 'Benutzer' },
    { key: 'aktion', label: 'Aktion' },
    { key: 'entitaet', label: 'Entität' },
    { key: 'entitaetId', label: 'Entitäts-ID' },
    { key: 'ip', label: 'IP-Adresse' },
  ]);
}
