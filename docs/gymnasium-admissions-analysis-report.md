# Gymnasium Admissions Analysis Report

Generated: 2026-04-25T16:14:34.130Z

This report joins parsed 2025 final-admission merit data to the existing 2025 gymnasium national-test/grade deviation dataset by exact normalized school name and municipality.
When the admission source lacks municipality, the report also allows a conservative fallback match if the normalized school name is unique in the 2025 NP dataset.

## Overall

- Parsed admission school aggregates: 363
- NP school aggregates for 2025 terms: 1100
- Exact school+municipality matches: 158
- Unique school-name fallback matches: 17
- Total matched schools: 175
- Pearson r, admission merit vs andel högre: -0.237
- Pearson r, admission merit vs nettoavvikelse (högre-lägre): -0.147

## Source Match Coverage

| Source | Parsed rows | School aggregates | Matched schools | Status |
|---|---:|---:|---:|---|
| storsthlm | 1412 | 173 | 112 | matched |
| goteborgsregionen | 426 | 70 | 29 | matched |
| skanegy | 0 | 0 | 0 | parser/source gap |
| fyrbodal | 200 | 22 | 9 | matched |
| sjuharad | 182 | 9 | 0 | parsed, unmatched |
| skaraborg | 14 | 4 | 0 | parsed, unmatched |
| halland | 155 | 17 | 1 | matched |
| ostergotland | 0 | 0 | 0 | parser/source gap |
| uppsala | 0 | 0 | 0 | parser/source gap |
| kalmarsund | 4 | 1 | 0 | parsed, unmatched |
| dalarna-gavleborg | 1601 | 45 | 17 | matched |
| vasternorrland | 0 | 0 | 0 | parser/source gap |
| nykoping | 0 | 0 | 0 | parser/source gap |
| torsas-korr | 0 | 0 | 0 | parser/source gap |
| varmland | 0 | 0 | 0 | parser/source gap |
| kronoberg | 0 | 0 | 0 | parser/source gap |
| vasterbotten | 0 | 0 | 0 | parser/source gap |
| gotland | 0 | 0 | 0 | parser/source gap |
| orebro | 172 | 21 | 7 | matched |
| jonkoping | 0 | 0 | 0 | parser/source gap |
| karlskrona | 2 | 1 | 0 | parsed, unmatched |

## By Source

| Source | Matched schools | r merit vs högre | r merit vs netto | Merit metric used |
|---|---:|---:|---:|---|
| dalarna-gavleborg | 17 | 0.040 | -0.076 | weighted mean |
| fyrbodal | 9 | 0.129 | 0.381 | weighted mean |
| goteborgsregionen | 29 | -0.551 | -0.461 | unweighted mean |
| halland | 1 | - | - | weighted mean |
| orebro | 7 | 0.446 | 0.776 | weighted median |
| storsthlm | 112 | -0.313 | -0.190 | weighted median |

## Highest Matched Net Deviations

| School | Municipality | Admission merit | Andel högre | Andel lägre | Netto | Source |
|---|---|---:|---:|---:|---:|---|
| Bergstrands Gymnasium Märsta | Sigtuna | 111.0 | 70.0 | 10.0 | 60.0 | storsthlm |
| Bergstrands Gymnasium Stockholm | Stockholm | 172.4 | 44.4 | 2.1 | 42.3 | storsthlm |
| Älvdalens Utbildningscentrum | Älvdalen | 218.3 | 49.8 | 7.9 | 41.9 | dalarna-gavleborg |
| Sveriges Ridgymnasium Kungsbacka | Kungsbacka | 181.7 | 45.1 | 4.2 | 40.9 | goteborgsregionen |
| Magelungens Gymnasium Liljeholmen | Stockholm | 167.5 | 45.9 | 6.3 | 39.6 | storsthlm |
| Odengymnasiet | Stockholm | 161.7 | 42.0 | 3.0 | 38.9 | storsthlm |
| Yrkesgymnasiet Solna | Solna | 147.0 | 42.9 | 5.6 | 37.3 | storsthlm |
| Friskolan Nytorp | Bollnäs | 204.1 | 46.9 | 9.7 | 37.2 | dalarna-gavleborg |
| Drottning Blankas Gymnasieskola Kungsbacka | Kungsbacka | 196.7 | 42.4 | 5.2 | 37.2 | goteborgsregionen |
| Psykologigymnasiet | Solna | 229.3 | 39.1 | 2.7 | 36.4 | storsthlm |
| Alingsås Yrkesgymnasium | Alingsås | 219.6 | 40.0 | 4.1 | 35.9 | goteborgsregionen |
| Realgymnasiet Gävle | Gävle | 203.3 | 41.5 | 5.7 | 35.8 | dalarna-gavleborg |
| Falu Frigymnasium | Falun | 239.6 | 38.8 | 3.3 | 35.5 | dalarna-gavleborg |
| NTI Gymnasiet Borlänge | Borlänge | 189.1 | 40.6 | 5.4 | 35.2 | dalarna-gavleborg |
| S:t Martins gymnasium | Sundbyberg | 173.3 | 39.2 | 5.0 | 34.2 | storsthlm |
| Praktiska Gymnasiet Kungsbacka | Kungsbacka | 169.8 | 40.3 | 6.5 | 33.8 | goteborgsregionen |
| Internationella Hotell- och Restaurangskolan | Stockholm | 249.4 | 37.0 | 3.8 | 33.2 | storsthlm |
| Grillska Gymnasiet Liljeholmen | Stockholm | 186.9 | 38.0 | 5.1 | 32.9 | storsthlm |
| Nuntorpsgymnasiet | Vänersborg | 112.3 | 52.5 | 20.8 | 31.7 | fyrbodal |
| Designgymnasiet Kungsholmen | Stockholm | 232.6 | 42.3 | 11.2 | 31.1 | storsthlm |

## Caveats

- Matching is exact normalized school+municipality first, then unique normalized school-name fallback only when no exact match exists. It does not yet use skolenhetskod matching or fuzzy matching.
- Storsthlm currently contributes median admission merit, because the downloaded 2025 file exposes median rather than mean.
- Göteborgsregionen contributes unweighted mean across programs because the mean-merit PDF does not include admitted count.
- Several regional sources are discovered/downloaded but still need source-specific parsers before they should influence conclusions.
