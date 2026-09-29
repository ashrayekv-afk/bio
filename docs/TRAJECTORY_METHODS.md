# What can the current cohort support?

## Result of the feasibility analysis

A new cohort forecasting test was run on the actual Northwestern workbook,
`Data Extraction- KCN Project_8748(2).xlsx`, SHA-256
`60bd4895f669fa55bd4e7e37266c66a52497f250847869185dfa1424bfa882be`.
The conservative source parser from the September 21 relationship-validation
package was reused without changing its mapping or exclusion rules.

The historical workbook is described as 426 eyes. The explicit parser recovered
425 numeric candidates in 234 patients; the one-eye discrepancy remains
unresolved. It retained 301 complete baseline eyes and 262 complete paired eyes.
The forecasting test further restricted baseline age to 18–50, observed interval
to 90 days–5 years, and both visits to current calculator input bounds, giving
**179 eyes / 101 patients: 51 CXL-group and 128 control-group eyes**.

The paired table contains two selected observations per eye. CXL-group records
are intended to be two pretreatment observations, with a documented post-CXL
later scan excluded. A complete, verified eye-specific treatment timeline is not
available. There is no third observation in this table to validate continuation
of an individually observed slope after the latest visit. A CXL-group label is
not an outcome observed under CXL.

## Forecast candidate and validation

Target: later-minus-first measurement change in each of the six inputs.
Candidates, specified before inspecting their results in this run:

1. Persistence: predict zero measurement change.
2. Regularized rate model using first-scan age.
3. Regularized rate model using first-scan age and all six first-scan values.

The rate designs multiply an intercept and standardized predictors by actual
elapsed years. Multi-output ridge uses penalties 1, 10 and 100. Outcomes are
scaled within training folds, and scaling is learned from training data only.
The CXL-group label is never a predictor; second-visit values are targets only.

Three repeats of nested five outer / three inner patient-grouped folds were
used. Both eyes of each patient always stay in the same fold. Inner-fold mean
standardized squared prediction error selects the candidate and penalty. All
reported error is from untouched outer folds, averaged across repeats. This is
exploratory internal validation, not a prospectively registered or external test.

| Measurement | Tested procedure MAE | Persistence MAE |
|---|---:|---:|
| A, mm | 0.1170 | 0.1155 |
| B, mm | 0.1200 | 0.1187 |
| Thickness, µm | 9.4628 | 8.5140 |
| BAD-D | 0.7267 | 0.7188 |
| ARTmax | 29.5266 | 28.4602 |
| Kmax, D | 1.2187 | 1.1626 |

Mean absolute error was worse than persistence for all six variables. Squared
error improved slightly for A, B and BAD-D, but worsened for thickness, ARTmax and
Kmax. These estimates do not prove all possible forecasting models fail; they do
not establish useful, validated performance for the tested procedure. No model
was selected based on a favorable headline or tuned against the outer test sets.
The tested candidate is not used for patient forecasts in the website.

The evaluation predicts the second selected scan at its observed interval.
It does not separately validate exact 6/12/24-month horizons, projections after
two scans, causal no-CXL trajectories, or post-treatment outcomes. Shorter median
follow-up in the CXL-group and selected scan pairs may create informative visit
scheduling and selection effects. No clinical progression endpoint or confidence
interval was fabricated.

## Working website calculation

For a measurement x and observed interval d days:

```
observed_years = d / 365.2425
annual_rate = (latest_x - first_x) / observed_years
scenario_x(h months) = latest_x + annual_rate * h / 12
reference_x(h months) = latest_x
```

The rate is not learned from a CXL/control label and is not claimed to persist.
The cohort reference is the median and interquartile range of annualized changes
in the 179-eye subset. It is descriptive only, not a measurement-error model or
forecast interval. Improvement and worsening signs are retained as measured.
No variable is forced to move in a clinically expected direction.

The optional score is the frozen single-visit classifier evaluated at projected
values. It uses the same standardization, coefficients and logistic mapping as
the original calculator. It is a 0–100 CXL-associated pattern index, not a
6/12/24-month probability. The two-visit model is not reused with invented future
measurements or intervals. Original calculator scores are not changed.

Future NKPI values outside the classifier's observed development ranges are
withheld. Physical scenarios outside calculator input bounds are also withheld;
no numerical clipping hides an invalid extrapolation. Missing paired measurements
remain missing, while independent complete measurement pairs may still be shown.

The 90-day minimum is an operational guard against very short interval rate
inflation. It is not a validated repeatability or progression threshold. A future
horizon exceeding the observed interval is explicitly marked with the extension
factor. No confidence band is displayed for these deterministic scenarios.

## Age without a false claim of natural stabilization

```
age_latest = age_first + observed_years
age_future = age_latest + h / 12
```

Future age is always displayed. For the main score scenario, age stays at
age_latest by default to isolate measurement changes. An explicit sensitivity
option evaluates the same projected measurements at age_future. The difference
is the arithmetic consequence of the existing classifier's age coefficient.
It does not estimate a causal within-person biological aging effect, change the
measurement slopes, or establish that the patient is stabilizing.

With all other inputs fixed, the classifier's log-odds change is
`age_coefficient / age_scale * (h / 12)`. This is audited in software tests.
Cumulative probability of a first progression event cannot fall with increasing
follow-up time. A changing index, instantaneous hazard and cumulative event risk
are distinct quantities; the tool does not equate them.

## Why a CXL versus no-CXL curve is still unavailable

The requested contrast needs defined strategies: CXL now versus no CXL over the
chosen horizon, with explicit handling of later treatment, outcomes, eligibility,
confounders and censoring. Changing the label of a constant line to CXL would not
supply that evidence. Pretreatment change in eyes later selected for treatment
cannot establish how those eyes would change after CXL.

A future research model should add full longitudinal scan dates, treatment dates
and protocol, independently adjudicated progression, post-CXL outcomes, last
follow-up and repeat scans/QS where possible. A longitudinal measurement model
could then learn and validate how prior slope informs subsequent change. A
survival/landmark model could estimate horizon-specific progression risk. A
causal treatment comparison needs an appropriate target-trial design and
sensitivity analyses; neither a CXL-status classifier nor raw treated/control
means identifies that treatment effect.

## Primary methodological references

- Maile et al. (2022), *Personalized Model to Predict Keratoconus Progression From
  Demographic, Topographic, and Genetic Data*, AJO 240:321–329.
  https://pubmed.ncbi.nlm.nih.gov/35469790/
  This supports studying age/tomography in time-to-event prediction. It does not
  validate our model or justify transplanting its coefficients to this cohort.
- Hernán & Robins (2016), *Using Big Data to Emulate a Target Trial When a Randomized
  Trial Is Not Available*, AJE 183:758–764.
  https://pubmed.ncbi.nlm.nih.gov/26994063/
  This informs the design of treatment comparisons, not a numerical CXL effect
  assumed by this website.

No patient rows, dates, identifiers or individual cohort predictions are included
in the GitHub package. Aggregate validation results are in `research`.
