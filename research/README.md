# Reproduce the exploratory forecasting feasibility test

This folder is research-only; it is not imported by the Streamlit application.
It contains aggregate results and code, never the private cohort rows.

Use Python with numpy, pandas, scipy, scikit-learn and openpyxl. The run used the
existing Python 3.12 runtime; no extra deployment requirement was added.

In a private local workspace outside your public repository:

```bash
python reconstruct_source.py --source '/private/path/source.xlsx' --out private
python evaluate_trajectory.py
```

The parser verifies the original source workbook hash and fails for unrecognized
bytes. The workbook must be the source listed in `docs/TRAJECTORY_METHODS.md`.
It outputs pseudonymous row-level data into `private`, which must remain private.
The evaluation expects that directory beside its script and writes only aggregate
metrics/fold counts to `trajectory_feasibility.json`. Do not upload `private` or
the source workbook into GitHub or a public app.

This is a feasibility analysis of a candidate rate forecast, not a treatment
model or a validated prediction deployment. It did not consistently outperform
persistence and is not used for forecasting in the website. The site uses
explicit deterministic scenarios plus the unchanged original NKPI classifier.
