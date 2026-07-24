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

  /** Kräftige Fachfarben (sichtbare Flächenfüllung, nicht nur Textfarbe) */
  const SUBJECT_PALETTE: { bg: string; fg: string }[] = [
    { bg: '#93C5FD', fg: '#1E3A8A' }, // blau
    { bg: '#86EFAC', fg: '#14532D' }, // grün
    { bg: '#FCD34D', fg: '#78350F' }, // amber
    { bg: '#C4B5FD', fg: '#4C1D95' }, // violett
    { bg: '#FDA4AF', fg: '#881337' }, // rose
    { bg: '#67E8F9', fg: '#164E63' }, // cyan
    { bg: '#FDBA74', fg: '#7C2D12' }, // orange
    { bg: '#BEF264', fg: '#365314' }, // lime
    { bg: '#F9A8D4', fg: '#831843' }, // pink
    { bg: '#A5B4FC', fg: '#312E81' }, // indigo
  ];

  const subjectsUsed = [...new Set(slots.map((s) => s.subject.name))].sort((a, b) =>
    a.localeCompare(b, 'de')
  );

  const subjectColorMap = new Map<string, { bg: string; fg: string }>();
  subjectsUsed.forEach((name, index) => {
    subjectColorMap.set(name, SUBJECT_PALETTE[index % SUBJECT_PALETTE.length]!);
  });

  function subjectColor(name: string): { bg: string; fg: string } {
    return subjectColorMap.get(name) ?? SUBJECT_PALETTE[0]!;
  }

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 24, bottom: 24, left: 24, right: 24 },
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const GRID = '#1E293B';
    const GRID_W = 1.2;
    const HEADER_BG = '#1F2937';
    const TIME_BG = '#D1D5DB';
    const EMPTY_BG = '#FFFFFF';
    const BREAK_BG = '#94A3B8';

    /**
     * Zelle mit Füllung + Rahmen in einem Zug (sichtbares Excel-Gitter).
     * save/restore hält Farbzustand getrennt vom nachfolgenden Text.
     */
    const paintCell = (x: number, yy: number, w: number, h: number, fill: string): void => {
      doc.save();
      doc.lineWidth(GRID_W);
      doc.fillColor(fill);
      doc.strokeColor(GRID);
      doc.rect(x, yy, w, h).fillAndStroke();
      doc.restore();
    };

    // Titelzeile
    doc.save();
    doc.rect(left, top, pageWidth, 32).fill(BRAND_RED);
    doc.restore();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13);
    doc.text(`Stundenplan ${classRecord.name}`, left + 10, top + 9, {
      width: pageWidth * 0.5,
      lineBreak: false,
    });
    doc.font('Helvetica').fontSize(9);
    doc.text(
      `${classRecord.schoolYear} · ${classRecord.semester}. Semester · Export ${new Date().toLocaleDateString('de-CH')}`,
      left + pageWidth * 0.48,
      top + 11,
      { width: pageWidth * 0.52 - 10, align: 'right', lineBreak: false }
    );

    let y = top + 42;

    const timeColW = 82;
    const dayColW = (pageWidth - timeColW) / 5;
    const headerRowH = 28;
    const cellPad = 4;
    const cellMinH = 48;

    const ensureSpace = (needed: number): void => {
      if (y + needed > pageBottom) {
        doc.addPage();
        y = top;
      }
    };

    // === Kopfzeile ===
    ensureSpace(headerRowH);
    paintCell(left, y, timeColW, headerRowH, HEADER_BG);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    doc.text('Tag / Zeit', left + cellPad, y + 10, {
      width: timeColW - cellPad * 2,
      align: 'center',
      lineBreak: false,
    });

    for (let d = 0; d < 5; d++) {
      const x = left + timeColW + d * dayColW;
      paintCell(x, y, dayColW, headerRowH, HEADER_BG);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
      doc.text(WEEKDAYS_FULL[d]!, x + 2, y + 9, {
        width: dayColW - 4,
        align: 'center',
        lineBreak: false,
      });
    }
    y += headerRowH;

    const measureLines = (
      subject: string,
      room: string,
      teacher: string,
      width: number
    ): number => {
      const w = width - cellPad * 2;
      doc.font('Helvetica-Bold').fontSize(8);
      let h = doc.heightOfString(subject, { width: w });
      doc.font('Helvetica').fontSize(7);
      if (room) h += 2 + doc.heightOfString(room, { width: w });
      if (teacher) h += 2 + doc.heightOfString(teacher, { width: w });
      return Math.max(cellMinH, h + cellPad * 2);
    };

    // === Perioden / Pausen ===
    for (const row of structure) {
      if (row.type === 'BREAK') {
        const h = 22;
        ensureSpace(h);
        // Jede Spalte einzeln rahmen → durchgehendes Gitter auch in Pausen
        paintCell(left, y, timeColW, h, BREAK_BG);
        for (let d = 0; d < 5; d++) {
          paintCell(left + timeColW + d * dayColW, y, dayColW, h, BREAK_BG);
        }
        const timePart =
          row.startTime && row.endTime ? `  ${row.startTime}–${row.endTime}` : '';
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8);
        doc.text(`— ${row.label.toUpperCase()}${timePart} —`, left, y + 7, {
          width: pageWidth,
          align: 'center',
          lineBreak: false,
        });
        y += h;
        continue;
      }

      const period = row.period!;
      const timeLabel =
        row.startTime && row.endTime
          ? `${row.startTime} – ${row.endTime}`
          : '';

      let rowH = cellMinH;
      for (let d = 1; d <= 5; d++) {
        const slot = slotMap.get(`${d}-${period}`);
        if (!slot) continue;
        rowH = Math.max(
          rowH,
          measureLines(
            slot.subject.name,
            slot.room ? `Zimmer ${slot.room}` : '',
            `${slot.teacher.firstName} ${slot.teacher.lastName}`,
            dayColW
          )
        );
      }

      ensureSpace(rowH);

      // Zeitspalte
      paintCell(left, y, timeColW, rowH, TIME_BG);
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);
      doc.text(row.label, left + cellPad, y + 8, {
        width: timeColW - cellPad * 2,
        align: 'center',
      });
      if (timeLabel) {
        doc.fillColor('#374151').font('Helvetica').fontSize(7);
        doc.text(timeLabel, left + cellPad, y + 22, {
          width: timeColW - cellPad * 2,
          align: 'center',
        });
      }

      // Tageszellen – jede Zelle gefüllt + gerahmt
      for (let d = 1; d <= 5; d++) {
        const x = left + timeColW + (d - 1) * dayColW;
        const slot = slotMap.get(`${d}-${period}`);

        if (!slot) {
          paintCell(x, y, dayColW, rowH, EMPTY_BG);
          continue;
        }

        const colors = subjectColor(slot.subject.name);
        paintCell(x, y, dayColW, rowH, colors.bg);

        const textW = dayColW - cellPad * 2;
        let ty = y + cellPad + 2;

        doc.fillColor(colors.fg).font('Helvetica-Bold').fontSize(8);
        doc.text(slot.subject.name, x + cellPad, ty, { width: textW });
        ty += doc.heightOfString(slot.subject.name, { width: textW }) + 2;

        if (slot.room) {
          const roomText = `Zimmer ${slot.room}`;
          doc.fillColor(colors.fg).font('Helvetica').fontSize(7);
          doc.text(roomText, x + cellPad, ty, { width: textW });
          ty += doc.heightOfString(roomText, { width: textW }) + 2;
        }

        const teacher = `${slot.teacher.firstName} ${slot.teacher.lastName}`;
        doc.fillColor(colors.fg).font('Helvetica').fontSize(7);
        doc.text(teacher, x + cellPad, ty, { width: textW });
      }

      y += rowH;
    }

    // === Feiertage als gerahmte Tabelle ===
    y += 16;
    ensureSpace(50);

    doc.fillColor(BRAND_RED).font('Helvetica-Bold').fontSize(11);
    doc.text('Unterrichtsfreie Zeit / Feiertage', left, y, { lineBreak: false });
    y += 16;

    const holColDate = pageWidth * 0.42;
    const holColName = pageWidth - holColDate;
    const holHeadH = 20;
    const holRowH = 18;

    ensureSpace(holHeadH + 20);
    paintCell(left, y, holColDate, holHeadH, HEADER_BG);
    paintCell(left + holColDate, y, holColName, holHeadH, HEADER_BG);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    doc.text('Datum', left + 6, y + 6, { width: holColDate - 12, lineBreak: false });
    doc.text('Bezeichnung', left + holColDate + 6, y + 6, {
      width: holColName - 12,
      lineBreak: false,
    });
    y += holHeadH;

    if (holidays.length === 0) {
      ensureSpace(holRowH);
      paintCell(left, y, holColDate, holRowH, '#F9FAFB');
      paintCell(left + holColDate, y, holColName, holRowH, '#F9FAFB');
      doc.fillColor('#6B7280').font('Helvetica').fontSize(8);
      doc.text('Keine Feiertage erfasst.', left + 6, y + 5, {
        width: pageWidth - 12,
        lineBreak: false,
      });
      y += holRowH;
    } else {
      holidays.forEach((h, idx) => {
        ensureSpace(holRowH);
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#E5E7EB';
        paintCell(left, y, holColDate, holRowH, bg);
        paintCell(left + holColDate, y, holColName, holRowH, bg);

        const dateStr = h.date.toLocaleDateString('de-CH', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        doc.fillColor('#111827').font('Helvetica').fontSize(8);
        doc.text(dateStr, left + 6, y + 5, { width: holColDate - 12, lineBreak: false });
        doc.font('Helvetica-Bold').text(h.name, left + holColDate + 6, y + 5, {
          width: holColName - 12,
          lineBreak: false,
        });
        y += holRowH;
      });
    }

    // === Legende mit Farbfeldern ===
    if (subjectsUsed.length > 0) {
      y += 16;
      ensureSpace(40);
      doc.fillColor(BRAND_RED).font('Helvetica-Bold').fontSize(11);
      doc.text('Legende (Fächer)', left, y, { lineBreak: false });
      y += 14;

      const swatch = 14;
      const gap = 8;
      const colW = (pageWidth - gap) / 2;
      let col = 0;
      let rowY = y;

      for (const name of subjectsUsed) {
        ensureSpace(swatch + 8);
        if (col === 0) rowY = y;
        const x = left + col * (colW + gap);
        const colors = subjectColor(name);

        paintCell(x, rowY, swatch, swatch, colors.bg);
        doc.fillColor('#111827').font('Helvetica').fontSize(8);
        doc.text(name, x + swatch + 6, rowY + 2, {
          width: colW - swatch - 10,
          lineBreak: false,
        });

        col += 1;
        if (col >= 2) {
          col = 0;
          y = rowY + swatch + 6;
        }
      }
      if (col !== 0) y = rowY + swatch + 6;
    }

    doc.end();
  });

  return { buffer, className: classRecord.name };
}
