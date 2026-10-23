# Defensive line height: offline pipeline

These scripts build `data/dlh.json`. They need the internet (GitHub raw files of StatsBomb and SkillCorner open data); none of their data is kept in this repository.

1. **SkillCorner model training data.**
   - `sc_build.py` reads the 20 full-tracking matches of SkillCorner Open Data (Git LFS files) into team-frames, about 118,000 rows.
   - Each row holds the camera features (`dlfeat.py`) and the true deepest outfield player.
   - `sc_model.py` tests the correction model leaving one match out. Results: team-match error 0.31 m on average, 1.06 m at most.
2. **StatsBomb lines.** `sb_lines.py` applies the correction to every StatsBomb 360 match and writes per-team, per-match line heights (`sb_lines.json`, kept outside the repository).
3. **Current-season estimate.**
   - `ev_feats.py`, `ev_cb.py` and `ev_grp.py` compute event-only features per team-match: tilt, defensive action height, centre-backs' and outfield players' average positions.
   - `est_search.py` and `est_checks.py` compare feature sets and check bias, calibration and sensitivity.
   - `est_fit.py` fits the final formulas and their leave-one-competition-out validation (`est.json`).
4. **Build.** `python3 build_dlh.py sb_lines.json ../../data/dlh.json est.json`.

Run from a scratch folder: the scripts read and write files next to them.
