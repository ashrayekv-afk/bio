# NKPI 7.4.1 — Biological domains replace maps and projections

The former 2D/3D mapping and longitudinal-projection workspace is replaced by one **Biological domains · Both eyes** dropdown below the NKPI results. Open it to view the 0–4 domain assessment for each eye. There is no map/projection tab or trajectory iframe on the calculator page.

This corrects 7.4.0, which changed the direction-count panel but left the old workspace in place. The NKPI calculation, model coefficients, import/extraction, source verification, score explanations and exports are unchanged. Source crops used to verify extracted measurements remain in the importer.

## The new panel

| Biological domain | Threshold for crossing |
| --- | --- |
| Anterior curvature | ARC decreases >0.106 mm **or** Kmax increases >1.0 D |
| Posterior curvature | PRC decreases >0.085 mm |
| Pachymetric | Thinnest thickness decreases >2% of baseline **or** ARTmax decreases >44.24 units |
| Composite deviation | BAD-D increases >0.42 units |

- At most **one point per domain**, even if both component measurements cross.
- **At least 2 of 4** meets the numerical SOURCE domain criterion. The secondary **2 of 3 structural domains** check excludes BAD-D, which overlaps the structural measurements.
- The primary count is always out of four, never six measurements. The structural check is available inside the measurement details.
- Exact decimal comparisons use the entered values before display rounding. Strict greater-than cutoffs mean equality does **not** cross. Thickness percent decrease is `100 × (baseline − latest) / baseline`.
- All six reliable values are required at both visits. Missing, invalid, unverified, changed or unreliable inputs never become a negative vote or a stable result. An explicit scan-quality warning withholds the domain calculation.
- ARC/Kmax disagreement stays visible. Each component shows its actual change, threshold and crossing result.
- Age and interval do not contribute domain points. They contribute only to comparison-scope checks.
- The panel is independent of the NKPI score. A recorded prior-CXL hold can show numerical crossings with an explicit pretreatment-protocol limitation, while the existing NKPI hold remains in place. Other held assessments are not bypassed.

### SOURCE eligibility and interpretation

The rules are from **SOURCE_P0175_Resubmission_Answers.docx, pages 3–4** (2026-09-28). They are prespecified study criteria, not a validated diagnostic rule, progression probability or treatment recommendation.

SOURCE requires baseline age 18–50, verified same-eye pretreatment measurements, acceptable scan quality, and examinations at least **six calendar months** apart. The app retains interval days, not original examination dates: fewer than 181 days is too short, 181–183 days requires checking the dates, and 184 days or more establishes the interval minimum. No 180-day approximation is silently substituted.

If age, interval, quality or recorded treatment status fails or is unknown, the panel displays **SOURCE classification not assigned**, while preserving any valid numerical threshold findings. When these recorded requirements are met, it says **Recorded comparison requirements met**; it does not certify full study enrollment eligibility. The protocol also requires source-record review for scarring, procedure history and other exclusions. Contact-lens washout and scarring are not assessed by this panel; missing information is never treated as absence. The protocol's single-site research enrollment restrictions are not checked by the calculator.

A 0–1 count means the numerical criterion is not met; it does not establish stability. The rule is not validated here for post-CXL monitoring. No new clinical accuracy claim is made.

The dropdown uses only the verified current result snapshot. Edits, source changes and patient reset clear old findings. PDF and audited JSON exports retain their existing content; this new domain summary is currently displayed in the webpage only.

## Retained from 7.2 — Extraction integrity and reduced interval weight

This complete Streamlit / GitHub release strengthens OCR extraction and source review for the six required measurements in both eyes. It also applies the requested 50% scan-interval coefficient to the two-visit model.

## New in 7.2

