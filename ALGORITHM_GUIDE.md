# 🧠 Handbuch: Die AI-Regeln (Algorithm Tuning)

Der Bereich **"Regeln"** in den *Daten & Konfigurationen* ist das Herzstück der automatischen Zuweisung. Hier definieren Sie die "Persönlichkeit" der Künstlichen Intelligenz. Sie entscheiden, was dem System wichtiger ist: Harte Hierarchie, Mitarbeiter-Wünsche oder maximale Fachkompetenz.

## ⚙️ Wie "denkt" das System? (Das Punkte-Prinzip)

Die automatische Zuweisung funktioniert nach einem **Punkte-System (Scoring)**.
Für jede mögliche Kombination aus *Mitarbeiter* und *Saal* berechnet die KI eine Punktzahl.

*   **Positive Werte (Bonus):** Gute Gründe, diese Person hier einzusetzen (z.B. "Ist Experte", "Ist Mentor").
*   **Negative Werte (Strafe/Penalty):** Gründe dagegen (z.B. "Ist eigentlich Unfallchirurg, soll aber in die Gynäkologie").

Die KI wählt am Ende die Verteilung mit der **höchsten Gesamtpunktzahl**. Indem Sie die Schieberegler bewegen, verändern Sie diese Punktwerte und damit das Verhalten des Systems.

---

## 1. Kompetenz & Sicherheit
*Hier steuern Sie, wie stark die fachliche Eignung gewichtet wird.*

### `EXPERT_MATCH_BONUS` (Experten-Bonus)
*   **Was es tut:** Belohnt das System, wenn ein Mitarbeiter mit Status "Expert" in einem passenden Saal eingesetzt wird (z.B. UCH-Experte in UCH-Saal).
*   **Empfehlung:** Ein hoher Wert sorgt für maximale fachliche Qualität.

### `JUNIOR_MATCH_BONUS` (Junior-Bonus)
*   **Was es tut:** Punkte dafür, dass zumindest ein Junior (Basiswissen) im passenden Saal ist.
*   **Empfehlung:** Sollte deutlich niedriger sein als der Experten-Bonus.

### `SECONDARY_SKILL_BONUS` (Zweit-Skill)
*   **Was es tut:** Belohnt Mitarbeiter, die auch die *anderen* Operationen im Saal beherrschen (wenn z.B. in einem UCH-Saal eine ACH-OP stattfindet). Erhöht die Flexibilität.

### `UNQUALIFIED_PENALTY` (Disqualifikation)
*   **Wichtig:** Dies ist eine sehr hohe **negative Zahl**. Sie verhindert, dass fachfremdes Personal (ohne jegliche Qualifikation für den Saal) dort eingeteilt wird.
*   **Einstellung:** Lassen Sie diesen Wert extrem hoch (z.B. -1.000.000), um Patientensicherheit zu garantieren.

---

## 2. Führung & Hierarchie
*Hier steuern Sie die Besetzung der "Slot 1" Position (Saalleitung).*

### `LEAD_MATCH_BONUS` (Fach-Leitungs-Bonus)
*   **Was es tut:** Der wichtigste Regler für Leitungen. Er belohnt das System massiv, wenn z.B. die "Leitung UCH" im "Saal UCH" steht.
*   **Effekt:** Zieht Leitungen magisch in ihre Stammsäle.

### `LEAD_ROLE_BONUS` (Allgemeiner Leitungs-Bonus)
*   **Was es tut:** Belohnt es, wenn *irgendeine* Saalleitung auf der Position 1 steht (statt eines normalen Mitarbeiters). Sorgt für Disziplin im Saal.

### `WRONG_LEAD_PENALTY` (Falsche Abteilung)
*   **Was es tut:** Bestraft den Einsatz einer Fachleitung in einer fremden Abteilung (z.B. Leitung Gynäkologie leitet den Unfall-Saal).
*   **Tipp:**
    *   *Hoch:* Strenge fachliche Trennung.
    *   *Niedrig:* Flexible Leitungen ("Jeder kann alles leiten").

### `DOUBLE_LEAD_PENALTY` (Doppel-Häuptling)
*   **Was es tut:** Bestraft die Verschwendung von Ressourcen, wenn zwei Saalleitungen im selben Saal sind.

---

## 3. Soziales & Präferenzen (Weiche Faktoren)
*Hier bestimmen Sie, wie sehr das System auf Mitarbeiterwünsche eingeht.*

