# Sistema d’emergència global

## Política fail-safe
- El sistema s'inicialitza bloquejat.
- Un disparador posa el pestell global en estat actiu, desarma DCC i cancel·la adquisicions/ordres pendents.
- L'ordre global d'aturada WiThrottle és una ordre de programari; no substitueix el tall físic independent.
- El rearmament exigeix acció explícita de l'operador, JMRI i pont connectats, CS2 confirmada en OFF i totes les circulacions aturades.
- El rearmament no arma DCC ni posa la CS2 en ON. Després cal una seqüència separada d'inspecció i habilitació.

## Auditoria
Cada disparador i rearmament registra tipus, motiu, origen, data ISO 8601 i generació del pestell. La interfície haurà de mostrar l'historial i desar-ne una còpia persistent.

## Límits
Aquest mòdul és una interprotecció de programari, no un relé de seguretat ni un enclavament certificat. Manteniu una parada física independent que talli la tracció. Les proves automatitzades no substitueixen la validació a la maqueta.
