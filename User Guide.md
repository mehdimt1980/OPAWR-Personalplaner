
# OP-Personalplaner - Benutzerhandbuch

Willkommen beim OP-Personalplaner. Diese Anwendung unterstützt Sie bei der täglichen Einteilung des OP-Personals, erkennt Konflikte automatisch und hilft Ihnen, den optimalen Plan für jeden Saal zu erstellen.

## 1. Erste Schritte

### Anmeldung
1. Öffnen Sie die Anwendung im Browser.
2. Geben Sie Ihren **Benutzernamen** und Ihr **Passwort** ein.
   * **Standard-Zugang (Erstanmeldung):** Benutzer `admin`, Passwort `admin123`.
   * *Wichtig:* Ändern Sie das Passwort sofort bzw. legen Sie eigene Benutzer an!
   * *Hinweis:* Nach 5 Fehlversuchen wird der Zugang für 15 Minuten gesperrt.

### Die Oberfläche
*   **Linke Leiste (Menü):** Navigation zwischen Tagesplan, Wochenplan, Personal und Analysen.
*   **Hauptbereich:** Zeigt die OP-Säle als Karten oder die Wochenübersicht.
*   **Rechte Leiste (Ressourcen):** Zeigt verfügbares, noch nicht zugewiesenes Personal.

---

## 2. Täglicher Workflow (Tagesplanung)

### Schritt 1: OP-Programm importieren
1. Klicken Sie in der linken Leiste auf das **Import-Symbol** (Pfeil nach oben).
2. Wählen Sie die KIS-Export-Datei (CSV) aus.
3. Die Säle werden automatisch generiert und mit Operationen gefüllt.

### Schritt 2: Automatische Zuweisung
1. Klicken Sie oben rechts auf den blauen Button **"Auto-Zuweisung"**.
2. Das System verteilt das Personal basierend auf Qualifikation, Verfügbarkeit und Vermeidung von Doppelbelegungen.

### Schritt 3: Manuelle Anpassung (Drag & Drop)
*   **Verschieben:** Ziehen Sie eine Person von der rechten Leiste in einen Saal.
*   **Tauschen:** Ziehen Sie eine Person auf eine andere Person, um die Plätze zu tauschen.
*   **Entfernen:** Klicken Sie auf eine Person im Saal und dann auf das "X" oder ziehen Sie sie zurück in die Seitenleiste.

### Schritt 4: Konflikte lösen (Der Zauberstab)
Wenn ein Saal rot umrandet ist (Warnung "Doppelt verplant" oder "Fehlende Qualifikation"):
1. Klicken Sie auf den **Zauberstab-Button** neben der Warnmeldung.
2. Wählen Sie im Fenster einen der Vorschläge aus, um das Problem sofort zu beheben.

---

## 3. Analysen & Fairness (Dashboard)

Klicken Sie im Menü links auf **"Analyse"**, um die Fairness und Auslastung zu prüfen.

### Fairness & Rollenverteilung
Das Diagramm zeigt, wie Mitarbeiter eingesetzt werden:
*   **Orange Balken:** Einsätze als **Saalleitung/Lead** (Verantwortung).
*   **Blaue Balken:** Einsätze als **Springer** (Unterstützung).
*   *Ziel:* Vermeiden Sie, dass qualifizierte Mitarbeiter nur als Springer "verheizt" werden oder andere permanent die Last der Leitung tragen.

### Saal-Rotation
Das Diagramm "Saal-Rotation" zeigt, in welchen Räumen ein Mitarbeiter arbeitet.
*   **Bunte Balken:** Gute Rotation (Mitarbeiter kennt viele Säle).
*   **Einfarbige Balken:** Mitarbeiter "klebt" in einem Saal (Silo-Bildung).

---

## 4. Öffentliche Anzeige (TV Modus)

Der "TV Modus" ist eine schreibgeschützte Ansicht für große Bildschirme im OP-Flur.

### Einrichtung
1. Verbinden Sie einen PC oder Smart-TV mit dem Netzwerk.
2. Öffnen Sie den Browser und navigieren Sie zur Adresse der Anwendung, hängen Sie `/view` an.
   * Beispiel: `https://op-planer.klinikum.de/view`
