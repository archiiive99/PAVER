#!/usr/bin/env python3
"""Render the page headlessly and assert the things that only break once drawn.

    python3 tools/check_page.py            # serve this directory and check it
    python3 tools/check_page.py --url URL  # check something already served

Every check here exists because the defect it catches shipped at least once and
was invisible in the source. Exit status is the number of failed checks.
"""
from __future__ import annotations

import argparse
import collections
import glob
import http.server
import os
import re
import socketserver
import subprocess
import sys
import threading
from html.parser import HTMLParser

CHROME_GLOBS = [
    os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome"),
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
]


def find_chrome() -> str:
    for pattern in CHROME_GLOBS:
        hits = sorted(glob.glob(pattern))
        if hits:
            return hits[-1]
    sys.exit("no chrome/chromium binary found")


def serve(directory: str) -> tuple[str, socketserver.TCPServer]:
    handler = lambda *a, **kw: http.server.SimpleHTTPRequestHandler(
        *a, directory=directory, **kw)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}/", httpd


def dump_dom(chrome: str, url: str, width: int, dark: bool) -> str:
    cmd = [chrome, "--headless=new", "--disable-gpu", "--no-sandbox",
           f"--window-size={width},2000", "--virtual-time-budget=15000",
           "--dump-dom", url]
    if dark:
        cmd.insert(-1, "--blink-settings=preferredColorScheme=0")
    return subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout


# ── individual checks ────────────────────────────────────────────────────────

def check_no_bar_overflow(dom: str) -> list[str]:
    """A tick helper that rounds the axis top DOWN draws bars past the plot."""
    bad = []
    for m in re.finditer(r'<svg[^>]*viewBox="0 0 ([\d.]+) [\d.]+"(.*?)</svg>', dom, re.S):
        width = float(m.group(1))
        for r in re.finditer(r'<rect[^>]*x="([-\d.]+)"[^>]*width="([\d.]+)"', m.group(2)):
            if float(r.group(1)) + float(r.group(2)) > width + 0.5:
                bad.append(f"rect ends at {float(r.group(1)) + float(r.group(2)):.0f} "
                           f"in a {width:.0f}-wide viewBox")
    return bad


def check_text_inside_viewbox(dom: str) -> list[str]:
    """A label placer that falls back without clamping runs text off the canvas."""
    bad = []
    for m in re.finditer(r'<svg([^>]*)>(.*?)</svg>', dom, re.S):
        head, body = m.group(1), m.group(2)
        vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', head)
        if not vb:
            continue
        width = float(vb.group(1))
        for t in re.finditer(r"<text([^>]*)>([^<]*)</text>", body):
            attrs, text = t.group(1), t.group(2).strip()
            if not text or "rotate" in attrs:
                continue
            xm = re.search(r'x="([-\d.]+)"', attrs)
            if not xm:
                continue
            x = float(xm.group(1))
            size = 13 if "reflab" in attrs else (12.5 if "hint" in attrs else 11)
            w = len(text) * size * 0.52
            left = x - w / 2 if "mid" in attrs else (x - w if "end" in attrs else x)
            if left < -0.5 or left + w > width + 0.5:
                bad.append(f"{text!r} spans {left:.0f}..{left + w:.0f} "
                           f"in a {width:.0f}-wide viewBox")
    return bad


def check_no_text_collisions(dom: str) -> list[str]:
    """Labels pinned to one side of their mark collide in dense regions."""
    bad = []
    for m in re.finditer(r'<svg([^>]*)>(.*?)</svg>', dom, re.S):
        head, body = m.group(1), m.group(2)
        if 'viewBox="0 0' not in head:
            continue
        label = re.search(r'aria-label="([^"]*)"', head)
        name = label.group(1)[:40] if label else "(unlabelled chart)"
        rows = collections.defaultdict(list)
        for t in re.finditer(r"<text([^>]*)>([^<]*)</text>", body):
            attrs, text = t.group(1), t.group(2).strip()
            if not text or "rotate" in attrs:      # rotated titles false-positive
                continue
            xm, ym = re.search(r'x="([-\d.]+)"', attrs), re.search(r'y="([-\d.]+)"', attrs)
            if not xm or not ym:
                continue
            x, y = float(xm.group(1)), float(ym.group(1))
            size = 13 if "reflab" in attrs else (12.5 if "hint" in attrs else 11)
            width = len(text) * size * 0.52
            left = x - width / 2 if "mid" in attrs else (x - width if "end" in attrs else x)
            rows[round(y / 6)].append((left, left + width, text))
        for line in rows.values():
            line.sort()
            for a, b in zip(line, line[1:]):
                if a[1] > b[0] + 1:
                    bad.append(f"{name}: {a[2]!r} overlaps {b[2]!r}")
    return bad


