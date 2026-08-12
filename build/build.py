"""
Build FDIC_Peer_Dashboard.html

Concatenates the source parts in build/parts/ and injects the metric catalogue
(derived from the FDIC "Select a Standard Peer Grouping" export and validated
against the live API). Produces one self-contained HTML file.

Run from the project root:  python build/build.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PARTS = ROOT / "build" / "parts"
CATALOG = ROOT / "build" / "metric_catalog.json"
OUT = ROOT / "FDIC_Peer_Dashboard.html"

ORDER = [
    "01_head.html",
    "02_body.html",
    "03_core.js",
    "04_charts.js",
    "05_views.js",
    "06_ui.js",
]

PLACEHOLDER = "/*__METRIC_CATALOG__*/[]"


def catalog_js(metrics):
    """One object per line: small file, readable diffs."""
    rows = [
        "  {code:%s, label:%s, cat:%s, unit:%s, n:%d}"
        % (
            json.dumps(m["code"]),
            json.dumps(m["label"]),
            json.dumps(m["cat"]),
            json.dumps(m["unit"]),
            m["n"],
        )
        for m in metrics
    ]
    return "[\n" + ",\n".join(rows) + "\n]"


def main() -> None:
    missing = [p for p in ORDER if not (PARTS / p).exists()]
    if missing:
        sys.exit("Missing source part(s): " + ", ".join(missing))

    html = "\n".join((PARTS / p).read_text(encoding="utf-8").rstrip() for p in ORDER)

    metrics = json.loads(CATALOG.read_text(encoding="utf-8"))
    if PLACEHOLDER not in html:
        sys.exit("Placeholder %r not found in the sources" % PLACEHOLDER)
    html = html.replace(PLACEHOLDER, catalog_js(metrics))

    # Guard against shipping a file that reaches outside itself. Only static
    # markup counts -- links the script builds at runtime (a bank's own website,
    # opened by the user) are not page resources.
    markup = re.sub(r"<script>.*?</script>", "", html, flags=re.S)
    external = re.findall(r'(?:src|href)\s*=\s*"(?!#)([^"]+)"', markup)
    if external:
        sys.exit("External resource reference in markup: %r" % external[:5])

    OUT.write_text(html, encoding="utf-8")
    print("wrote %s" % OUT)
    print("  %d trust metrics injected" % len(metrics))
    print("  %.1f KB" % (OUT.stat().st_size / 1024))


if __name__ == "__main__":
    main()
