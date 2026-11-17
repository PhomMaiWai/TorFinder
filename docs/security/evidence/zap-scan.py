"""DAST of a LOCAL TorFinder (http://localhost:3000 only) through the ZAP API.

Start ZAP first (desktop app with the API on, or headless):
  zap.sh -daemon -host 127.0.0.1 -port 8090 -config api.key=$ZAP_API_KEY
then:
  pip install zaproxy requests
  ZAP_API_KEY=... python3 zap-scan.py baseline out/   # passive, signed out
  ZAP_API_KEY=... python3 zap-scan.py auth out/       # signed in as the demo org, spider + active scan

Never point this at a shared, staging or production server: the active scan
sends attack payloads. See docs/security/dast-report.md.
"""
import json, os, re, sys, time
import requests
from zapv2 import ZAPv2

TARGET = "http://localhost:3000"
KEY = os.environ["ZAP_API_KEY"]
zap = ZAPv2(apikey=KEY, proxies={"http": "http://127.0.0.1:8090", "https": "http://127.0.0.1:8090"})
mode, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

EXCLUDE = [
    r"^https?://(?!localhost:3000).*",           # nothing but our own frontend
    r".*accounts\.google\.com.*", r".*\.go\.th.*",
    r".*/api/auth/logout.*",                      # keep the session alive
    r".*/api/auth/google.*",                      # starts an OAuth hop to Google
    r".*/api/tor/[^/]+/egp-documents.*",          # backend fetches from the e-GP portal
    r".*/api/tor/[^/]+/documents.*",              # backend fetches the TOR file from the agency's host
    r".*/api/gproc.*", r".*/api/ai/.*",           # outside services
]
SEEDS = ["/", "/dashboard", "/search", "/insights", "/login", "/signup", "/forgot-password", "/public"]
AUTH_SEEDS = ["/matches", "/profile", "/library", "/saved?scope=org", "/notifications", "/insights", "/search"]

def wait(fn, label):
    while True:
        p = int(fn())
        print(f"{label}: {p}%", flush=True)
        if p >= 100: return
        time.sleep(10)

def wait_passive():
    while int(zap.pscan.records_to_scan) > 0:
        print("passive left:", zap.pscan.records_to_scan, flush=True); time.sleep(5)

zap.core.new_session(name=f"torfinder-{mode}", overwrite=True)
ctx = f"tf-{mode}"
zap.context.new_context(ctx)
zap.context.include_in_context(ctx, re.escape(TARGET) + ".*")
for rx in EXCLUDE:
    zap.context.exclude_from_context(ctx, rx)
    zap.spider.exclude_from_scan(rx)
    zap.ascan.exclude_from_scan(rx)
    zap.core.exclude_from_proxy(rx)

# A real TOR id so the spider reaches a detail page.
tor = requests.get("http://localhost:4000/api/tor?limit=1").json()
items = tor if isinstance(tor, list) else tor.get("items") or tor.get("tors") or tor.get("data") or []
if items:
    SEEDS.append(f"/tor/{items[0].get('id') or items[0].get('_id')}")

seeds = SEEDS
if mode == "auth":
    r = requests.post(TARGET + "/api/auth/login", json={"email": os.environ.get("DEMO_ORG_EMAIL", "contact@arundigital.co.th"), "password": os.environ["DEMO_ORG_PASSWORD"]}, allow_redirects=False)
    m = re.search(r"(__Host-torr_session|torr_session)=([^;]+)", r.headers.get("set-cookie", ""))
    assert m, f"login failed: {r.status_code}"
    zap.replacer.add_rule(description="session", enabled="true", matchtype="REQ_HEADER", matchregex="false",
                          matchstring="Cookie", replacement=f"{m.group(1)}={m.group(2)}")
    seeds = AUTH_SEEDS + SEEDS

for path in seeds:
    try: zap.core.access_url(TARGET + path, followredirects="true")
    except Exception as e: print("seed", path, e)
zap.spider.set_option_max_duration(5)
sid = zap.spider.scan(TARGET, contextname=ctx, recurse="true")
wait(lambda: zap.spider.status(sid), "spider")
wait_passive()

if mode == "auth":
    zap.ascan.set_option_thread_per_host(2)
    zap.ascan.set_option_max_scan_duration_in_mins(60)
    aid = zap.ascan.scan(TARGET, recurse="true", contextid=zap.context.context(ctx)["id"])
    wait(lambda: zap.ascan.status(aid), "active")
    wait_passive()
    zap.replacer.remove_rule("session")

urls = [u for u in zap.core.urls(baseurl=TARGET)]
json.dump(urls, open(f"{out}/urls.json", "w"), indent=1)
open(f"{out}/zap-{mode}.html", "w").write(zap.core.htmlreport())
open(f"{out}/zap-{mode}.json", "w").write(zap.core.jsonreport())
alerts = zap.core.alerts(baseurl=TARGET)
print("urls", len(urls), "alerts", len(alerts))
