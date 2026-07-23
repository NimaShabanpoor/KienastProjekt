// Export-Service: CSV-/Excel-/PDF-Berichte für den Leiter
// CSV nutzt Semikolon – Standard für Excel in DE/CH

import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import * as gradesService from '../grades/grades.service';

function escapeCsv(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.join(';')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(';'));
  }
  return lines.join('\n');
}

function buildExcelBuffer(options: {
  title: string;
  sheetName: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  colWidths: number[];
}): Buffer {
  const exportedAt = new Date().toLocaleDateString('de-CH');
  const lastCol = options.headers.length - 1;
  const worksheet = XLSX.utils.aoa_to_sheet([
    [options.title],
    [`Exportiert am ${exportedAt} · ${options.rows.length} Einträge`],
    [],
    options.headers,
    ...options.rows.map((row) => row.map((cell) => (cell == null ? '' : cell))),
  ]);

  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
  worksheet['!cols'] = options.colWidths.map((wch) => ({ wch }));
  if (options.rows.length > 0) {
    const endCol = String.fromCharCode(65 + lastCol);
    worksheet['!autofilter'] = { ref: `A4:${endCol}${3 + options.rows.length}` };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName);
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
}

function formatAbsenceStatus(status: string): string {
  switch (status) {
    case 'ENTSCHULDIGT':
      return 'Entschuldigt';
    case 'UNENTSCHULDIGT':
      return 'Unentschuldigt';
    case 'ANWESEND':
      return 'Anwesend';
    default:
      return status;
  }
}

export async function exportAbsencesExcel(): Promise<Buffer> {
  const absences = await prisma.absence.findMany({
    where: { status: { not: 'ANWESEND' } },
    include: {
      student: { include: { class: { select: { name: true } } } },
      lesson: { include: { subject: { select: { name: true } } } },
      recordedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [
      { lesson: { date: 'desc' } },
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
    ],
  });

  return buildExcelBuffer({
    title: 'Absenzenübersicht',
    sheetName: 'Absenzen',
    headers: [
      'Datum',
      'Klasse',
      'Nachname',
      'Vorname',
      'Fach',
      'Status',
      'Arztzeugnis',
      'Notiz',
      'Erfasst von',
    ],
    rows: absences.map((a) => [
      a.lesson.date.toISOString().split('T')[0],
      a.student.class.name,
      a.student.lastName,
      a.student.firstName,
      a.lesson.subject.name,
      formatAbsenceStatus(a.status),
      a.hasMedicalCertificate ? 'Ja' : 'Nein',
      a.note ?? '',
      `${a.recordedBy.lastName}, ${a.recordedBy.firstName}`,
    ]),
    colWidths: [12, 14, 16, 14, 18, 16, 12, 28, 20],
  });
}

export async function exportGradesExcel(classId: string): Promise<{ buffer: Buffer; className: string }> {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true },
  });
  if (!classRecord) {
    throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);
  }

  const grades = await prisma.grade.findMany({
    where: { student: { classId } },
    include: {
      student: { select: { firstName: true, lastName: true } },
      subject: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
      { subject: { name: 'asc' } },
      { date: 'desc' },
    ],
  });

  const headers = ['Nachname', 'Vorname', 'Fach', 'Kategorie', 'Note', 'Datum', 'Beschreibung'];
  const dataRows = grades.map((g) => [
    g.student.lastName,
    g.student.firstName,
    g.subject.name,
    g.category.name,
    g.value,
    g.date.toISOString().split('T')[0],
    g.description ?? '',
  ]);

  const buffer = buildExcelBuffer({
    title: `Notenübersicht – Klasse ${classRecord.name}`,
    sheetName: 'Noten',
    headers,
    rows: dataRows,
    colWidths: [16, 14, 18, 14, 8, 12, 30],
  });

  return { buffer, className: classRecord.name };
}

export async function exportGradesPdf(classId: string): Promise<{ buffer: Buffer; className: string }> {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true },
  });
  if (!classRecord) {
    throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);
  }

  const grades = await prisma.grade.findMany({
    where: { student: { classId } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      subject: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
      { subject: { name: 'asc' } },
      { date: 'desc' },
    ],
  });

  const byStudent = new Map<string, {
    name: string;
    grades: { subject: string; category: string; value: number; date: string; description: string | null }[];
  }>();

  for (const g of grades) {
    const key = g.student.id;
    if (!byStudent.has(key)) {
      byStudent.set(key, {
        name: `${g.student.lastName}, ${g.student.firstName}`,
        grades: [],
      });
    }
    byStudent.get(key)!.grades.push({
      subject: g.subject.name,
      category: g.category.name,
      value: g.value,
      date: g.date.toISOString().split('T')[0]!,
      description: g.description,
    });
  }

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const exportedAt = new Date().toLocaleDateString('de-CH');

    doc.fontSize(16).font('Helvetica-Bold').text(`Notenübersicht – Klasse ${classRecord.name}`);
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#555555')
      .text(`Exportiert am ${exportedAt} · ${grades.length} Note(n)`);
    doc.fillColor('#000000');
    doc.moveDown(1);

    if (byStudent.size === 0) {
      doc.fontSize(11).text('Für diese Klasse sind keine Noten vorhanden.');
      doc.end();
      return;
    }

    const colWidths = [120, 100, 45, 70, pageWidth - 335];
    const headers = ['Fach', 'Kategorie', 'Note', 'Datum', 'Beschreibung'];

    const ensureSpace = (needed: number): void => {
      if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    };

    for (const student of byStudent.values()) {
      ensureSpace(60);
      doc.fontSize(12).font('Helvetica-Bold').text(student.name);
      doc.moveDown(0.3);

      const startX = doc.page.margins.left;
      let x = startX;
      const headerY = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i]!, x, headerY, { width: colWidths[i]! - 4, continued: false });
        x += colWidths[i]!;
      }
      doc.y = headerY + 14;
      doc.moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(9);
      for (const g of student.grades) {
        ensureSpace(28);
        const rowY = doc.y;
        const cells = [g.subject, g.category, String(g.value), g.date, g.description ?? ''];
        let maxHeight = 12;
        for (let i = 0; i < cells.length; i++) {
          const h = doc.heightOfString(cells[i]!, { width: colWidths[i]! - 4 });
          if (h > maxHeight) maxHeight = h;
        }
        x = startX;
        for (let i = 0; i < cells.length; i++) {
          if (i === 2) doc.font('Helvetica-Bold');
          else doc.font('Helvetica');
          doc.text(cells[i]!, x, rowY, {
            width: colWidths[i]! - 4,
            align: i === 2 ? 'center' : 'left',
          });
          x += colWidths[i]!;
        }
        doc.y = rowY + maxHeight + 4;
      }

      doc.moveDown(0.8);
    }

    doc.end();
  });

  return { buffer, className: classRecord.name };
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
