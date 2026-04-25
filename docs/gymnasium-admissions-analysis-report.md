# Gymnasium Admissions Analysis Report

Generated: 2026-04-25T10:01:29.234Z

This report joins parsed 2025 final-admission merit data to the existing 2025 gymnasium national-test/grade deviation dataset by exact normalized school name and municipality.

## Overall

- Parsed admission school aggregates: 258
- NP school aggregates for 2025 terms: 1100
- Exact school+municipality matches: 141
- Pearson r, admission merit vs andel högre: -0.333
- Pearson r, admission merit vs nettoavvikelse (högre-lägre): -0.220

## By Source

| Source | Matched schools | r merit vs högre | r merit vs netto | Merit metric used |
|---|---:|---:|---:|---|
| goteborgsregionen | 29 | -0.551 | -0.461 | unweighted mean |
| storsthlm | 112 | -0.313 | -0.190 | weighted median |

## Highest Matched Net Deviations

| School | Municipality | Admission merit | Andel högre | Andel lägre | Netto | Source |
|---|---|---:|---:|---:|---:|---|
| Bergstrands Gymnasium Märsta | Sigtuna | 111.0 | 70.0 | 10.0 | 60.0 | storsthlm |
| Bergstrands Gymnasium Stockholm | Stockholm | 172.4 | 44.4 | 2.1 | 42.3 | storsthlm |
| Sveriges Ridgymnasium Kungsbacka | Kungsbacka | 181.7 | 45.1 | 4.2 | 40.9 | goteborgsregionen |
| Magelungens Gymnasium Liljeholmen | Stockholm | 167.5 | 45.9 | 6.3 | 39.6 | storsthlm |
| Odengymnasiet | Stockholm | 161.7 | 42.0 | 3.0 | 38.9 | storsthlm |
| Yrkesgymnasiet Solna | Solna | 147.0 | 42.9 | 5.6 | 37.3 | storsthlm |
| Drottning Blankas Gymnasieskola Kungsbacka | Kungsbacka | 196.7 | 42.4 | 5.2 | 37.2 | goteborgsregionen |
| Psykologigymnasiet | Solna | 229.3 | 39.1 | 2.7 | 36.4 | storsthlm |
| Alingsås Yrkesgymnasium | Alingsås | 219.6 | 40.0 | 4.1 | 35.9 | goteborgsregionen |
| S:t Martins gymnasium | Sundbyberg | 173.3 | 39.2 | 5.0 | 34.2 | storsthlm |
| Praktiska Gymnasiet Kungsbacka | Kungsbacka | 169.8 | 40.3 | 6.5 | 33.8 | goteborgsregionen |
| Internationella Hotell- och Restaurangskolan | Stockholm | 249.4 | 37.0 | 3.8 | 33.2 | storsthlm |
| Grillska Gymnasiet Liljeholmen | Stockholm | 186.9 | 38.0 | 5.1 | 32.9 | storsthlm |
| Designgymnasiet Kungsholmen | Stockholm | 232.6 | 42.3 | 11.2 | 31.1 | storsthlm |
| JENSEN gymnasium Nacka strand | Nacka | 256.0 | 31.1 | 1.1 | 30.0 | storsthlm |
| Yrkesgymnasiet Skarpnäck | Stockholm | 105.5 | 34.1 | 4.3 | 29.8 | storsthlm |
| Realgymnasiet Stockholm | Stockholm | 213.0 | 35.8 | 7.4 | 28.4 | storsthlm |
| Berga naturbruksgymnasium | Haninge | 234.3 | 31.9 | 4.1 | 27.9 | storsthlm |
| Affärsgymnasiet Stockholm | Stockholm | 226.3 | 33.2 | 5.4 | 27.9 | storsthlm |
| Sågbäcksgymnasiet | Huddinge | 178.2 | 30.1 | 2.9 | 27.2 | storsthlm |

## Caveats

- This is exact normalized school+municipality matching only. It does not yet use skolenhetskod matching or fuzzy matching.
- Storsthlm currently contributes median admission merit, because the downloaded 2025 file exposes median rather than mean.
- Göteborgsregionen contributes unweighted mean across programs because the mean-merit PDF does not include admitted count.
- Several regional sources are discovered/downloaded but still need source-specific parsers before they should influence conclusions.
