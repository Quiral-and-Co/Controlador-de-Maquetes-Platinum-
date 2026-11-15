# Home mort · seqüència de vigilància

- Pedal mantingut premut durant la conducció manual.
- Als 30 s: testimoni blau fix.
- Als 33 s: testimoni taronja intermitent i reproducció del MP3 seleccionat al navegador del pupitre.
- Als 36 s: el pont envia una ordre d'emergència WiThrottle a les locomotores manuals i desarma DCC; testimoni vermell fix.
- Resposta: deixar anar i tornar a prémer el pedal en un màxim de 2 s. En prémer de nou, el comptador es reinicia i s'apaguen els avisos. Si no es torna a prémer dins del termini, s'activa l'emergència.
- La pèrdua de heartbeat del navegador durant 2 s també provoca l'emergència.
- La desactivació del watchdog no anul·la les altres portes de seguretat.

**Límit important:** el pedal actual és un control de pantalla, no una entrada de pedal físic. El MP3 es reprodueix al navegador. L'ordre WiThrottle no certifica una frenada física ni garanteix la parada si falla la comunicació o el descodificador. Cal un circuit d'emergència independent que talli la tracció i validar-lo físicament abans d'habilitar DCC.
