// Export-Service: CSV-Berichte für den Leiter

import { prisma } from '../../config/database';
import * as gradesService from '../grades/grades.service';

function escapeCsv(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

export async function exportAbsencesCsv(): Promise<string> {
  const absences = await prisma.absence.findMany({
    where: { status: { not: 'ANWESEND' } },
    include: {
      student: { include: { class: { select: { name: true } } } },
      lesson: { include: { subject: { select: { name: true } } } },
      recordedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { recordedAt: 'desc' },
  });

  return toCsv(
    ['Datum', 'Klasse', 'Schüler', 'Fach', 'Status', 'Notiz', 'Erfasst von'],
    absences.map((a) => [
      a.lesson.date.toISOString().split('T')[0],
      a.student.class.name,
      `${a.student.lastName}, ${a.student.firstName}`,
      a.lesson.subject.name,
      a.status,
      a.note,
      `${a.recordedBy.lastName}, ${a.recordedBy.firstName}`,
    ])
  );
}

export async function exportGradesCsv(): Promise<string> {
  const grades = await prisma.grade.findMany({
    include: {
      student: { include: { class: { select: { name: true } } } },
      subject: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ date: 'desc' }],
  });

  return toCsv(
    ['Datum', 'Klasse', 'Schüler', 'Fach', 'Kategorie', 'Note', 'Beschreibung'],
    grades.map((g) => [
      g.date.toISOString().split('T')[0],
      g.student.class.name,
      `${g.student.lastName}, ${g.student.firstName}`,
      g.subject.name,
      g.category.name,
      g.value,
      g.description,
    ])
  );
}

export async function exportPromotionCsv(classId: string, schoolYear: string): Promise<string> {
  const result = await gradesService.checkPromotion(classId, schoolYear);
  if (result.status !== 'OK') {
    return toCsv(['Status', 'Details'], [[result.status, result.details]]);
  }

  return toCsv(
    ['Schüler', 'Status', 'Durchschnitt', 'Fächer unter 4.0'],
    result.results.map((r) => [
      `${r.student.lastName}, ${r.student.firstName}`,
      r.status,
      r.overallAverage ?? '',
      r.failingSubjects,
    ])
  );
}

export async function exportAuditLogCsv(): Promise<string> {
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { timestamp: 'desc' },
    take: 5000,
  });

  return toCsv(
    ['Zeitpunkt', 'Benutzer', 'Aktion', 'Entität', 'Entitäts-ID'],
    logs.map((l) => [
      l.timestamp.toISOString(),
      `${l.user.lastName}, ${l.user.firstName} (${l.user.email})`,
      l.action,
      l.entityType,
      l.entityId,
    ])
  );
}
