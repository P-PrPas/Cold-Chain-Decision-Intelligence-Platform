# Synthetic fixtures ? NOT approved quality rules
All data fabricated; no actual cargo or real safety thresholds. Policy remains DRAFT, not loadable as an approved production policy.
Hand-calculated oracle: bounds 2..8 inclusive; entire gap >600 seconds UNKNOWN; warning >=300 and critical >=600 out-of-band seconds. No trailing interval after last sample.
Normal: 300+300=600 in-band. Warning: 300 out +300 in. Critical: 300+300=600 out. Irregular: 120 out +300 in, below warning. Gap: full 1200 unknown. Conflicting duplicate is invalid; naive timestamp needs timezone; A/B disagreement has no aggregate clearance.
These are development oracles awaiting human review, not qualified QA sign-off. Tests verify arithmetic independently; S2/S3 must compare real parser/engine output against these checked-in results.
