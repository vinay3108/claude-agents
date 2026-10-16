// ============================================================
// Striver A2Z DSA Sheet - FULL Scraper Script
// URL: https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z
// Captures ALL links: practiceLink, solveLink, articleLink, youtubeLink
// Downloads: strivers_a2z_problems.json + .csv
// ============================================================

async function scrapeA2ZSheet() {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const cleanUrl = href => {
    try { return href ? new URL(href).origin + new URL(href).pathname : ''; }
    catch(e) { return href || ''; }
  };

  // Step 1: Expand all main categories
  const mainButtons = Array.from(document.querySelectorAll('button')).filter(btn =>
    btn.querySelector('.tuf-accordion-title')
  );
  console.log(`[1] Expanding ${mainButtons.length} main categories...`);
  for (const btn of mainButtons) {
    const row = btn.closest('.tuf-accordion-row');
    if (row && row.getAttribute('data-state') !== 'open') {
      btn.click();
      await delay(100);
    }
  }
  await delay(600);

  // Step 2: Expand all sub-category panels
  const subBtns = document.querySelectorAll('.tuf-subrow-btn');
  console.log(`[2] Expanding ${subBtns.length} sub-categories...`);
  for (const btn of subBtns) {
    const panel = btn.closest('.tuf-subrow')?.querySelector('.tuf-subrow-panel');
    if (panel && panel.classList.contains('tuf-subrow-panel-closed')) {
      btn.click();
      await delay(80);
    }
  }
  await delay(600);

  // Step 3: Scrape all problems with ALL links
  console.log('[3] Scraping problems...');
  const results = [];

  const scrapeTableRows = (tableRows, mainCategory, subCategory) => {
    for (const tr of tableRows) {
      const cells = tr.querySelectorAll('td');
      if (cells.length < 3) continue;

      // Cell [1]: Problem name + TUF article link
      const problemName = cells[1]?.textContent.trim();
      if (!problemName) continue;
      const articleLink = cleanUrl(cells[1]?.querySelector('a')?.href || '');

      // Cell [2]: Solve link (TUF Plus)
      const solveLink = cleanUrl(cells[2]?.querySelector('a')?.href || '');

      // Cell [4]: Resource icons — article + YouTube
      const resourceAs = Array.from(cells[4]?.querySelectorAll('a') || []).map(a => cleanUrl(a.href));
      const articleResourceLink = resourceAs.find(l => l && !l.includes('youtu')) || '';
      const youtubeLink = resourceAs.find(l => l && (l.includes('youtu.be') || l.includes('youtube.com'))) || '';

      // Cell [5]: Practice link (LeetCode / GFG / Coding Ninjas etc.)
      const practiceAs = Array.from(cells[5]?.querySelectorAll('a') || []).map(a => cleanUrl(a.href));
      const practiceLink = practiceAs[0] || '';

      // Cell [8]: Difficulty
      const difficulty = cells[8]?.textContent.trim() || '';

      results.push({
        mainCategory,
        subCategory,
        problem: problemName,
        practiceLink,                             // ← LeetCode / GFG (most important)
        solveLink,                                // ← TUF Plus solve
        articleLink: articleLink || articleResourceLink, // ← TUF article
        youtubeLink,                              // ← YouTube tutorial
        difficulty
      });
    }
  };

  for (const row of document.querySelectorAll('.tuf-accordion-row')) {
    const mainCategory = row.querySelector('.tuf-accordion-title')?.textContent.trim() || 'Unknown';
    const subRows = row.querySelectorAll('.tuf-subrow');
    if (subRows.length > 0) {
      for (const subRow of subRows) {
        const subCategory = subRow.querySelector('.tuf-subrow-btn span')?.textContent.trim() || '';
        scrapeTableRows(subRow.querySelectorAll('.tuf-subrow-panel tbody tr'), mainCategory, subCategory);
      }
    } else {
      scrapeTableRows(row.querySelectorAll('tbody tr'), mainCategory, '');
    }
  }

  // Stats
  const total = results.length;
  const withPractice = results.filter(r => r.practiceLink).length;
  console.log(`✅ ${total} problems | Practice links: ${withPractice}/${total}`);

  // Step 4: Download JSON
  const jsonBlob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const jsonA = Object.assign(document.createElement('a'), { href: URL.createObjectURL(jsonBlob), download: 'strivers_a2z_problems.json' });
  document.body.appendChild(jsonA); jsonA.click(); document.body.removeChild(jsonA);

  // Step 5: Download CSV
  const csvRows = [
    'Main Category,Sub Category,Problem,Practice Link,Solve Link,Article Link,YouTube Link,Difficulty',
    ...results.map(r => `"${r.mainCategory}","${r.subCategory}","${r.problem}","${r.practiceLink}","${r.solveLink}","${r.articleLink}","${r.youtubeLink}","${r.difficulty}"`)
  ].join('\n');
  const csvA = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csvRows], { type: 'text/csv' })), download: 'strivers_a2z_problems.csv' });
  document.body.appendChild(csvA); csvA.click(); document.body.removeChild(csvA);

  console.log('📁 Downloaded: strivers_a2z_problems.json + .csv');
  window._scrapedProblems = results;
  return results;
}

scrapeA2ZSheet();