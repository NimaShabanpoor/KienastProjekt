/** Modulbeschreibungen gemäss Benedict-Stundenplan (IT1b-Beispiel). */
export const MODULE_LEGEND: Record<string, string> = {
  ABU: 'Allgemeinbildender Unterricht',
  'Modul 114': 'Codierungs-, Kompressions- und Verschlüsselungsverfahren einsetzen',
  'Modul 122': 'Abläufe mit Scripts in der Systemadministration automatisieren',
  'Modul 123': 'Serverdienste in Betrieb nehmen',
  'Modul 164': 'Datenbanken erstellen und Daten einfügen',
  'Modul 231': 'Datenschutz und Datensicherheit anwenden',
  'Modul 293': 'Webauftritt erstellen und veröffentlichen',
  'ÜK-Modul 106': 'Datenbanken abfragen, bearbeiten und warten',
  'Modul 106': 'Datenbanken abfragen, bearbeiten und warten',
  'ÜK-Modul 216': 'Internet of Everything-Endgeräte in bestehende Plattform integrieren',
  'Modul 216': 'Internet of Everything-Endgeräte in bestehende Plattform integrieren',
  Mathematik: 'Mathematik',
  Englisch: 'Englisch',
  'Nachhilfe Mathematik': 'Nachhilfe Mathematik',
  'Nachhilfe Informatik-Module': 'Nachhilfe Informatik-Module',
};

export function moduleLegendLine(name: string): string {
  const desc = MODULE_LEGEND[name];
  if (!desc || desc === name) return name;
  return `${name}: ${desc}`;
}
