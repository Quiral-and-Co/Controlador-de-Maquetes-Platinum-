# Home mort per a la conducció manual

El mòdul deadman-core.js implementa un watchdog de presència per a sessions manuals. Està activat per defecte i s'aplica a qualsevol locomotora adquirida en mode MANUAL; les circulacions AUTO no depenen d'aquest mecanisme.

- La interfície exigeix mantenir premut **Mantenir premut per conduir**. En deixar-lo anar, es demana velocitat zero.
- El pont local exigeix una concessió de presència renovada periòdicament; si no arriba cap heartbeat durant 2.000 ms, envia una ordre d'emergència WiThrottle a la locomotora manual i desarma el DCC.
- Després d'un dispar, cal rearmament conscient i una nova adquisició. Una pèrdua de connexió no es considera una parada confirmada.
- L'opció **Desactivar home mort** permet desactivar aquest watchdog per decisió de l'operador. No desactiva la porta general de seguretat, ni les comprovacions de sensors/alimentació, ni el circuit físic d'emergència.
- El watchdog és una protecció addicional de programari; no substitueix un botó d'emergència físic independent ni un tall de tracció cablejat. Les ordres WiThrottle poden no arribar si JMRI, la xarxa o el descodificador fallen.

El timeout inicial és de 2 segons. El nucli admet entre 1 i 10 segons. Les sortides físiques continuen subjectes a safety-core.js i als flags d'habilitació DCC.
