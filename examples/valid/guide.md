---
title: Reliable drive commissioning
id: drive-commissioning
version: 1.2.0
audience: controls-engineer
---

# Reliable drive commissioning

This synthetic example demonstrates a compact, testable documentation contract.

## Preconditions

Confirm the controller is in maintenance mode before applying configuration.

> [!WARNING]
> Condition: A motor can start when remote control remains enabled.
> Consequence: Unexpected motion can injure personnel or damage equipment.
> Avoidance: Isolate power and verify the safe state before continuing.

## Configuration

| Parameter | Value | Unit |
| --------- | ----: | ---- |
| Ramp time |     5 | s    |

```json
{
  "mode": "maintenance",
  "rampSeconds": 5
}
```

Continue with the [safe retry procedure](details.md#safe-retry).
