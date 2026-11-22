# Idiomes de l'instal·lador de Windows

L'instal·lador NSIS assistit mostra un selector d'idioma abans de començar la instal·lació:

- Català (ca_ES), idioma predeterminat (LCID de Windows 1027).
- Espanyol (es_ES).
- Anglès (en_US).

La selecció controla l'idioma de les pàgines i missatges de l'assistent NSIS. No implica per si sola que tota la interfície de l'aplicació estigui traduïda: la localització completa de la interfície és una tasca separada i s'ha de validar amb proves específiques.

Validació local:

```bash
node tests/installer-language.cjs
```


El compilador NSIS té `warningsAsErrors: false` perquè el paquet MultiUser no inclou una cadena de traducció catalana (`MULTIUSER_TEXT_INSTALLMODE_TITLE`). NSIS utilitza el text alternatiu anglès per a aquesta cadena, en lloc d'interrompre la generació de l'instal·lador. La resta de missatges de l'assistent continuen utilitzant l'idioma seleccionat quan hi ha traducció disponible.
