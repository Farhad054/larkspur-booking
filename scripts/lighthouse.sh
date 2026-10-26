#!/bin/sh
# Usage: BASE_URL=http://localhost:3418 sh scripts/lighthouse.sh [outdir]
# Runs Lighthouse (mobile, default throttling) on each page and prints category scores.
BASE_URL="${BASE_URL:-http://localhost:3418}"
OUT="${1:-lighthouse-reports}"
CHROME_PATH="${CHROME_PATH:-$(node -e "console.log(require('@playwright/test').chromium.executablePath())")}"
export CHROME_PATH
mkdir -p "$OUT"
# Find a real, currently open slot so the details page is measured with its form showing.
DAY=$(python3 -c "import datetime as d;t=d.date.today()+d.timedelta(days=3)
while t.weekday()>3: t+=d.timedelta(days=1)
print(t)")
SLOT=$(curl -s "$BASE_URL/book?service=maths-60&date=$DAY" | grep -o 'href="/book/details[^"]*"' | head -1 | sed 's/href="//; s/"$//; s/&amp;/\&/g')
for p in "" book "book?service=maths-60&date=$DAY" "${SLOT#/}" admin; do
  name="$(echo "${p:-home}" | tr -c "a-zA-Z0-9\n" "_" | cut -c1-30)"
  npx --yes lighthouse@12 "$BASE_URL/$p" --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox" --output=json --output=html --output-path="$OUT/$name" --quiet >/dev/null 2>&1
  node -e "
    const r=require(require('path').resolve('$OUT/$name.report.json'));const c=r.categories;
    const a=r.audits;
    console.log('$name'.padEnd(8),'perf',Math.round(c.performance.score*100),'a11y',Math.round(c.accessibility.score*100),'bp',Math.round(c['best-practices'].score*100),'seo',Math.round(c.seo.score*100),
      '| LCP',a['largest-contentful-paint'].displayValue,'CLS',a['cumulative-layout-shift'].displayValue,'TBT',a['total-blocking-time'].displayValue)"
done
