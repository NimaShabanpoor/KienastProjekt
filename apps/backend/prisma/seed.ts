// Seed-Daten für die Entwicklungsumgebung
// Erstellt Demo-Benutzer, Klassen, Schüler und Testdaten

import { PrismaClient, Role, TimetableRowType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_TIMETABLE_STRUCTURE } from '../src/config/timetable';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seed-Daten werden geladen...');

  // --------------------------------------------------------
  // Benutzer erstellen
  // --------------------------------------------------------
  const passwordHash = await bcrypt.hash('Schuladmin1234!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@itbenedickt.ch' },
    update: { passwordHash, firstName: 'Frau', lastName: 'Kienast' },
    create: {
      email: 'admin@itbenedickt.ch',
      passwordHash,
      firstName: 'Frau',
      lastName: 'Kienast',
      role: Role.ABTEILUNGSLEITUNG,
    },
  });

  const lehrer1 = await prisma.user.upsert({
    where: { email: 'mueller@itbenedickt.ch' },
    update: { passwordHash },
    create: {
      email: 'mueller@itbenedickt.ch',
      passwordHash,
      firstName: 'Thomas',
      lastName: 'Müller',
      role: Role.LEHRPERSON,
    },
  });

  const lehrer2 = await prisma.user.upsert({
    where: { email: 'weber@itbenedickt.ch' },
    update: { passwordHash },
    create: {
      email: 'weber@itbenedickt.ch',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Weber',
      role: Role.LEHRPERSON,
    },
  });

  console.log(`Benutzer erstellt: ${admin.email}, ${lehrer1.email}, ${lehrer2.email}`);

  // --------------------------------------------------------
  // Klassen erstellen
  // --------------------------------------------------------
  const klasse1 = await prisma.class.upsert({
    where: { name_semester_schoolYear: { name: 'INF-2023-A', semester: 1, schoolYear: '2024/25' } },
    update: { homeroomTeacherId: lehrer1.id },
    create: { name: 'INF-2023-A', semester: 1, schoolYear: '2024/25', homeroomTeacherId: lehrer1.id },
  });

  const klasse2 = await prisma.class.upsert({
    where: { name_semester_schoolYear: { name: 'INF-2023-B', semester: 1, schoolYear: '2024/25' } },
    update: { homeroomTeacherId: lehrer2.id },
    create: { name: 'INF-2023-B', semester: 1, schoolYear: '2024/25', homeroomTeacherId: lehrer2.id },
  });

  console.log(`Klassen erstellt: ${klasse1.name}, ${klasse2.name}`);

  // --------------------------------------------------------
  // Schüler erstellen
  // --------------------------------------------------------
  const schueler = [
    { firstName: 'Anna', lastName: 'Meier', email: 'anna.meier@student.ch', gender: 'F' },
    { firstName: 'Lukas', lastName: 'Zimmermann', email: 'lukas.zimm@student.ch', gender: 'M' },
    { firstName: 'Lena', lastName: 'Braun', email: 'lena.braun@student.ch', gender: 'F' },
    { firstName: 'Jan', lastName: 'Fischer', email: 'jan.fischer@student.ch', gender: 'M' },
    { firstName: 'Sophie', lastName: 'Koch', email: 'sophie.koch@student.ch', gender: 'F' },
  ];

  for (const s of schueler) {
    await prisma.student.upsert({
      where: { email: s.email },
      update: {},
      create: { ...s, classId: klasse1.id },
    });
  }

  console.log(`${schueler.length} Schüler erstellt`);

  // --------------------------------------------------------
  // Fächer / Module (schulweit)
  // --------------------------------------------------------
  const teacherPassword = passwordHash;

  async function ensureTeacher(
    email: string,
    firstName: string,
    lastName: string
  ): Promise<{ id: string; firstName: string; lastName: string }> {
    return prisma.user.upsert({
      where: { email },
      update: { passwordHash: teacherPassword, firstName, lastName, role: Role.LEHRPERSON, isActive: true },
      create: {
        email,
        passwordHash: teacherPassword,
        firstName,
        lastName,
        role: Role.LEHRPERSON,
      },
    });
  }

  const carsauro = await ensureTeacher('carsauro@itbenedickt.ch', 'Herr', 'Carsauro');
  const arani = await ensureTeacher('arani@itbenedickt.ch', 'Herr', 'Arani');
  const meili = await ensureTeacher('meili@itbenedickt.ch', 'Herr', 'Meili');
  const kaltenrieder = await ensureTeacher('kaltenrieder@itbenedickt.ch', 'Frau', 'Kaltenrieder');
  const caradonna = await ensureTeacher('caradonna@itbenedickt.ch', 'Herr', 'Caradonna');
  const senn = await ensureTeacher('senn@itbenedickt.ch', 'Herr', 'Senn');
  const jedamzik = await ensureTeacher('jedamzik@itbenedickt.ch', 'Herr', 'Jedamzik');
  const digiacomo = await ensureTeacher('digiacomo@itbenedickt.ch', 'Frau Dr.', 'Di Giacomo');

  async function ensureSubject(
    name: string,
    color: string,
    teacherIds: string[]
  ): Promise<{ id: string; name: string }> {
    const existing = await prisma.subject.findUnique({ where: { name } });
    if (existing) {
      await prisma.subject.update({
        where: { id: existing.id },
        data: { color, isActive: true },
      });
      await prisma.subjectTeacher.deleteMany({ where: { subjectId: existing.id } });
      await prisma.subjectTeacher.createMany({
        data: [...new Set(teacherIds)].map((teacherId) => ({ subjectId: existing.id, teacherId })),
      });
      return existing;
    }
    return prisma.subject.create({
      data: {
        name,
        color,
        teachers: { create: [...new Set(teacherIds)].map((teacherId) => ({ teacherId })) },
        gradeCategories: {
          create: [
            { name: 'Prüfung', weight: 0.6 },
            { name: 'Mündlich', weight: 0.4 },
          ],
        },
      },
    });
  }

  const mathe = await ensureSubject('Mathematik', '#2563EB', [meili.id, lehrer1.id]);
  const englisch = await ensureSubject('Englisch', '#D97706', [senn.id, lehrer2.id]);
  const modul106 = await ensureSubject('ÜK-Modul 106', '#0EA5E9', [carsauro.id, arani.id]);
  const modul114 = await ensureSubject('Modul 114', '#8B5CF6', [meili.id]);
  const modul122 = await ensureSubject('Modul 122', '#F59E0B', [arani.id]);
  const modul123 = await ensureSubject('Modul 123', '#10B981', [arani.id]);
  const modul164 = await ensureSubject('Modul 164', '#EF4444', [caradonna.id]);
  const modul231 = await ensureSubject('Modul 231', '#6366F1', [caradonna.id]);
  const modul293 = await ensureSubject('Modul 293', '#EC4899', [carsauro.id]);
  const modul216 = await ensureSubject('ÜK-Modul 216', '#14B8A6', [jedamzik.id]);
  const abu = await ensureSubject('ABU', '#64748B', [kaltenrieder.id]);
  const nachhilfeMathe = await ensureSubject('Nachhilfe Mathematik', '#7C3AED', [digiacomo.id]);
  const nachhilfeInf = await ensureSubject('Nachhilfe Informatik-Module', '#059669', [jedamzik.id]);

  console.log('Module erstellt (schulweit, mehrere Lehrpersonen möglich)');

  const it1b = await prisma.class.upsert({
    where: { name_semester_schoolYear: { name: 'IT1b', semester: 2, schoolYear: '2024/25' } },
    update: { isActive: true },
    create: { name: 'IT1b', semester: 2, schoolYear: '2024/25' },
  });

  const it1bSchueler = [
    { firstName: 'Noah', lastName: 'Berisha', email: 'noah.berisha@student.ch', gender: 'M' },
    { firstName: 'Mia', lastName: 'Huber', email: 'mia.huber@student.ch', gender: 'F' },
    { firstName: 'Leon', lastName: 'Steiner', email: 'leon.steiner@student.ch', gender: 'M' },
  ];
  for (const s of it1bSchueler) {
    await prisma.student.upsert({
      where: { email: s.email },
      update: { classId: it1b.id, isActive: true },
      create: { ...s, classId: it1b.id },
    });
  }

  const structureCount = await prisma.timetableStructureRow.count();
  const maxPeriodBefore = (await prisma.timetableStructureRow.aggregate({ _max: { period: true } }))
    ._max.period ?? 0;
  if (structureCount === 0 || maxPeriodBefore < 11) {
    await prisma.timetableStructureRow.deleteMany();
    let lessonPeriod = 0;
    for (let i = 0; i < DEFAULT_TIMETABLE_STRUCTURE.length; i++) {
      const row = DEFAULT_TIMETABLE_STRUCTURE[i]!;
      const period = row.type === 'LESSON' ? ++lessonPeriod : null;
      await prisma.timetableStructureRow.create({
        data: {
          sortOrder: i + 1,
          type: row.type as TimetableRowType,
          label: row.label,
          startTime: row.startTime ?? null,
          endTime: row.endTime ?? null,
          period,
        },
      });
    }
  }

  type SampleSlot = {
    dayOfWeek: number;
    period: number;
    subjectId: string;
    teacherId: string;
    room: string;
  };

  const sampleSlots: SampleSlot[] = [
    // Montag
    { dayOfWeek: 1, period: 3, subjectId: mathe.id, teacherId: meili.id, room: '1. OG 132' },
    { dayOfWeek: 1, period: 4, subjectId: modul122.id, teacherId: arani.id, room: '1. OG 137' },
    { dayOfWeek: 1, period: 5, subjectId: modul122.id, teacherId: arani.id, room: '1. OG 137' },
    { dayOfWeek: 1, period: 6, subjectId: abu.id, teacherId: kaltenrieder.id, room: '1. OG 134' },
    { dayOfWeek: 1, period: 9, subjectId: modul164.id, teacherId: caradonna.id, room: '1. OG 135' },
    { dayOfWeek: 1, period: 10, subjectId: modul164.id, teacherId: caradonna.id, room: '1. OG 135' },
    // Dienstag
    { dayOfWeek: 2, period: 2, subjectId: modul114.id, teacherId: meili.id, room: '1. OG 134' },
    { dayOfWeek: 2, period: 3, subjectId: modul114.id, teacherId: meili.id, room: '1. OG 134' },
    { dayOfWeek: 2, period: 4, subjectId: modul293.id, teacherId: carsauro.id, room: '1. OG 136' },
    { dayOfWeek: 2, period: 5, subjectId: modul293.id, teacherId: carsauro.id, room: '1. OG 136' },
    { dayOfWeek: 2, period: 7, subjectId: englisch.id, teacherId: senn.id, room: '1. OG 131' },
    { dayOfWeek: 2, period: 8, subjectId: englisch.id, teacherId: senn.id, room: '1. OG 131' },
    { dayOfWeek: 2, period: 9, subjectId: modul231.id, teacherId: caradonna.id, room: '1. OG 135' },
    { dayOfWeek: 2, period: 10, subjectId: modul231.id, teacherId: caradonna.id, room: '1. OG 135' },
    // Mittwoch
    { dayOfWeek: 3, period: 1, subjectId: modul106.id, teacherId: carsauro.id, room: '1. OG 136' },
    { dayOfWeek: 3, period: 2, subjectId: modul106.id, teacherId: carsauro.id, room: '1. OG 136' },
    { dayOfWeek: 3, period: 4, subjectId: modul123.id, teacherId: arani.id, room: '1. OG 137' },
    { dayOfWeek: 3, period: 5, subjectId: modul123.id, teacherId: arani.id, room: '1. OG 137' },
    { dayOfWeek: 3, period: 7, subjectId: abu.id, teacherId: kaltenrieder.id, room: '1. OG 134' },
    { dayOfWeek: 3, period: 8, subjectId: abu.id, teacherId: kaltenrieder.id, room: '1. OG 134' },
    // Donnerstag
    { dayOfWeek: 4, period: 3, subjectId: mathe.id, teacherId: meili.id, room: '1. OG 132' },
    { dayOfWeek: 4, period: 4, subjectId: modul216.id, teacherId: jedamzik.id, room: '1. OG 135' },
    { dayOfWeek: 4, period: 5, subjectId: modul216.id, teacherId: jedamzik.id, room: '1. OG 135' },
    { dayOfWeek: 4, period: 11, subjectId: nachhilfeMathe.id, teacherId: digiacomo.id, room: '1. OG 132' },
    // Freitag
    { dayOfWeek: 5, period: 2, subjectId: modul106.id, teacherId: arani.id, room: '1. OG 136' },
    { dayOfWeek: 5, period: 3, subjectId: modul106.id, teacherId: arani.id, room: '1. OG 136' },
    { dayOfWeek: 5, period: 6, subjectId: abu.id, teacherId: kaltenrieder.id, room: '1. OG 134' },
    { dayOfWeek: 5, period: 11, subjectId: nachhilfeInf.id, teacherId: jedamzik.id, room: '1. OG 135' },
  ];

  const maxPeriodRow = await prisma.timetableStructureRow.aggregate({ _max: { period: true } });
  const maxPeriod = maxPeriodRow._max.period ?? 0;

  for (const slot of sampleSlots) {
    if (slot.period > maxPeriod) continue;
    await prisma.timetableSlot.upsert({
      where: {
        classId_dayOfWeek_period: {
          classId: it1b.id,
          dayOfWeek: slot.dayOfWeek,
          period: slot.period,
        },
      },
      create: {
        classId: it1b.id,
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        room: slot.room,
      },
      update: {
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        room: slot.room,
      },
    });
  }

  console.log(
    `IT1b Stichprobe: ${it1b.name}, Module ${modul114.name}/${modul122.name}/${modul123.name} u. a., Lehrpersonen Arani, Meili, Carsauro, …`
  );

  // --------------------------------------------------------
  // Heutige Lektion für Anwesenheitstest
  // --------------------------------------------------------
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const existingLesson = await prisma.lesson.findFirst({
    where: { classId: klasse1.id, subjectId: mathe.id, date: today },
  });
  if (!existingLesson) {
    await prisma.lesson.create({
      data: {
        classId: klasse1.id,
        subjectId: mathe.id,
        teacherId: lehrer1.id,
        date: today,
        startTime: '08:00',
        endTime: '09:30',
        room: 'A101',
        isTest: true,
      },
    });
    console.log('Heutige Test-Lektion erstellt');
  } else {
    await prisma.lesson.update({
      where: { id: existingLesson.id },
      data: { isTest: true, teacherId: lehrer1.id, classId: klasse1.id },
    });
  }

  // --------------------------------------------------------
  // Konfiguration setzen
  // --------------------------------------------------------
  await prisma.config.upsert({
    where: { key: 'ABSENCE_THRESHOLD' },
    update: {},
    create: {
      key: 'ABSENCE_THRESHOLD',
      value: JSON.stringify(5),
      description: 'Anzahl unentschuldigter Absenzen bis Alarm ausgelöst wird',
    },
  });

  // Promotionsregel für Klasse 1 setzen
  await prisma.promotionRule.upsert({
    where: { classId_schoolYear: { classId: klasse1.id, schoolYear: '2024/25' } },
    update: {},
    create: {
      classId: klasse1.id,
      schoolYear: '2024/25',
      minAverage: 4.0,
      maxFailing: 1,
      description: 'Notendurchschnitt mind. 4.0, max. 1 Fach unter 4.0',
    },
  });

  console.log('Seed-Daten erfolgreich geladen!');
  console.log('Login: admin@itbenedickt.ch / Schuladmin1234! (Leiter)');
  console.log('Login: mueller@itbenedickt.ch / Schuladmin1234! (Lehrer, Klasse INF-2023-A)');
  console.log('Stundenplan-Stichprobe: Klasse IT1b (2. Semester) – Module und Lehrpersonen aus dem PDF');
}

main()
  .catch((e) => {
    console.error('Seed-Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
