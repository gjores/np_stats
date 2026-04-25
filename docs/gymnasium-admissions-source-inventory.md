# Gymnasium Admissions Source Inventory

This document tracks the national source landscape for enriching gymnasium national-test/grade deviation data with intake merit values from final admissions.

## Key Finding

There is no single public national file with `school x program x year x final-admission mean merit` that can be joined directly to Skolverket's national-test statistics.

Skolverket's guidance points users to regional admission offices for admission statistics. The official admission statistics are therefore fragmented across regional sites, usually as PDFs, web tables, or Excel downloads.

For this project, "region" should mean admission-statistics source region/admission office, not necessarily county or administrative region.

## Required Normalization

Every source should be normalized into the same shape:

```ts
interface AdmissionRow {
  year: number;
  sourceRegion: string;
  sourceUrl: string;
  admissionRound: "final" | "reserve" | "preliminary";
  school: string;
  skolenhetskod: string | null;
  municipality: string | null;
  programName: string;
  programCode: string | null;
  orientationName: string | null;
  places: number | null;
  admittedCount: number | null;
  firstChoiceAdmittedCount: number | null;
  reserveCount: number | null;
  admissionMeritMin: number | null;
  admissionMeritMean: number | null;
  admissionMeritMedian: number | null;
}
```

For analysis, `admissionMeritMean` should be the primary measure, weighted by `admittedCount` when aggregating to school-year. `admissionMeritMin` is useful as a selectivity floor but is noisier for small programs.

## Initial 12-Region Coverage Set

This is the first full coverage set I would implement. It covers the large public sources already found and gives us a practical national spine. It is not a claim that Sweden officially has only 12 admission regions.

| # | Source region | Source pattern | Format | Data quality for our purpose | Parser priority |
|---|---|---|---|---|---|
| 1 | Storsthlm | Downloadable admission-statistics files for preliminary/final rounds | Excel | High, likely easiest to parse and includes many schools | 1 |
| 2 | Göteborgsregionen | Yearly reports for final admission, including "Antagningspoang och medelvarde" | PDF | High; explicitly includes cutoff and mean merit | 1 |
| 3 | Skåne/Västra Blekinge | Skånegy merit-value pages and area PDFs | PDF/web | Medium-high; likely split into sub-areas | 2 |
| 4 | Fyrbodal | Statistics/reports page with final-admission results | PDF | Medium-high; regional PDF parser | 2 |
| 5 | Sjuhärad | Final and reserve admission PDFs by year | PDF | High; public page says mean and lowest merit are shown | 2 |
| 6 | Skaraborg | Education Skaraborg public antagningsstatistik PDFs | PDF | High; snippets show places, admitted, reserves, lowest/mean merit | 2 |
| 7 | Halland | Gymnasiehalland statistics PDFs | PDF | High; snippets show places, admitted, lowest/mean merit | 2 |
| 8 | Östergötland | Gymnasiestudera searchable statistics | Web/app | High if underlying data is accessible; otherwise needs scraper | 3 |
| 9 | Uppsala region | Municipality/independent-school PDFs for final admission | PDF | Medium; split files, but official | 3 |
| 10 | Kalmarsund/Kalmar | Year reports/statistics PDFs | PDF | High; documentation says lowest, median, mean | 3 |
| 11 | Dalarna/Gävleborg | Antag Dalarna statistics for Dalarna and Gävleborg | PDF | High; snippets show places, first choice, admitted, lowest, mean | 3 |
| 12 | Västernorrland | Antagning Västernorrland final statistics | PDF | Medium; official source found, parser needs inspection | 4 |

## Known Additional Gaps Beyond The First 12

These should be audited before claiming full national coverage:

- Västerbotten/Umeå
- Norrbotten
- Värmland
- Jönköping
- Sörmland/Nyköping region
- Västmanland
- Örebro
- Kronoberg/Blekinge areas not covered through Skåne/Västra Blekinge
- Gotland, if not covered through Storsthlm or another office

Some of these may be covered by a larger admission office, but we should prove that through school-code coverage, not assume it.

## Data Quality Rules

1. Prefer final admission over reserve admission.
2. Keep reserve admission as a separate round; do not mix it into final admission.
3. Preserve source URL and file name for every row.
4. Do not join by school name alone unless it is explicitly flagged as a fuzzy/manual match.
5. Exclude rows with no admitted count from weighted school means unless a source-specific rule is documented.
6. Treat aesthetic-program or special-admission scores carefully; some sources note that skill-test points may or may not be included in mean merit.
7. Flag unusually high means above 340 as likely skill-test-inclusive or source-specific composite values.

## Analytical Model

After normalization, each gymnasium school-year should get:

- weighted mean admission merit
- weighted lowest admission merit
- total admitted count in the admission data
- number of matched program rows
- match quality: `schoolUnitCode`, `exactNameMunicipality`, `fuzzyNameMunicipality`, or `unmatched`

Then test:

- correlation between weighted mean admission merit and `andelHogre`
- correlation between weighted mean admission merit and `andelHogre - andelLagre`
- same correlations by subject group: mathematics, Swedish, English
- same correlations by huvudman type and AcadeMedia/non-AcadeMedia
- regression with at least: mean admission merit, school size, huvudman type, subject group, year

## Implementation Order

1. Add source manifest and raw-data directories.
2. Build one robust table/PDF parser family for sources with repeated "places/admitted/lowest/mean" layouts.
3. Build the Storsthlm Excel parser.
4. Build source-specific parsers for GR and Skånegy.
5. Add school-code matching audit.
6. Add generated coverage report:
   - rows parsed per source
   - schools matched to NP dataset
   - schools unmatched
   - missing merit mean counts
7. Only after coverage is measurable, add UI and analysis charts.

## Current Evidence

- Skolverket/Utbildningsguiden states admission statistics are found through regional admission offices.
- Storsthlm states it provides downloadable Excel files for preliminary and final admission statistics.
- Göteborgsregionen says it compiles statistics at four times during the admission year and publishes final-admission reports. Its admission-statistics guidance states that the report includes the required cutoff and the admitted students' mean merit value.
- Sjuhärad states final-admission statistics are from July 1 and their news page says the statistics show mean value and lowest merit value among admitted students.
- Kalmarsund states each study path shows applicants, admitted, lowest comparison score, median, and mean score.
- Halland's PDF snippets show program, places, admitted count, lowest merit value, and mean merit value.
- Dalarna/Gävleborg snippets show places, first-choice applicants, admitted, lowest comparison score, and mean.
