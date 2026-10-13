# SecureNexus ML Validation Report

## Scope

SecureNexus uses two security review models for live interview signals:

1. A 51-tree Random Forest built from bootstrap-sampled CART trees with Gini impurity.
2. A dependency-free 1D temporal-convolution classifier with ReLU, global pooling, and learned class centroids.

The final risk probability blends the models at 60% Random Forest and 40% temporal CNN.

The models use only browser activity and opt-in nearby Bluetooth signal counts. Face counts, video frames, face identity, eye gaze, and biometric data are excluded from ML scoring.

## Current demo validation

The current runtime uses deterministic synthetic bootstrap records because no approved real labeled hiring dataset has been provided.

- Training rows: 360
- Holdout rows: 72
- Split: deterministic 80/20 holdout by row order
- Accuracy: 93.06%
- Macro precision: 93.55%
- Macro recall: 93.05%
- Macro F1: 93.12%

These metrics validate that the code path runs and produces reproducible measurements. They do not demonstrate real-world hiring accuracy.

## Fairness and privacy status

Fairness testing is reported as `not-run` because SecureNexus does not collect protected demographic attributes. The app therefore does not fabricate demographic parity, equalized odds, or subgroup performance results.

Before production hiring use, an authorized research or compliance owner must provide consented, de-identified evaluation data and run an offline fairness audit. The results should be reviewed by a human before any employment decision.

## Replacing demo data

Set `ML_TRAINING_DATA` in `backend/.env` to a private JSON file containing at least 30 labeled rows, including `LOW_RISK` and `HIGH_RISK` examples:

```json
[
  {
    "label": "LOW_RISK",
    "features": {
      "tabSwitches": 0,
      "blurFocusEvents": 0,
      "fullscreenExits": 0,
      "nearbyDeviceCount": 0,
      "eventFrequency": 1,
      "eventDuration": 0,
      "sessionInterruptions": 0
    }
  }
]
```

The service normalizes values, trains both models at startup, and returns validation metrics, per-class metrics, and a confusion matrix from the holdout rows.

## Responsible-use decision

The current implementation is suitable for a final-year-project demonstration and recruiter review workflow. It must remain a review aid, not an automatic accept/reject or hiring decision system, until representative data, independent validation, privacy review, and fairness review are completed.
