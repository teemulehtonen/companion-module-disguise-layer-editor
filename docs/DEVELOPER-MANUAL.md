# CC1 developer manual

Read [CC1 development](CC1-DEVELOPMENT.md), [handoff](PROJECT-HANDOFF.md),
[build instructions](BUILD.md) and [regression testing](REGRESSION-TESTS.md).

Preserve the connection module ID and saved action IDs so existing custom CC1
pages remain compatible. The legacy viewer_zoom ID now controls only Designer's
timeline. There is no web UI or local HTTP listener in this checkout.

Keep UI text in English. New behavior needs regression coverage. Generated page
exports must contain neutral connection settings, never personal settings or IDs.
The user arranges their pages; do not replace installed controls automatically.