3. Alternativ: Klicken Sie in der Hauptanwendung in der linken Leiste unten auf das **Monitor-Symbol ("TV Modus")**, um die Ansicht in einem neuen Tab zu öffnen.

### Funktionen der Anzeige
*   **Automatische Aktualisierung:** Der Bildschirm lädt alle 30 Sekunden die neuesten Daten. Es ist keine Mausinteraktion notwendig.
*   **Anzeige:** Zeigt den Plan für den **heutigen Tag** (oder den zuletzt bearbeiteten Tag).
*   **Vollbild:** Drücken Sie **F11** auf der Tastatur, um den Browser in den Vollbildmodus zu schalten.

---

## 5. Wochenplanung & Dienste

Wechseln Sie über das Menü links zur **"Woche"** (Kalender-Icon).
*   Ändern Sie Dienste (T1, Spät, Nacht, Frei) per Dropdown für jeden Mitarbeiter.
*   Urlaub wird gelb, Krankheit rot dargestellt.
*   Importieren Sie Dienstpläne via CSV über den "Import"-Button oben rechts.

---

## 6. KI-Assistent

Klicken Sie oben rechts auf **"AI Assistent"**.
Stellen Sie Fragen wie:
*   *"Wer kann Saal 5 übernehmen?"*
*   *"Haben wir noch einen Urologie-Experten frei?"*

---

## 7. System-Konfiguration & Regeln (Admin)

Die Anwendung ist als "Configurable Platform" aufgebaut. Das bedeutet, Sie können Säle und die Entscheidungslogik der KI anpassen, ohne einen Programmierer zu rufen.

Öffnen Sie dazu das Menü **"Daten"** (Datenbank-Symbol in der linken Leiste, unter "Mehr") und wählen Sie den gewünschten Reiter.

### A. Benutzerverwaltung
Hier verwalten Sie die Zugänge für das Personal.
*   **Benutzer anlegen:** Vergeben Sie Benutzername und Rolle.
*   **Rollen:** Admin (Vollzugriff), Editor (Planer), Viewer (Nur Lesen).

### B. Saal-Management
Hier definieren Sie die Architektur Ihres OPs.
*   **Saal hinzufügen/umbenennen:** Passen Sie die Räume an Ihre Klinik an.
*   **Fachabteilungen:** Legen Sie fest, welche Disziplinen in welchem Saal operieren.

### C. Rules Engine
Hier steuern Sie das "Gehirn" der automatischen Zuweisung.
*   **Gewichtung:** Justieren Sie Schieberegler (z.B. "Lead Bonus"), um das Verhalten der KI zu ändern.
*   **Constraints:** Aktivieren/Deaktivieren Sie harte Regeln wie "Doppelte Leitung verbieten".

---

## 8. Benachrichtigungen (SMS)

Das System kann das Personal automatisch per SMS über den Einsatzplan informieren.

### A. Vorbereitung: Handynummern pflegen
Damit eine SMS gesendet werden kann, muss die Handynummer hinterlegt sein.
1. Öffnen Sie das Menü **"Personal"**.
2. Klicken Sie bei einem Mitarbeiter auf das **Stift-Symbol (Bearbeiten)**.
3. Tragen Sie die Nummer im Feld **"Handynummer (SMS)"** ein (Format: +49...).
4. Speichern Sie den Mitarbeiter.

### B. Tagesplan veröffentlichen (Batch)
Wenn die Planung für den nächsten Tag steht:
1. Klicken Sie oben rechts auf den Button **"Plan Senden"**.
2. Das System zeigt an, wie viele Mitarbeiter eine Nachricht erhalten werden.
3. Bestätigen Sie mit "Senden".
   * *Jeder Mitarbeiter erhält nur seinen eigenen Einsatz (Saal, Rolle, Startzeit).*

### C. Einzel-Benachrichtigung (bei Änderungen)
Wenn Sie kurzfristig jemanden umplanen:
1. Fahren Sie mit der Maus über die Karte des Mitarbeiters (oder tippen Sie auf Touchscreens).
2. Klicken Sie auf das kleine **Sprechblasen-Symbol**.
3. Geben Sie eine kurze Nachricht ein (z.B. *"Bitte doch in Saal 3 kommen"*).
4. Die Nachricht wird sofort gesendet.

---
**Support:** Bei technischen Problemen wenden Sie sich bitte an die IT-Abteilung.
