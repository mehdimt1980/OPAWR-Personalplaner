
# ⚙️ Handbuch: Daten & Konfiguration

## Übersicht
Der Bereich **Daten & Konfiguration** ist das "Gehirn" der Anwendung. Hier definieren Sie die Struktur Ihres OPs, die Arbeitszeiten und die Regeln, nach denen die KI Entscheidungen trifft.

**Zugriff:** Klicken Sie in der linken Seitenleiste auf das **"Mehr"**-Menü (drei Punkte) und dann auf **"Daten"** (Datenbank-Icon).

---

## 1. Tab: Backup & Wartung
*Datensicherung und System-Reset*

Da die Anwendung Daten primär lokal und in der Cloud speichert, ist regelmäßiges Sichern wichtig, bevor Sie große Änderungen vornehmen.

*   **Backup herunterladen:**
    *   Erstellt eine `.json`-Datei mit allen aktuellen Daten (Personal, Säle, Pläne, Regeln).
    *   *Empfehlung:* Einmal wöchentlich oder vor Regeländerungen durchführen.
*   **Backup wiederherstellen:**
    *   Lädt eine zuvor gespeicherte `.json`-Datei hoch und überschreibt den aktuellen Stand.
*   **Standard-Daten laden (Reset):**
    *   Setzt das System auf die "Werkseinstellungen" zurück.
    *   **Achtung:** Löscht alle Ihre eingetragenen Mitarbeiter und Pläne! Nur bei Erstinbetriebnahme nutzen.
*   **Datenbank leeren:**
    *   Löscht alles. Für Datenschutz-Bereinigung.

---

## 2. Tab: Säle (Raum-Konfiguration)
*Abbildung der OP-Architektur*

Hier legen Sie fest, welche Räume existieren und welche Disziplinen dort operieren.

### Fachabteilungen (Departments)
Oben sehen Sie die Liste der Fachabteilungen (z.B. UCH, ACH, GYN).
*   **Hinzufügen:** Geben Sie ein Kürzel (z.B. "NEURO") ein und klicken Sie auf `+`.
*   **Bedeutung:** Diese Kürzel müssen mit den Fähigkeiten (Skills) der Mitarbeiter übereinstimmen.

### Saal-Liste
Für jeden Saal können Sie definieren:
1.  **Name:** Der Anzeigename (z.B. "SAAL 1").
2.  **Zuweisbare Abteilungen:** Klicken Sie auf die Kürzel (z.B. `UCH`), um festzulegen, welche Disziplinen in diesem Saal *primär* operieren.
    *   *Logik:* Wenn Saal 1 als `UCH` markiert ist, sucht die KI bevorzugt nach Personal mit "UCH: Expert" Status.
3.  **Eigenschaften (Tags):**
    *   **PRIORITY:** Wenn aktiviert, versucht die KI diesen Saal **zuerst** zu besetzen. Wichtig für Notfall-Säle oder Robotik-Säle, wo spezialisiertes Personal knapp ist.

---

## 3. Tab: Schichten (Arbeitszeiten)
*Definition der Dienstkürzel*

Damit das System weiß, wer wann verfügbar ist, müssen die Kürzel aus Ihrem Dienstplan definiert werden.

*   **Code:** Das Kürzel, wie es in der CSV steht (z.B. `T1`, `N`, `S44`).
*   **Label:** Anzeigename auf der Karte.
*   **Zeiten:** Start- und Endzeit (z.B. 07:00 - 15:30).
*   **Farbe:** Visuelle Darstellung im Plan.
*   **Erholung (Wichtig!):**
    *   Wenn dieser Haken gesetzt ist, wird der Mitarbeiter am **Folgetag** automatisch für die Planung gesperrt (Status: Ruhezeit).
    *   *Muss aktiviert sein für:* Nachtdienste (N) und 24h-Dienste (BD).

---

## 4. Tab: Regeln (KI-Steuerung)
*Feinjustierung der Entscheidungslogik*

Hier bestimmen Sie, was der KI wichtig ist. Sie vergeben "Punkte" (Bonus) oder "Strafen" (Malus) für bestimmte Konstellationen.

