---
title: Safe retry procedure
id: safe-retry
version: 1.0.0
audience: controls-engineer
---

# Safe retry procedure

## Safe retry

Record the correlation identifier, confirm the command did not take effect, and retry once.

```bash
doc-quality . --fail-on warning
```
