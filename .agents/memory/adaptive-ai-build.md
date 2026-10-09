---
name: Adaptive AI build boundary
description: Frontend-only prototype boundary and adaptive interaction decision.
---

Adaptive AI is intentionally a frontend-only Expo prototype: provider calls and OCR remain behind replaceable mock service functions until the separately developed FastAPI backend is connected. Adaptive presentation is derived from shared persisted preferences so users can override or disable it.

**Why:** The product specification explicitly separates the Android client from backend and secrets, while the central HCI demonstration depends on visible preference-driven changes.

**How to apply:** Keep future feature work in the Expo artifact, preserve typed service boundaries, and route adaptive behavior through the shared preference state rather than adding per-screen rules. Authentication/profile behavior is currently a persisted local prototype and should be replaced by the real auth/backend contract when that service is connected.