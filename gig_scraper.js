// gig_scraper.js
// Injected into a Fiverr gig page to extract detailed gig information.
// Listens for a message { type: 'SCRAPE_GIG' } and responds with a details object.


(function(){
  function clean(s){ return (s||'').replace(/\s+/g,' ').trim(); }

  function getText(sel){ const el=document.querySelector(sel); return el?clean(el.textContent):''; }

  function getAllTexts(sel){ return [...document.querySelectorAll(sel)].map(n=>clean(n.textContent)).filter(Boolean); }

  function getImages(sel){ return [...document.querySelectorAll(sel)].map(n=>n.src||n.getAttribute('src')).filter(Boolean); }

  function getInputValue(sel){
    const el = document.querySelector(sel);
    if (!el) return '';
    const v = (el.value !== undefined ? el.value : el.getAttribute('value')) || '';
    return clean(v);
  }

  function extractPricing(){
    try{
      // Fiverr uses package cards - try common selectors
      const packages = [];
      const packageEls = document.querySelectorAll('[data-testid*="package"] , .packages .package, .gig-packages .package');
      if (packageEls && packageEls.length){
        packageEls.forEach(el=>{
          const name = clean(el.querySelector('h3')?.textContent || el.querySelector('.package-name')?.textContent || '');
          const price = clean(el.querySelector('[data-testid*="price"], .price, .package-price')?.textContent || '');
          const desc = clean(el.querySelector('.description, .package-description')?.textContent || '');
          packages.push({ name, price, desc });
        });
        return packages;
      }

      // fallback: look for single price
      const singlePrice = getText('.price, [data-testid="gig-price"], .gig-price, .start-price');
      if (singlePrice) return [{ name:'Standard', price: singlePrice, desc: '' }];
    }catch(e){ console.warn('extractPricing error', e); }
    return [];
  }

  function extractOverview(){
    // Prefer edit page form fields if present
    const editTitle = getInputValue('input[name="title"], input[id*="title"], textarea[name="title"]');
    const editDesc = getInputValue('textarea[name="description"], textarea[id*="description"]');

    const title = editTitle || getText('h1') || getText('[data-testid="gig-title"]') || document.title || '';
    const desc = editDesc || getText('[data-testid="description"] , .gig-description, #overview, .description, .about') || getText('meta[name="description"]') || '';
    const tags = getAllTexts('.tags a, .tags, [data-testid="tags"] a, .gig-tags a, [data-testid*="skills"] [role="option"], [data-testid*="tags"] [role="option"]');
    return { title, description: desc, tags };
  }

  function extractSeller(){
    const name = getText('[data-testid="seller-name"], .seller-name, a[href*="/users/"]');
    const rating = getText('.rating, [data-testid="rating"], .seller-rating');
    const sold = getText('.orders-sold, .seller-deliveries');
    // Try edit page seller info
    const editSellerName = (document.querySelector('input[name="seller_name"], input[id*="seller_name"]') || {}).value;
    return { name: editSellerName || name, rating, sold };
  }

  function extractPackagesFromEdit(){
    try{
      const packages = [];
      // find repeating package rows in edit form
      const rows = document.querySelectorAll('.package-row, .package-item, [data-testid*="package-row"]');
      if (rows && rows.length){
        rows.forEach((r, idx)=>{
          const name = getInputValue('input[name*="package_name"], input[name*="name"]') || clean(r.querySelector('h3')?.textContent || '');
          const price = getInputValue('input[name*="package_price"], input[name*="price"]') || clean(r.querySelector('.price')?.textContent || '');
          const desc = getInputValue('textarea[name*="package_desc"], textarea[name*="description"]') || clean(r.querySelector('.desc')?.textContent || '');
          packages.push({ name, price, desc });
        });
        return packages;
      }
    }catch(e){ /* ignore */ }
    return null;
  }

  function extractDescriptionAndFaq(){
    // Description content and FAQ items on edit screen
    const description = getInputValue('textarea[name="description"], textarea[id*="description"], [data-testid*="description"] textarea');
    const faq = [];
    const faqRows = document.querySelectorAll('[data-testid*="faq"], .faq-item, .faq-row');
    faqRows.forEach(row => {
      const q = getInputValue('input[name*="question"], textarea[name*="question"]') || clean(row.querySelector('input, textarea')?.value || row.querySelector('h4')?.textContent || '');
      const a = getInputValue('textarea[name*="answer"]') || clean(row.querySelector('p, .answer')?.textContent || '');
      if (q || a) faq.push({ question: q, answer: a });
    });
    return { description, faq };
  }

  function extractRequirements(){
    const requirements = [];
    const reqRows = document.querySelectorAll('[data-testid*="requirement"], .requirement-row, .requirement-item');
    reqRows.forEach(row => {
      const label = getInputValue('input[name*="label"], textarea[name*="label"]') || clean(row.querySelector('label')?.textContent || '');
      const type = (row.querySelector('select')?.value || row.getAttribute('data-type') || '').toLowerCase();
      const required = /required|mandatory/i.test(row.textContent||'');
      if (label) requirements.push({ label, type, required });
    });
    return { requirements };
  }

  function extractGallery(){
    const images = getImages('.gallery img, .gig-gallery img, [data-testid="gallery"] img, .seller-gallery img, [data-testid*="image"] img');
    const videos = [...document.querySelectorAll('video source, [data-testid*="video"] source')].map(n=>n.src||n.getAttribute('src')).filter(Boolean);
    return { images, videos };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'SCRAPE_GIG'){
      (async ()=>{
        try{
          // Wait a little for lazy content
          await new Promise(r=>setTimeout(r, 300));

          const overview = extractOverview();
          const editPackages = extractPackagesFromEdit();
          const pricingPackages = editPackages && editPackages.length ? editPackages : extractPricing();
          const { description, faq } = extractDescriptionAndFaq();
          const { requirements } = extractRequirements();
          const { images, videos } = extractGallery();
          const seller = extractSeller();
          const delivery = getText('.delivery-time, [data-testid="delivery-time"]') || '';

          const details = {
            url: location.href,
            title: overview.title,
            overview: {
              title: overview.title,
              description: overview.description,
              tags: overview.tags || [],
              images,
            },
            description: { description, faq },
            pricing: { packages: pricingPackages },
            requirements: { requirements },
            gallery: { images, videos },
            tags: overview.tags || [],
            seller,
            delivery,
            scraped_at: new Date().toISOString()
          };

          sendResponse({ status: 'OK', details });
        }catch(e){
          console.error('gig_scraper error', e);
          sendResponse({ status: 'ERR', error: String(e) });
        }
      })();
      return true; // indicate async response
    }
  });

})();