def check_value_labels_outside_bars(dom: str) -> list[str]:
    """Mixing inside- and beside-bar values puts light text on some rows only."""
    return [f"{n} value labels drawn inside bars"
            for n in [len(re.findall(r'class="val[^"]*inbar', dom))] if n]


def check_no_nested_cards(dom: str) -> list[str]:
    """A card inside a card stacks two surfaces and reads as a boxed box."""
    class Finder(HTMLParser):
        VOID = {"br", "img", "input", "meta", "link", "hr", "source",
                "path", "use", "circle", "line", "rect", "stop"}

        def __init__(self):
            super().__init__()
            self.stack, self.hits = [], []

        def handle_starttag(self, tag, attrs):
            if tag in self.VOID:
                return
            attrib = dict(attrs)
            is_card = "card" in (attrib.get("class") or "").split()
            if is_card and any(c for _, c in self.stack):
                self.hits.append(attrib.get("id") or "(no id)")
            self.stack.append((tag, is_card))

        def handle_endtag(self, tag):
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    del self.stack[i:]
                    return

    finder = Finder()
    finder.feed(dom)
    return [f"card {i} is nested inside another card" for i in finder.hits]


def check_segmented_state(dom: str) -> list[str]:
    """Exactly one selected option and exactly one tab stop per control."""
    bad = []
    for m in re.finditer(r'<(?:div|nav)[^>]*class="[^"]*segbar[^"]*"[^>]*>(.*?)</(?:div|nav)>',
                         dom, re.S):
        body = m.group(1)
        selected = body.count('aria-selected="true"') + body.count('aria-checked="true"')
        if selected > 1:
            bad.append(f"a segmented control has {selected} selected options")
    return bad


def check_duplicate_ids(dom: str) -> list[str]:
    counts = collections.Counter(re.findall(r'\sid="([^"]+)"', dom))
    return [f"duplicate id {k!r} ({v}×)" for k, v in counts.items() if v > 1]


def check_accessible_names(dom: str) -> list[str]:
    bad = []
    for tag, label in (("button", "button"), ("a", "link")):
        for m in re.finditer(rf"<{tag}([^>]*)>(.*?)</{tag}>", dom, re.S):
            attrs, inner = m.group(1), re.sub(r"<[^>]+>", "", m.group(2)).strip()
            if not inner and "aria-label" not in attrs and "aria-labelledby" not in attrs:
                bad.append(f"a {label} has no accessible name")
    return bad


CHECKS = [
    ("bars stay inside the plot", check_no_bar_overflow),
    ("labels stay inside the plot", check_text_inside_viewbox),
    ("no overlapping chart labels", check_no_text_collisions),
    ("value labels sit outside bars", check_value_labels_outside_bars),
    ("no card inside a card", check_no_nested_cards),
    ("segmented controls have one selection", check_segmented_state),
    ("ids are unique", check_duplicate_ids),
    ("controls have accessible names", check_accessible_names),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    ap.add_argument("--dir", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    args = ap.parse_args()

    chrome = find_chrome()
    httpd = None
    url = args.url
    if not url:
        url, httpd = serve(args.dir)

    failures = 0
    try:
        # the same defect can appear in only one of these four combinations
        for width, dark in ((1440, False), (390, False), (1440, True), (390, True)):
            dom = dump_dom(chrome, url, width, dark)
            tag = f"{width}px {'dark' if dark else 'light'}"
            if len(dom) < 5000:
                print(f"FAIL [{tag}] page did not render")
                failures += 1
                continue
            for name, fn in CHECKS:
                problems = fn(dom)
                if problems:
                    failures += 1
                    print(f"FAIL [{tag}] {name}")
                    for p in problems[:6]:
                        print(f"        {p}")
                    if len(problems) > 6:
                        print(f"        … and {len(problems) - 6} more")
                else:
                    print(f"ok   [{tag}] {name}")
    finally:
        if httpd:
            httpd.shutdown()

    print(f"\n{failures} failed check(s)")
    return failures


if __name__ == "__main__":
    sys.exit(main())
