# Corrected replacement — 7.4.1-domain-replacement

1. Unzip `NKPI_Biological_Domains_v7_4_1_GitHub.zip`.
2. Upload the 99 extracted files to the existing repository root, replacing matching files and preserving folders. Do not upload the ZIP itself.
3. Keep `kcn_dual_calculator_app.py` as the Streamlit entry point.
4. Reboot Streamlit, then reload the browser. Confirm **7.4.1-domain-replacement** in the footer.
5. Import and verify the visits and calculate NKPI as before.
6. Open **Biological domains · Both eyes** beneath the NKPI results. The old map/projection tabs and visit-trajectory screen are removed from this page.

If the old visit-trajectory screen is still visible, the corrected release has not been loaded. Check that `components/index.html`, `components/app.js`, `kcn_dual_calculator_app.py` and the other matching files were replaced, then reboot/reload and check the footer version.

The 0–4 count uses the four SOURCE domains and exact strict thresholds. The structural sensitivity check and comparison-scope messages from 7.4.0 are retained. Missing/one-visit data is not assigned zero. The count is a research threshold summary, not a validated clinical diagnosis.

NKPI coefficients, extraction, bilateral review, input audit and PDF/JSON content are preserved, apart from release labels. Source crops remain available during extraction verification. Legacy viewer assets may remain in the repository but are no longer referenced by the calculator; deleting them is unnecessary.
