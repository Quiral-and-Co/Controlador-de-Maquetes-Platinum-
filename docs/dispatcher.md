# Dispatcher — JMRI TC Gold Custom 1.0 alpha

## Què incorpora

El Dispatcher alpha és un despatxador de proves sobre els blocs lògics definits al projecte. Mostra els blocs agrupats per nivell i permet assignar-los un estat simulat:
- **Desconegut:** estat inicial i estat segur per defecte; no es pot reservar.
- **Lliure:** l'usuari el marca manualment com a lliure per a proves.
- **Ocupat:** el bloc no es pot reservar i qualsevol itinerari que el tingui reservat s'allibera.

Els itineraris són seqüències ordenades d'identificadors de bloc. Per crear-ne un, introdueix el nom i els IDs separats per comes, per exemple `B01, B02, B03`.

## Regles de reserva

1. Tots els blocs de l'itinerari han d'existir.
2. Tots els blocs han d'estar en estat **Lliure**.
3. Un bloc no pot estar reservat per un altre itinerari.
4. La reserva s'aplica a tots els blocs de la ruta o no s'aplica a cap.
5. Quan un bloc reservat passa a **Ocupat** o **Desconegut**, el simulador allibera la reserva de l'itinerari afectat.
6. Les definicions de rutes es desen a `dispatcher.routes` en el JSON de maqueta. Els estats i reserves són volàtils i es reinicien en recarregar.

## Prova manual

1. Obre l'editor i crea dos o tres blocs a la secció **Blocs lògics**.
2. A Dispatcher, canvia'ls a **Lliure**.
3. Crea una ruta, per exemple `Prova estació` amb `B01, B02`.
4. Prem **Reservar**. Els blocs apareixeran amb la reserva associada.
5. Crea una segona ruta que comparteixi `B02`. La reserva ha de fallar per conflicte.
6. Canvia `B02` a **Ocupat**. La ruta reservada s'ha d'alliberar automàticament.
7. Torna `B02` a **Desconegut** i comprova que no es pot reservar cap ruta que el contingui.

## Límits de seguretat i propera integració

Aquesta versió no llegeix els sensors JMRI per calcular ocupació i no envia ordres a la central DCC, locomotores, desviaments ni senyals. L'estat manual és exclusivament de simulació i no s'ha d'utilitzar per circular trens.

La següent fase ha d'afegir una capa d'ocupació real que només accepti sensors i blocs verificats, tracti els estats desconeguts com a bloquejats i mantingui el Dispatcher en mode de supervisió fins que s'hagin provat interbloquejos, pèrdua de comunicació i parada d'emergència física independent.
