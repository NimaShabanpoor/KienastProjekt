// Export-Service: CSV-/Excel-/PDF-Berichte für den Leiter
// CSV nutzt Semikolon – Standard für Excel in DE/CH

import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import * as gradesService from '../grades/grades.service';
import { ensureStructure } from '../timetable/timetable.service';

const WEEKDAYS_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'] as const;

function lightenHex(hex: string, mix = 0.78): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return '#F2F2F2';
  const n = parseInt(raw, 16);
  if (Number.isNaN(n)) return '#F2F2F2';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lr = Math.round(r + (255 - r) * mix);
  const lg = Math.round(g + (255 - g) * mix);
  const lb = Math.round(b + (255 - b) * mix);
  return `#${[lr, lg, lb].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

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
 * Wochenstundenplan als farbcodiertes PDF (Querformat), Excel-ähnlich:
 * Gitter, Fachfarben, Pausen-Trennzeilen, Feiertags-Tabelle, Farblegende.
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
        subject: { select: { id: true, name: true, color: true } },
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

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 14, bottom: 14, left: 16, right: 16 },
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Professionelles Schwarz/Weiss/Grau – eine Seite, ohne Farben/Icons
    const BLACK = '#111111';
    const DARK = '#333333';
    const MID = '#666666';
    const GRID = '#444444';
    const HEADER_BG = '#333333';
    const TIME_BG = '#E8E8E8';
    const EMPTY_BG = '#FFFFFF';
    const BREAK_BG = '#D0D0D0';
    const ALT_ROW = '#F5F5F5';
    const GRID_W = 0.8;

    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const usableH = pageBottom - top;

    const paintCell = (x: number, yy: number, w: number, h: number, fill: string): void => {
      doc.save();
      doc.lineWidth(GRID_W);
      doc.fillColor(fill);
      doc.strokeColor(GRID);
      doc.rect(x, yy, w, h).fillAndStroke();
      doc.restore();
    };

    const titleH = 18;
    const headerRowH = 16;
    const breakH = 11;
    const cellPad = 2;
    const gapBeforeHolidays = 8;
    const holTitleH = 12;
    const holHeadH = 13;
    const holRowH = 11;
    const holidayRows = Math.max(1, holidays.length);
    const holidayBlockH = gapBeforeHolidays + holTitleH + holHeadH + holidayRows * holRowH;

    const breakCount = structure.filter((r) => r.type === 'BREAK').length;
    const periodCount = structure.length - breakCount;
    const reserved =
      titleH + 4 + headerRowH + breakCount * breakH + holidayBlockH;
    const periodRowH = Math.max(
      26,
      Math.min(34, Math.floor((usableH - reserved) / Math.max(1, periodCount)))
    );

    const timeColW = 70;
    const dayColW = (pageWidth - timeColW) / 5;

    // Titel (grau, nicht farbig)
    paintCell(left, top, pageWidth, titleH, HEADER_BG);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
    doc.text(`Stundenplan ${classRecord.name}`, left + 8, top + 5, {
      width: pageWidth * 0.55,
      lineBreak: false,
    });
    doc.font('Helvetica').fontSize(7);
    doc.text(
      `${classRecord.schoolYear} | ${classRecord.semester}. Semester | ${new Date().toLocaleDateString('de-CH')}`,
      left + pageWidth * 0.5,
      top + 6,
      { width: pageWidth * 0.5 - 8, align: 'right', lineBreak: false }
    );

    let y = top + titleH + 4;

    // Kopfzeile
    paintCell(left, y, timeColW, headerRowH, HEADER_BG);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7);
    doc.text('Zeit', left + cellPad, y + 4.5, {
      width: timeColW - cellPad * 2,
      align: 'center',
      lineBreak: false,
    });

    for (let d = 0; d < 5; d++) {
      const x = left + timeColW + d * dayColW;
      paintCell(x, y, dayColW, headerRowH, HEADER_BG);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      doc.text(WEEKDAYS_FULL[d]!, x + 2, y + 4, {
        width: dayColW - 4,
        align: 'center',
        lineBreak: false,
      });
    }
    y += headerRowH;

    // Perioden / Pausen
    for (const row of structure) {
      if (row.type === 'BREAK') {
        paintCell(left, y, timeColW, breakH, BREAK_BG);
        for (let d = 0; d < 5; d++) {
          paintCell(left + timeColW + d * dayColW, y, dayColW, breakH, BREAK_BG);
        }
        const timePart =
          row.startTime && row.endTime ? ` ${row.startTime}-${row.endTime}` : '';
        doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(6.5);
        doc.text(`${row.label.toUpperCase()}${timePart}`, left, y + 2.5, {
          width: pageWidth,
          align: 'center',
          lineBreak: false,
        });
        y += breakH;
        continue;
      }

      const period = row.period!;
      const timeLabel =
        row.startTime && row.endTime ? `${row.startTime}-${row.endTime}` : '';
      const rowH = periodRowH;

      paintCell(left, y, timeColW, rowH, TIME_BG);
      doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(7);
      doc.text(row.label, left + cellPad, y + 4, {
        width: timeColW - cellPad * 2,
        align: 'center',
        lineBreak: false,
      });
      if (timeLabel) {
        doc.fillColor(MID).font('Helvetica').fontSize(6);
        doc.text(timeLabel, left + cellPad, y + 14, {
          width: timeColW - cellPad * 2,
          align: 'center',
          lineBreak: false,
        });
      }

      for (let d = 1; d <= 5; d++) {
        const x = left + timeColW + (d - 1) * dayColW;
        const slot = slotMap.get(`${d}-${period}`);

        if (!slot) {
          paintCell(x, y, dayColW, rowH, EMPTY_BG);
          continue;
        }

        paintCell(x, y, dayColW, rowH, lightenHex(slot.subject.color ?? '#C8102E'));

        const textW = dayColW - cellPad * 2;
        let ty = y + cellPad + 1;
        const teacher = `${slot.teacher.firstName} ${slot.teacher.lastName}`;

        doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(7);
        doc.text(slot.subject.name, x + cellPad, ty, {
          width: textW,
          lineBreak: false,
          ellipsis: true,
        });
        ty += 9;

        if (slot.room) {
          doc.fillColor(DARK).font('Helvetica').fontSize(6);
          doc.text(`Zimmer ${slot.room}`, x + cellPad, ty, {
            width: textW,
            lineBreak: false,
            ellipsis: true,
          });
          ty += 8;
        }

        doc.fillColor(MID).font('Helvetica').fontSize(6);
        doc.text(teacher, x + cellPad, ty, {
          width: textW,
          lineBreak: false,
          ellipsis: true,
        });
      }

      y += rowH;
    }

    // Feiertage (kompakt, gleiche Seite)
    y += gapBeforeHolidays;
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(8);
    doc.text('Unterrichtsfreie Zeit / Feiertage', left, y, { lineBreak: false });
    y += holTitleH;

    const holColDate = pageWidth * 0.35;
    const holColName = pageWidth - holColDate;

    paintCell(left, y, holColDate, holHeadH, HEADER_BG);
    paintCell(left + holColDate, y, holColName, holHeadH, HEADER_BG);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7);
    doc.text('Datum', left + 5, y + 3, { width: holColDate - 10, lineBreak: false });
    doc.text('Bezeichnung', left + holColDate + 5, y + 3, {
      width: holColName - 10,
      lineBreak: false,
    });
    y += holHeadH;

    if (holidays.length === 0) {
      paintCell(left, y, holColDate, holRowH, EMPTY_BG);
      paintCell(left + holColDate, y, holColName, holRowH, EMPTY_BG);
      doc.fillColor(MID).font('Helvetica').fontSize(6.5);
      doc.text('Keine Feiertage erfasst.', left + 5, y + 2.5, {
        width: pageWidth - 10,
        lineBreak: false,
      });
    } else {
      holidays.forEach((h, idx) => {
        const bg = idx % 2 === 0 ? EMPTY_BG : ALT_ROW;
        paintCell(left, y, holColDate, holRowH, bg);
        paintCell(left + holColDate, y, holColName, holRowH, bg);

        const dateStr = h.date.toLocaleDateString('de-CH', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        doc.fillColor(BLACK).font('Helvetica').fontSize(6.5);
        doc.text(dateStr, left + 5, y + 2.5, {
          width: holColDate - 10,
          lineBreak: false,
        });
        doc.font('Helvetica-Bold').text(h.name, left + holColDate + 5, y + 2.5, {
          width: holColName - 10,
          lineBreak: false,
          ellipsis: true,
        });
        y += holRowH;
      });
    }

    doc.end();
  });

  return { buffer, className: classRecord.name };
}