- Repeated OCR passes of the same printed field count as one source. Conflicting values cannot receive an automatic agreement badge.
- **Reports agree**, **Conflict**, **Review source**, and **Source verified** distinguish OCR corroboration from human verification. Every field has an expandable source crop; uncertain fields open automatically.
- Label-anchored ARTmax/PPImax reading follows the printed labels and retries different image channels. The label itself cannot contribute a spurious digit to its measurement.
- When direct ARTmax OCR is missing or weak and inconsistent, an explicitly approximate C/PPImax candidate may be populated. It requires source review, retains the conflicting readings, and is not presented as independently verified. No values are imputed from cohort averages or another eye.
- Extraction bounds now match calculator bounds, including ARTmax below 50 and BAD-D above 20. Wider ranges do not establish eligibility or scan quality.
- Progression-table corroboration requires a matching examination date, with exact time for repeated same-day candidates. No nearest-date or last-row substitution.
- OD/OS discovery, missing-eye visibility and the explicit both-eye submission gate are retained. Missing or unreadable values are not fabricated to reach 6/6.
- The two-visit artifact uses interval coefficient **−0.45876435066849985**, exactly half **−0.9175287013369997**. Its center, scale, intercept and other coefficients are unchanged. The adjustment halves the interval term on the logit scale, not necessarily its displayed point effect.
- Model release **3.1.0-interval-half** is an unvalidated fixed amendment, not a retrained/calibrated future-risk model. Parent two-visit AUROC/calibration metrics are not presented as new-model performance.

Read [verification and limitations](docs/TEST_REPORT.md) before interpreting extraction completeness or model performance.

## Import repair

- Restore automatic legacy OD/OS/date filename association, including shorter
  history report sets. Identify report titles rather than guessing page order.
- Process current, legacy and decoded report pages together. A recognized eye
  no longer prevents the other eye's partial/unassigned reports from appearing.
- Look for printed eye labels below the title when header OCR cannot read them.
- Show OD and OS, with every available earlier/later input grid. Missing sources
  have an explicit recovery card; the other visit's measurements remain visible.
- Default to **Both eyes**. Missing eye/visit data block bilateral submission.
  A single-eye calculation requires an explicit OD-only or OS-only selection.
- Reopen source matching for one uploaded visit without a second upload or
  clearing the other visit. Unchanged verified edits are retained.
- Never infer OS simply because a second OD scan exists. Ambiguous repeat scans
  and unknown eyes need source confirmation.

See [bilateral import notes and test evidence](docs/BILATERAL_IMPORT_FIX.md).

## Install

1. Extract `NKPI_Biological_Domains_v7_4_1_GitHub.zip`.
2. Upload its 99 files to the existing repository root, replacing matching files and preserving folders. Upload the contents, not the ZIP itself.
3. Keep `kcn_dual_calculator_app.py` as the Streamlit main file. Requirements are unchanged.
4. Reboot Streamlit and reload the page. Confirm **7.4.1-domain-replacement** in the footer. This release mounts a fresh calculator component to avoid retaining the old workspace.
5. Import and verify the visits, then calculate. Open **Biological domains · Both eyes** beneath the NKPI results.
6. Expand **Measurements, structural check & SOURCE rules** inside either eye to inspect its six values and structural sensitivity check.

The count ranges from 0 to 4 when a comparison can be assessed. A single visit or incomplete data shows a request for the missing comparison; it does not receive a false zero.

Legacy viewer assets remain in the package for compatibility with existing repositories and shared importer contracts. They are not loaded by the calculator. No repository file deletion is required to remove the old workspace from the page.

## Checks

```bash
python tools/verify_package.py
node tests/test_progression_summary.cjs
node tests/test_extraction_integrity.cjs
python tests/test_model_interval.py
node tests/test_bilateral_import.cjs
node tests/test_bilateral_review.cjs
```

The parent-app integration test uses a DOM adapter and real Python responses; a live browser/Streamlit run was not available in the build environment. See [test report](docs/TEST_REPORT.md).
The `research` folder contains reproducible analysis code and aggregate results,
not patient data. It is not used by the deployed app. Older documents are retained
as historical background, not the description of this release's model.

ARTmax identity reference: [OCULUS Pentacam Interpretation Guide](https://www.pentacam.com/fileadmin/user_upload/pentacam.de/downloads/interpretations-leitfaden/Pentacam_Interpretation_Guide_Ophth_EN_0624.pdf). Dividing rounded printed values can differ from the instrument’s internal calculation.
