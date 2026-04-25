# Gymnasium Admissions Analysis

## Hypothesis

The incoming students' merit value from compulsory school is likely an important background factor for how well students perform in gymnasium. To analyze grading deviations between national tests and course grades fairly, the gymnasium dataset should be enriched with final admission statistics by year and region.

The first target variable remains the deviation between national test grades and course grades:

- `andelHogre`: share of students with course grade higher than national test grade
- `andelLagre`: share of students with course grade lower than national test grade
- `betygsavvikelseNetto`: `andelHogre - andelLagre`

The main explanatory intake variables should come from final admission statistics:

- `admissionMeritMin`: merit value of the last admitted student
- `admissionMeritMean`: mean merit value among admitted students
- `admittedCount`: number of admitted students
- `firstChoiceAdmittedCount`: number admitted with the education as first choice, when available
- `places`: number of available places, when available
- `reserveCount`: number of reserves, when available

## Source Findings

Admissions data is not centralized nationally in the same way as Skolverket's school statistics. It is published by regional admission offices, usually as Excel or PDF files.

Known source patterns:

- Stockholm region publishes downloadable Excel files for preliminary and final admission statistics.
- Gothenburg region publishes yearly reports for February, preliminary admission, final admission, and reserve admission. Their public explanation says the "Antagningspoang och medelvarde" report includes both the cutoff score and the admitted students' mean merit value.
- Uppsala region publishes final admission PDFs split by municipality and independent schools.
- Kalmar region publishes reports with places, applicants, admitted counts, lowest comparison score, median, and mean score.
- Smaller admission offices often publish PDFs per year, and some pages explicitly point users to the relevant admission office for other regions.

Because of this fragmentation, the project should treat admission statistics as imported source files, not as a single live API dependency.

## Normalized Data Model

Create one normalized row per final-admission education option:

```ts
export interface AdmissionRow {
  year: number;
  region: string;
  sourceName: string;
  sourceUrl?: string;
  admissionRound: "final";
  school: string;
  skolenhetskod: string | null;
  municipality: string | null;
  kommunkod: string | null;
  huvudman: string | null;
  huvudmanType: HuvudmanType | null;
  programCode: string | null;
  programName: string;
  orientationName: string | null;
  studyPathCode: string | null;
  places: number | null;
  admittedCount: number | null;
  firstChoiceAdmittedCount: number | null;
  reserveCount: number | null;
  admissionMeritMin: number | null;
  admissionMeritMean: number | null;
  admissionMeritMedian: number | null;
}
```

Aggregate one derived row per school and year:

```ts
export interface SchoolAdmissionContext {
  year: number;
  skolenhetskod: string;
  region: string;
  admissionMeritMeanWeighted: number | null;
  admissionMeritMinWeighted: number | null;
  admissionMeritMedianWeighted: number | null;
  admittedCount: number;
  programCount: number;
}
```

Weighting should use `admittedCount` when available. If admitted count is missing, the row should not contribute to weighted school averages unless a source-specific parser has a documented safe fallback.

## Join Strategy

The current gymnasium NP dataset already contains `skolenhetskod`, `skola`, `kommun`, `kommunkod`, `huvudman`, and `orgnr` in `scripts/build-dataset.ts`.

Join levels:

1. Preferred: `skolenhetskod + year`
2. Fallback for sources without school unit code: normalized `school + municipality + year`
3. Avoid joining by school name alone, because chain schools and municipal schools often reuse similar names.

Term handling:

- Final admission for year `2025` should be joined to gymnasium NP terms `HT25` and `VT26` with care.
- For current project data, a conservative first implementation can join admission year `2025` to NP term year `2025` and expose the join policy in the UI.
- A more causal model should lag intake by course: for example, admission year `2024` may be more relevant for `Engelska 5`/`Matematik 1` in `HT24`/`VT25`, while later courses may require cohort assumptions.

## Implementation Plan

1. Add `data_admissions/gymnasium/` for raw regional files.
2. Add `data/admissions-sources.json` as a manifest with region, year, round, file path, source URL, and parser type.
3. Add parsers that output `data/generated/admissions-gymnasium.json`.
4. Add aggregation from `AdmissionRow[]` to `SchoolAdmissionContext[]`.
5. Enrich the gymnasium dataset with school-year admission context.
6. Add UI controls and columns for:
   - mean admitted merit value
   - lowest admitted merit value
   - net grade deviation
   - admitted count behind the context
7. Add an analysis view with scatterplots and correlations:
   - `admissionMeritMeanWeighted` vs `andelHogre`
   - `admissionMeritMeanWeighted` vs `betygsavvikelseNetto`
   - by program group where join quality allows it
   - by huvudman type and AcadeMedia/non-AcadeMedia

## First Practical Slice

Start with two high-value regions:

- Stockholm, because Excel source files are likely easiest to parse and cover many schools.
- Gothenburg region, because it publishes "Antagningspoang och medelvarde" for final admission and has clear documentation.

Once those parsers work, add PDF-heavy regions incrementally with source-specific parser tests.

## Risks

- Admission data is regional and format-inconsistent.
- Some PDFs lack `skolenhetskod`; name matching must be audited.
- Mean merit value sometimes excludes skill-test points, which is good for this analysis, but source notes must be preserved.
- Program-level admission strength and school-level NP deviation are not the same unit. Aggregating to school-year is useful, but program-level matching will be better where course/program mapping is possible.
- Causal timing is subtle: final admission describes incoming grade-9 merit, while national tests may happen one or more terms later depending on course.
