const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '390x844', width: 390, height: 844 }
];

const STATES = [
  { name: 'empty', url: 'http://127.0.0.1:5055/?state=empty' },
  { name: 'grid', url: 'http://127.0.0.1:5055/?view=grid' },
  { name: 'list', url: 'http://127.0.0.1:5055/?view=list' },
  { name: 'delete', url: 'http://127.0.0.1:5055/?show_modal=delete' },
  { name: 'error', url: 'http://127.0.0.1:5055/?state=error' }
];

const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log('Starting Playwright screenshot and overflow verification...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true
  });

  const overflowResults = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    const page = await context.newPage();

    for (const st of STATES) {
      console.log(`Loading state: ${st.name} -> ${st.url}`);
      await page.goto(st.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600); // Allow any modal/animations/toasts to settle

      // Programmatic Overflow Assertion
      const overflowData = await page.evaluate(() => {
        const docEl = document.documentElement;
        const bodyEl = document.body;
        const docScrollW = docEl.scrollWidth;
        const docClientW = docEl.clientWidth;
        const bodyScrollW = bodyEl.scrollWidth;
        const windowInnerW = window.innerWidth;

        // Check if any element unclipped by an overflow container overflows horizontally
        const isClippedByAncestor = (el) => {
          let parent = el.parentElement;
          while (parent && parent !== document.documentElement && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (style.overflowX === 'auto' || style.overflowX === 'hidden' || style.overflowX === 'scroll') {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        };

        const overflowingElements = [];
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          if (isClippedByAncestor(el)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.right > windowInnerW + 1) { // 1px rounding tolerance
            overflowingElements.push({
              tag: el.tagName,
              id: el.id,
              className: el.className,
              right: rect.right,
              windowWidth: windowInnerW
            });
          }
        }

        const hasDocOverflow = docScrollW > docClientW;
        return {
          docScrollW,
          docClientW,
          bodyScrollW,
          windowInnerW,
          hasDocOverflow,
          overflowCount: overflowingElements.length,
          topOverflowElements: overflowingElements.slice(0, 3)
        };
      });

      const fileName = `${st.name}_${vp.name}.png`;
      const filePath = path.join(OUT_DIR, fileName);
      await page.screenshot({ path: filePath, fullPage: false });

      const passed = !overflowData.hasDocOverflow && overflowData.overflowCount === 0;
      overflowResults.push({
        viewport: vp.name,
        state: st.name,
        passed,
        docScrollW: overflowData.docScrollW,
        docClientW: overflowData.docClientW,
        overflowCount: overflowData.overflowCount,
        file: fileName
      });

      console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${fileName} - Doc ScrollWidth: ${overflowData.docScrollW}px, ClientWidth: ${overflowData.docClientW}px, Overflowing Elements: ${overflowData.overflowCount}`);
      if (!passed && overflowData.topOverflowElements.length > 0) {
        console.warn('   Overflowing details:', JSON.stringify(overflowData.topOverflowElements));
      }
    }

    await context.close();
  }

  await browser.close();

  console.log('\n========================================');
  console.log('SUMMARY OF PROGRAMMATIC OVERFLOW CHECKS:');
  console.log('========================================');
  let allPassed = true;
  for (const r of overflowResults) {
    console.log(`${r.viewport} | ${r.state.padEnd(8)} | ${r.passed ? 'PASS' : 'FAIL'} | scrollW: ${r.docScrollW} | clientW: ${r.docClientW} | screenshot: ${r.file}`);
    if (!r.passed) allPassed = false;
  }

  if (allPassed) {
    console.log('\n ALL 15 VIEWPORT/STATE COMBINATIONS PASSED ZERO HORIZONTAL OVERFLOW ASSERTIONS!');
  } else {
    console.error('\n❌ SOME OVERFLOW CHECKS FAILED!');
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error('Error executing proof script:', err);
  process.exit(1);
});
