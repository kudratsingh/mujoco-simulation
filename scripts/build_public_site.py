"""Build the public documentation hub from an explicitly pinned research tree.

Standard library only. No training, checkpoint loading, or changes to archived
reports. The source checkout is separate from main's documentation checkout.
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class LocalLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ("src", "href", "poster") and value:
                parsed = urlsplit(value)
                if not parsed.scheme and not parsed.netloc and parsed.path:
                    self.links.append(unquote(parsed.path))


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def study(evidence, folder, arms):
    source = evidence / folder
    geometry, criterion = read(source / "geometry.json"), read(source / "criterion.json")
    return {
        "teacher": geometry["teacher"]["final_successes"],
        "rows": [
            {"seed": seed, **{
                f"{arm}_{tag}": geometry[f"seed{seed}_{arm}_{tag}"]["final_successes"]
                for arm in arms for tag in ("final", "best")
            }} for seed in (42, 1042, 2042)
        ],
        "criterion_met": criterion["promising_rule_met"],
        "test_seeds": read(source / "protocol.json")["test_seeds"],
    }


def build(source, output):
    root = Path(__file__).resolve().parents[1]
    project = read(root / "docs/project.json")
    expected = project["source_commit"]
    if not re.fullmatch(r"[0-9a-f]{40}", expected):
        raise ValueError("Research source must be an immutable full commit SHA")
    actual = subprocess.check_output(
        ["git", "-C", str(source), "rev-parse", "HEAD"], text=True
    ).strip()
    if actual != expected:
        raise ValueError(f"Research checkout differs from declared snapshot: {actual}")
    output = output.resolve()
    if output.exists():
        raise FileExistsError("Use a new output directory; existing sites are preserved")
    output.mkdir(parents=True)
    shutil.copy2(root / "docs/index.html", output / "index.html")
    shutil.copytree(root / "docs/assets", output / "assets")
    (output / ".nojekyll").touch()
    evidence = source / "learning/maniskill/evidence"
    copied = []
    for report in project["reports"]:
        for key in ("slug", "directory"):
            if not re.fullmatch(r"[a-z0-9_-]+", report[key]):
                raise ValueError("Invalid report path component")
        origin = evidence / report["directory"]
        if not (origin / "index.html").is_file():
            raise ValueError(f"Missing report: {origin}")
        if any(p.is_symlink() for p in origin.rglob("*")):
            raise ValueError("Public report source must not contain symlinks")
        target = output / "reports" / report["slug"]
        shutil.copytree(origin, target)
        for file in sorted(target.rglob("*")):
            if file.is_file():
                copied.append({
                    "path": str(file.relative_to(output)),
                    "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                    "bytes": file.stat().st_size,
                })
    data = dict(project)
    data["retention"] = study(evidence, "actor_retention", ["baseline", "anchored"])
    data["strength"] = study(evidence, "retention_strength", ["lambda10", "lambda25"])
    # A dashboard update must preserve the frozen experiment interpretation.
    if data["strength"]["criterion_met"] or not data["retention"]["criterion_met"]:
        raise ValueError("Unexpected pinned experiment interpretation")
    write(output / "project-data.json", data)
    write(output / "provenance.json", {
        "research_source_commit": actual, "report_files": copied,
        "report_count": len(project["reports"]),
        "reports_are_unmodified": True,
        "publication_does_not_merge_research_implementations": True,
    })
    checked = 0
    for page in output.rglob("*.html"):
        parser = LocalLinks()
        parser.feed(page.read_text())
        for href in parser.links:
            target = (page.parent / href).resolve()
            if not target.is_relative_to(output) or not target.exists():
                raise ValueError(f"Broken local link: {page.relative_to(output)} -> {href}")
            checked += 1
    print(f"Built {len(project['reports'])} unchanged reports; checked {checked} local HTML links; source {actual}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("_site"))
    args = parser.parse_args()
    build(args.source.resolve(), args.output)


if __name__ == "__main__":
    main()