### `PAIRING_BONUS` (Tandem-Bonus)
*   **Was es tut:** Wenn Sie im Reiter "Tandem" zwei Mitarbeiter gekoppelt haben (z.B. Mentor & Schüler), bestimmt dieser Wert, wie krampfhaft die KI versucht, diese zusammenzulassen.
*   **Empfehlung:** Sollte sehr hoch sein (+20.000), damit Ausbildung immer Vorrang vor perfekter Verteilung hat.

### `DEPT_PRIORITY_BONUS` (Wunsch-Abteilung)
*   **Neu:** Mitarbeiter können jetzt Prioritäten angeben (z.B. 1. UCH, 2. ACH). Dieser Regler bestimmt, wie viele Punkte es gibt, wenn der Wunsch erfüllt wird.

### `DEPT_PRIORITY_MISMATCH_PENALTY` (Wunsch-Missachtung)
*   **Was es tut:** Bestraft das System, wenn es jemanden in eine Abteilung steckt, die *nicht* auf seiner Wunschliste steht.
*   **Effekt:** Erhöhen Sie diesen Wert ("Schmerzfaktor"), wenn Sie Mitarbeiter vor ungeliebten Einsätzen schützen wollen.

### `PREFERRED_ROOM_BONUS` (Lieblingssaal)
*   **Was es tut:** Kleiner Bonus, wenn der Mitarbeiter in seinem im Profil hinterlegten "Lieblingssaal" arbeitet.

---

## 4. Springer & Sonstiges
*Regeln für die zweite Position im Saal.*

### `SPRINGER_EXPERT_BONUS`
*   **Was es tut:** Punkte dafür, dass auch der 2. Mann (Springer) ein Experte ist.
*   **Strategie:** Ein **niedriger** Wert ist oft besser. Warum? Wenn Sie hier viele Punkte geben, steckt die KI zwei Experten in einen Saal (Over-Engineering) und in einem anderen Saal fehlt dann einer.

### `JOKER_PENALTY`
*   **Was es tut:** Bestraft den Einsatz von Studenten/Jokern auf verantwortungsvollen Positionen (Leitung).

---

## 5. Harte Regeln (Constraints)
*Diese Checkboxen steuern Warnmeldungen und harte Ausschlüsse.*

*   **ALLOW_DOUBLE_LEAD:** Wenn deaktiviert, wird eine Warnung angezeigt, wenn zwei Leitungen in einem Saal sind.
*   **REQUIRE_ONE_EXPERT:** Wenn aktiviert, erscheint ein **roter Fehler**, wenn kein einziger Experte im Saal ist. Wenn deaktiviert, erscheint nur eine gelbe Warnung (gut für Notbetrieb).
*   **ENABLE_UNDERSTAFFING_WARNING:** Warnt bei < 2 Personen im Saal.
*   **EXCLUDE_SICK_FROM_ASSIGNMENT:** Kranke Mitarbeiter werden von der Auto-Zuweisung ignoriert (Standard: An).

---

## 🎯 Szenarien: Wie stelle ich die KI ein?

### Szenario A: "Sicherheit & Qualität über alles"
*Sie wollen die medizinisch beste Besetzung, persönliche Wünsche sind zweitrangig.*
1.  Erhöhen Sie **EXPERT_MATCH_BONUS**.
2.  Erhöhen Sie **LEAD_MATCH_BONUS**.
3.  Senken Sie **DEPT_PRIORITY_BONUS**.

### Szenario B: "Mitarbeiter-Zufriedenheit & Ausbildung"
*Sie wollen, dass Wünsche respektiert werden und Mentoren bei ihren Schülern bleiben.*
1.  Erhöhen Sie **PAIRING_BONUS** auf Maximum.
2.  Erhöhen Sie **DEPT_PRIORITY_BONUS**.
3.  Erhöhen Sie **DEPT_PRIORITY_MISMATCH_PENALTY** (Schutz vor ungeliebten Sälen).

### Szenario C: "Mangelverwaltung (Notbetrieb)"
*Sie haben zu wenig Personal und müssen Lücken füllen, egal wie.*
1.  Senken Sie **WRONG_LEAD_PENALTY** massiv (Leitungen müssen fachfremd aushelfen).
2.  Deaktivieren Sie bei den *Harten Regeln* **REQUIRE_ONE_EXPERT** (damit keine Fehler kommen, wenn nur Juniors da sind).

---

## 🛠️ Buttons

*   **Reset auf Standardwerte:** Haben Sie sich "verkonfiguriert" und die Zuweisung macht keinen Sinn mehr? Dieser Button stellt die von den Entwicklern empfohlenen Standardwerte wieder her.
*   **Speichern:** Übernimmt die Änderungen sofort. Der nächste Klick auf "Auto-Zuweisung" nutzt die neuen Regeln.
