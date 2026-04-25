# Gymnasium Admissions Analysis Report

Generated: 2026-04-25T20:45:17.270Z

This report joins parsed 2025 final-admission merit data to the existing 2025 gymnasium national-test/grade deviation dataset by exact normalized school name and municipality.
When the admission source lacks municipality, the report also allows a conservative fallback match if the normalized school name is unique in the 2025 NP dataset.

## Overall

- Parsed admission school aggregates: 606
- NP school aggregates for 2025 terms: 1100
- Exact school+municipality matches: 235
- Unique school-name fallback matches: 50
- Total matched schools: 285
- Pearson r, admission merit vs andel högre: -0.209
- Pearson r, admission merit vs nettoavvikelse (högre-lägre): -0.113

## Source Match Coverage

| Source | Parsed rows | School aggregates | Matched schools | Status |
|---|---:|---:|---:|---|
| storsthlm | 1412 | 173 | 112 | matched |
| goteborgsregionen | 426 | 70 | 29 | matched |
| skanegy | 604 | 121 | 65 | matched |
| fyrbodal | 200 | 22 | 9 | matched |
| sjuharad | 182 | 9 | 0 | parsed, unmatched |
| skaraborg | 378 | 9 | 0 | parsed, unmatched |
| halland | 155 | 17 | 1 | matched |
| ostergotland | 279 | 38 | 19 | matched |
| uppsala | 99 | 29 | 21 | matched |
| kalmarsund | 181 | 3 | 0 | parsed, unmatched |
| dalarna-gavleborg | 1803 | 45 | 17 | matched |
| vasternorrland | 133 | 15 | 0 | parsed, unmatched |
| nykoping | 19 | 2 | 0 | parsed, unmatched |
| torsas-korr | 0 | 0 | 0 | parser/source gap |
| varmland | 0 | 0 | 0 | parser/source gap |
| kronoberg | 0 | 0 | 0 | parser/source gap |
| vasterbotten | 0 | 0 | 0 | parser/source gap |
| gotland | 34 | 2 | 1 | matched |
| orebro | 172 | 21 | 7 | matched |
| jonkoping | 0 | 0 | 0 | parser/source gap |
| karlskrona | 45 | 2 | 0 | parsed, unmatched |
| gymnasieantagning-nord | 242 | 12 | 1 | matched |
| katrineholm | 23 | 2 | 0 | parsed, unmatched |
| europaskolan-strangnas | 0 | 0 | 0 | parser/source gap |
| oskarshamn | 19 | 1 | 0 | parsed, unmatched |
| vastervik | 12 | 1 | 0 | parsed, unmatched |
| jamtland | 95 | 12 | 3 | matched |

## By Source

| Source | Matched schools | r merit vs högre | r merit vs netto | Merit metric used |
|---|---:|---:|---:|---|
| dalarna-gavleborg | 17 | 0.036 | -0.080 | weighted mean |
| fyrbodal | 9 | 0.129 | 0.381 | weighted mean |
| goteborgsregionen | 29 | -0.551 | -0.461 | unweighted mean |
| gotland | 1 | - | - | weighted mean |
| gymnasieantagning-nord | 1 | - | - | weighted mean |
| halland | 1 | - | - | weighted mean |
| jamtland | 3 | -0.761 | - | weighted mean |
| orebro | 7 | 0.446 | 0.776 | weighted median |
| ostergotland | 19 | -0.012 | 0.052 | unweighted mean |
| skanegy | 65 | -0.165 | -0.026 | unweighted mean |
| storsthlm | 112 | -0.313 | -0.190 | weighted median |
| uppsala | 21 | -0.281 | 0.162 | weighted mean |

## Highest Matched Net Deviations

| School | Municipality | Admission merit | Andel högre | Andel lägre | Netto | Source |
|---|---|---:|---:|---:|---:|---|
| Bergstrands Gymnasium Märsta | Sigtuna | 111.0 | 70.0 | 10.0 | 60.0 | storsthlm |
| Impius gymnasium | Helsingborg | 207.3 | 71.4 | 13.3 | 58.1 | skanegy |
| Bergstrands Gymnasium Stockholm | Stockholm | 172.4 | 44.4 | 2.1 | 42.3 | storsthlm |
| Älvdalens Utbildningscentrum | Älvdalen | 219.0 | 49.8 | 7.9 | 41.9 | dalarna-gavleborg |
| Sveriges Ridgymnasium Kungsbacka | Kungsbacka | 181.7 | 45.1 | 4.2 | 40.9 | goteborgsregionen |
| Magelungens Gymnasium Liljeholmen | Stockholm | 167.5 | 45.9 | 6.3 | 39.6 | storsthlm |
| Odengymnasiet | Stockholm | 161.7 | 42.0 | 3.0 | 38.9 | storsthlm |
| Blekinge Naturbruksgymnasium | Ronneby | 197.0 | 45.7 | 7.1 | 38.6 | skanegy |
| Gutegymnasiet | Gotland | 204.7 | 47.6 | 9.8 | 37.8 | gotland |
| Yrkesgymnasiet Solna | Solna | 147.0 | 42.9 | 5.6 | 37.3 | storsthlm |
| Friskolan Nytorp | Bollnäs | 204.1 | 46.9 | 9.7 | 37.2 | dalarna-gavleborg |
| Drottning Blankas Gymnasieskola Kungsbacka | Kungsbacka | 196.7 | 42.4 | 5.2 | 37.2 | goteborgsregionen |
| Hjalmar Strömerskolan | Strömsund | 194.1 | 45.3 | 8.2 | 37.1 | jamtland |
| JENSEN Gymnasium Kristianstad | Kristianstad | 199.0 | 43.7 | 7.1 | 36.6 | skanegy |
| Psykologigymnasiet | Solna | 229.3 | 39.1 | 2.7 | 36.4 | storsthlm |
| Alingsås Yrkesgymnasium | Alingsås | 219.6 | 40.0 | 4.1 | 35.9 | goteborgsregionen |
| Realgymnasiet Gävle | Gävle | 203.3 | 41.5 | 5.7 | 35.8 | dalarna-gavleborg |
| Falu Frigymnasium | Falun | 240.3 | 38.8 | 3.3 | 35.5 | dalarna-gavleborg |
| NTI Gymnasiet Borlänge | Borlänge | 189.0 | 40.6 | 5.4 | 35.2 | dalarna-gavleborg |
| S:t Martins gymnasium | Sundbyberg | 173.3 | 39.2 | 5.0 | 34.2 | storsthlm |

## Caveats

- Matching is exact normalized school+municipality first, then unique normalized school-name fallback only when no exact match exists. It does not yet use skolenhetskod matching or fuzzy matching.
- Storsthlm currently contributes median admission merit, because the downloaded 2025 file exposes median rather than mean.
- Göteborgsregionen contributes unweighted mean across programs because the mean-merit PDF does not include admitted count.
- Several regional sources are discovered/downloaded but still need source-specific parsers before they should influence conclusions.
