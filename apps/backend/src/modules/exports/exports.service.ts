// Export-Service: CSV-/Excel-/PDF-Berichte für den Leiter
// CSV nutzt Semikolon – Standard für Excel in DE/CH

import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import * as gradesService from '../grades/grades.service';
import { ensureStructure } from '../timetable/timetable.service';

const BRAND_RED = '#C8102E';
const WEEKDAYS_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'] as const;

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

/**
 * Wochenstundenplan als PDF (Querformat), ähnlich dem IT-Bénédict-Stundenplan:
 * Grid Mo–Fr mit Fach, Zimmer, Lehrperson + Feiertage darunter.
 */
export async function exportTimetablePdf(
  classId: string
): Promise<{ buffer: Buffer; className: string }> {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, semester: true, schoolYear: true },
  });
  if (!classRecord) {
    throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);
  }

  const [structure, slots, holidays] = await Promise.all([
    ensureStructure(),
    prisma.timetableSlot.findMany({
      where: { classId },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.schoolHoliday.findMany({
      orderBy: { date: 'asc' },
    }),
  ]);

  const slotMap = new Map<string, (typeof slots)[number]>();
  for (const s of slots) {
    slotMap.set(`${s.dayOfWeek}-${s.period}`, s);
  }

  const subjectLegend = new Map<string, string>();
  for (const s of slots) {
    subjectLegend.set(s.subject.name, s.subject.name);
  }

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 28, bottom: 28, left: 28, right: 28 },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom;

    // Header-Leiste
    doc.rect(left, top, pageWidth, 36).fill(BRAND_RED);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14);
    doc.text(`Stundenplan ${classRecord.name}`, left + 12, top + 10, {
      width: pageWidth * 0.45,
      align: 'left',
    });
    doc.font('Helvetica').fontSize(10);
    doc.text(
      `${classRecord.schoolYear} · ${classRecord.semester}. Semester`,
      left + pageWidth * 0.45,
      top + 12,
      { width: pageWidth * 0.55 - 12, align: 'right' }
    );

    let y = top + 48;
    doc.fillColor('#333333').font('Helvetica').fontSize(9);
    doc.text(
      `Wochenvorlage Mo–Fr · Exportiert am ${new Date().toLocaleDateString('de-CH')}`,
      left,
      y,
      { width: pageWidth }
    );
    y += 18;

    const timeColW = 78;
    const dayColW = (pageWidth - timeColW) / 5;
    const headerRowH = 34;
    const cellMinH = 42;

    // Tabellenkopf
    doc.rect(left, y, pageWidth, headerRowH).fill('#F3F4F6');
    doc.strokeColor('#9CA3AF').lineWidth(0.8);
    doc.rect(left, y, pageWidth, headerRowH).stroke();

    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);
    doc.text('Tag / Zeit', left + 4, y + 6, { width: timeColW - 8, align: 'left' });
    doc.font('Helvetica').fontSize(7).fillColor('#6B7280');
    doc.text('Fach · Zimmer · Lehrperson', left + 4, y + 18, {
      width: timeColW - 8,
    });

    for (let d = 0; d < 5; d++) {
      const x = left + timeColW + d * dayColW;
      doc.strokeColor('#9CA3AF').moveTo(x, y).lineTo(x, y + headerRowH).stroke();
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10);
      doc.text(WEEKDAYS_FULL[d]!, x + 2, y + 6, { width: dayColW - 4, align: 'center' });
      doc.fillColor('#6B7280').font('Helvetica').fontSize(8);
      doc.text('Fach', x + 2, y + 20, { width: dayColW - 4, align: 'center' });
    }
    y += headerRowH;

    const drawBreakRow = (label: string, timeLabel: string): void => {
      const h = 18;
      if (y + h > pageBottom - 80) {
        doc.addPage();
        y = top;
      }
      doc.rect(left, y, pageWidth, h).fill('#E5E7EB');
      doc.strokeColor('#9CA3AF').rect(left, y, pageWidth, h).stroke();
      doc.fillColor('#4B5563').font('Helvetica-Bold').fontSize(8);
      const text = timeLabel ? `${label}  (${timeLabel})` : label;
      doc.text(text, left, y + 5, { width: pageWidth, align: 'center' });
      y += h;
    };

    const measureCellHeight = (
      subject: string,
      room: string,
      teacher: string,
      width: number
    ): number => {
      doc.font('Helvetica-Bold').fontSize(8);
      let h = doc.heightOfString(subject || '–', { width: width - 8 });
      doc.font('Helvetica').fontSize(7);
      if (room) h += doc.heightOfString(room, { width: width - 8 }) + 1;
      if (teacher) h += doc.heightOfString(teacher, { width: width - 8 }) + 1;
      return Math.max(cellMinH, h + 10);
    };

    for (const row of structure) {
      if (row.type === 'BREAK') {
        const timeLabel =
          row.startTime && row.endTime ? `${row.startTime}–${row.endTime}` : '';
        drawBreakRow(row.label, timeLabel);
        continue;
      }

      const period = row.period!;
      const timeLabel =
        row.startTime && row.endTime
          ? `${row.startTime} – ${row.endTime}`
          : row.label;

      // Zellenhöhe anhand Inhalt berechnen
      let rowH = cellMinH;
      for (let d = 1; d <= 5; d++) {
        const slot = slotMap.get(`${d}-${period}`);
        if (!slot) continue;
        const teacher = `${slot.teacher.firstName} ${slot.teacher.lastName}`;
        const room = slot.room ? `Zimmer ${slot.room}` : '';
        rowH = Math.max(
          rowH,
          measureCellHeight(slot.subject.name, room, teacher, dayColW)
        );
      }

      if (y + rowH > pageBottom - 80) {
        doc.addPage();
        y = top;
      }

      // Zeit-Spalte
      doc.strokeColor('#9CA3AF').lineWidth(0.7);
      doc.rect(left, y, timeColW, rowH).fillAndStroke('#FAFAFA', '#9CA3AF');
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);
      doc.text(row.label, left + 4, y + 6, { width: timeColW - 8 });
      doc.fillColor('#4B5563').font('Helvetica').fontSize(7);
      doc.text(timeLabel, left + 4, y + 18, { width: timeColW - 8 });

      for (let d = 1; d <= 5; d++) {
        const x = left + timeColW + (d - 1) * dayColW;
        doc.rect(x, y, dayColW, rowH).stroke();
        const slot = slotMap.get(`${d}-${period}`);
        if (!slot) continue;

        let ty = y + 5;
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);
        doc.text(slot.subject.name, x + 4, ty, { width: dayColW - 8, align: 'left' });
        ty += doc.heightOfString(slot.subject.name, { width: dayColW - 8 }) + 2;

        if (slot.room) {
          doc.fillColor('#374151').font('Helvetica').fontSize(7);
          const roomText = `Zimmer ${slot.room}`;
          doc.text(roomText, x + 4, ty, { width: dayColW - 8 });
          ty += doc.heightOfString(roomText, { width: dayColW - 8 }) + 1;
        }

        doc.fillColor('#4B5563').font('Helvetica').fontSize(7);
        const teacher = `${slot.teacher.firstName} ${slot.teacher.lastName}`;
        doc.text(teacher, x + 4, ty, { width: dayColW - 8 });
      }

      y += rowH;
    }

    // Feiertage / schulfrei
    y += 14;
    if (y + 40 > pageBottom) {
      doc.addPage();
      y = top;
    }

    doc.fillColor(BRAND_RED).font('Helvetica-Bold').fontSize(11);
    doc.text('Unterrichtsfreie Zeit / Feiertage', left, y);
    y += 16;

    if (holidays.length === 0) {
      doc.fillColor('#6B7280').font('Helvetica').fontSize(9);
      doc.text('Keine Feiertage erfasst.', left, y);
      y += 14;
    } else {
      doc.fillColor('#111827').font('Helvetica').fontSize(9);
      for (const h of holidays) {
        if (y + 14 > pageBottom) {
          doc.addPage();
          y = top;
        }
        const dateStr = h.date.toLocaleDateString('de-CH', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
        doc.font('Helvetica-Bold').text(h.name, left, y, { continued: true, width: pageWidth });
        doc.font('Helvetica').fillColor('#4B5563').text(`  ·  ${dateStr}`);
        doc.fillColor('#111827');
        y += 13;
      }
    }

    // Legende Fächer
    if (subjectLegend.size > 0) {
      y += 12;
      if (y + 30 > pageBottom) {
        doc.addPage();
        y = top;
      }
      doc.fillColor(BRAND_RED).font('Helvetica-Bold').fontSize(11);
      doc.text('Legende (Fächer)', left, y);
      y += 14;
      doc.fillColor('#111827').font('Helvetica').fontSize(8);
      const subjects = [...subjectLegend.keys()].sort((a, b) => a.localeCompare(b, 'de'));
      for (const name of subjects) {
        if (y + 12 > pageBottom) {
          doc.addPage();
          y = top;
        }
        doc.text(`• ${name}`, left, y);
        y += 11;
      }
    }

    doc.end();
  });

  return { buffer, className: classRecord.name };
}