### Gewichtung (Slider)
*   **LEAD_MATCH_BONUS:** Punkte, wenn eine fachspezifische Leitung (z.B. "Leitung UCH") in "ihrem" Saal (UCH) ist. (Hoher Wert = Strenge Hierarchie).
*   **EXPERT_MATCH_BONUS:** Punkte für einen passenden Experten im Saal.
*   **SPRINGER_EXPERT_BONUS:** Punkte, wenn auch der Springer (2. Mann) ein Experte ist. (Niedriger Wert empfohlen, um Experten für andere Säle zu sparen).
*   **JOKER_PENALTY:** Abzug, wenn ein "Joker" (Student/Praktikant) eingeteilt wird.
*   **DOUBLE_LEAD_PENALTY:** Abzug, wenn zwei Leitungen im selben Saal sind (Ineffizient).

### Constraints (Harte Regeln)
*   **ALLOW_DOUBLE_LEAD:** Wenn deaktiviert, warnt das System bei zwei Leitungen in einem Saal.
*   **REQUIRE_ONE_EXPERT:** Wenn aktiviert, erscheint ein **roter Fehler**, wenn kein Experte im Saal ist. Wenn deaktiviert, nur eine gelbe Warnung.
*   **ENABLE_UNDERSTAFFING_WARNING:** Warnt bei < 2 Personen.

---

## 5. Tab: Eingriffe (OP-Regeln & Umsatz)
*Datenbasis für Smart Rescheduling*

Hier definieren Sie, wie das System spezifische Operationen bewerten soll. Dies ist entscheidend für die **Umplanungs-Vorschläge** und die Umsatz-Berechnung.

*   **Keywords:** Stichworte, nach denen im OP-Plan gesucht wird (z.B. "tep, prothese"). Findet das System eines dieser Wörter im Import, wird die Regel angewendet.
*   **Umsatz (€):** Der geschätzte Erlös dieser OP. Wichtig für die Priorisierung bei Saal-Schließungen ("Revenue Protection").
*   **Dauer (Min):** Die geschätzte Schnitt-Naht-Zeit. Hilft der KI, Lücken im Plan exakt zu füllen.
*   **Priorität:**
    *   *HIGH:* Diese OPs sollten keinesfalls verschoben werden.
    *   *MEDIUM/LOW:* Können eher verschoben werden.
*   **Zwang (Dept):** Optional. Wenn gesetzt, wird die OP *immer* dieser Abteilung zugeordnet (z.B. "Da Vinci" -> "DA_VINCI"), egal was im CSV steht.

---

## 6. Tab: Logik (Intelligenz)
*Text-Erkennung und Spezial-Regeln*

### CSV Parsing Keywords
Hier bringen Sie dem System bei, wie es Ihre Excel-Listen lesen soll.
*   **Saalleitung Keywords:** Wenn in der Spalte "Rolle" das Wort `leitung` oder `senior` steht -> Mitarbeiter wird als Führungskraft markiert.
*   **Joker Keywords:** Bei `student` oder `praktikant` -> Mitarbeiter wird als Joker markiert (darf nicht allein leiten).
*   **Ignorieren (Exclusion):** Mitarbeiter mit `admin` oder `sekretariat` werden gar nicht erst importiert oder bei der Auto-Zuweisung ignoriert.

### Special Capability Rules (Fortgeschritten)
Hier definieren Sie Abhängigkeiten, die über einfache Fachabteilungen hinausgehen (z.B. Robotik oder Strahlenschutz).

**Beispiel: Da Vinci Roboter**
1.  **Trigger (Auslöser):** `DA_VINCI`
    *   Das System prüft: Hat der Saal das Tag `DA_VINCI`? ODER findet im Saal eine OP statt, die der Fachabteilung `DA_VINCI` zugeordnet ist?
2.  **Benötigter Skill:** `DA_VINCI`
    *   Wenn Ja -> Dann **muss** mindestens einer der zugewiesenen Mitarbeiter den Skill "DA_VINCI" im Profil haben.
3.  **Min. Level:** `Expert`
    *   Der Mitarbeiter muss zwingend den Status "Expert" haben. Junior reicht nicht.

---

## 7. Tab: System (Import & Anzeige)
*Technische Grundeinstellungen*

### Zeitleiste
*   **Startzeit / Endzeit:** Legt fest, welcher Stundenbereich im grafischen Zeitstrahl der Saalkarten angezeigt wird (Standard: 07:00 - 17:00).

### CSV Spalten-Erkennung (Mapping)
Damit der Import funktioniert, muss das System wissen, wie die Spalten in Ihrer Export-Datei heißen.
*   Beispiel: Wenn Ihre Spalte für den OP-Beginn "Schnittzeit" heißt, fügen Sie hier das Wort "schnitt" unter **Startzeit** hinzu.
*   Das System sucht in der Kopfzeile der CSV-Datei nach diesen Begriffen, um die Daten automatisch zuzuordnen.
