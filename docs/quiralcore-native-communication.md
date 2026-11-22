# QuiralCore native communication architecture

## Target

Replace the JMRI JSON/WebSocket dependency with an in-process native Windows communication service. QuiralCore communicates directly with the Märklin Central Station 2 (60215) over Ethernet using the Märklin CAN (MCAN) TCP protocol. The first supported target is the user's CS2; S88 feedback is decoded and mapped through a centrally managed contact registry.

This implementation is a native .NET 8 library. It does not use JMRI, a third-party railway server, a browser, HTML, or a WebSocket gateway.

## Initial implementation in this change

- A strict 13-byte MCAN frame codec, including priority, command, response flag, hash, DLC and payload.
- A direct TCP receive transport for the CS2 (default port 15731; host and port configurable).
- S88 event (0x11) and feedback broadcast (0x12) decoding.
- A central S88 contact registry with stable contact IDs, level assignment, configurable input polarity and JSON persistence.
- A Windows CI build and protocol test harness.

## Safety boundary

This first native communication increment is **read-only**. It intentionally has no locomotive, accessory, turnout, track-power or route command API. All physical outputs remain locked. Missing, unregistered or malformed feedback is not treated as a valid occupied/free reading. The registry only emits changes for explicitly registered contacts.

Before any future write/control path can be introduced, it must be separately implemented and validated for CS2 acknowledgements, timeouts, stale data, emergency stop, loss of Ethernet, power-state confirmation and fail-safe shutdown. Real hardware validation is mandatory; CI tests are not physical certification.

## Migration boundary

The repository still contains the legacy Electron/HTML and JMRI adapter paths while the native Windows application migration is in progress. This change establishes the native QuiralCore communication foundation; it does **not** claim that the old application has already been removed or that the installer is already a fully native QuiralCore application. The remaining UI, project, geometry, rolling-stock and safety modules must be ported into the native application before the legacy runtime can be deleted.

## Protocol references

- Märklin CS2 CAN Protocol 2.0: fixed 13-byte MCAN frames; S88 feedback event and broadcast command families.
- Märklin CS2 60215 product specification and manual.
- Implementation tests cover codec and S88 data mapping; on-device verification remains pending.
