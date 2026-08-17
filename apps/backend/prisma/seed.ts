// Seed-Daten für die Entwicklungsumgebung
// Erstellt Demo-Benutzer, Klassen, Schüler und Testdaten

import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seed-Daten werden geladen...');

  // --------------------------------------------------------
  // Benutzer erstellen
  // --------------------------------------------------------
  const passwordHash = await bcrypt.hash('Schuladmin1234!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@itbenedickt.ch' },
    update: {},
    create: {
      email: 'admin@itbenedickt.ch',
      passwordHash,
      firstName: 'Frau',
      lastName: 'Kianash',
      role: Role.ABTEILUNGSLEITUNG,
    },
  });

  const lehrer1 = await prisma.user.upsert({
    where: { email: 'mueller@itbenedickt.ch' },
    update: {},
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
    update: {},
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
    update: {},
    create: { name: 'INF-2023-A', semester: 1, schoolYear: '2024/25' },
  });

  const klasse2 = await prisma.class.upsert({
    where: { name_semester_schoolYear: { name: 'INF-2023-B', semester: 1, schoolYear: '2024/25' } },
    update: {},
    create: { name: 'INF-2023-B', semester: 1, schoolYear: '2024/25' },
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
  // Fächer und Notenkategorien erstellen
  // --------------------------------------------------------
  const matheFach = await prisma.subject.create({
    data: {
      name: 'Mathematik',
      classId: klasse1.id,
      teacherId: lehrer1.id,
      gradeCategories: {
        create: [
          { name: 'Prüfung', weight: 0.6 },
          { name: 'Hausaufgaben', weight: 0.2 },
          { name: 'Mündlich', weight: 0.2 },
        ],
      },
    },
  });

  await prisma.subject.create({
    data: {
      name: 'Englisch',
      classId: klasse1.id,
      teacherId: lehrer2.id,
      gradeCategories: {
        create: [
          { name: 'Prüfung', weight: 0.7 },
          { name: 'Mündlich', weight: 0.3 },
        ],
      },
    },
  });

  console.log(`Fächer für ${klasse1.name} erstellt: ${matheFach.name}, Englisch`);

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
  console.log('Login: admin@itbenedickt.ch / Schuladmin1234!');
  console.log('Login: mueller@itbenedickt.ch / Schuladmin1234!');
}

main()
  .catch((e) => {
    console.error('Seed-Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
