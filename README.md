# CAM Cash — sito

Dashboard personale (statica, GitHub Pages). I dati sono solo in `data.enc.json`, cifrato (AES-256-GCM, chiave da password con PBKDF2-SHA256): senza password il file è illeggibile.
`data.enc.json` viene rigenerato dal programma `camcash` (`python -m engine export`) a ogni aggiornamento del file Excel.
