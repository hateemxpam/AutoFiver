// state.js
// Centralized application state for the extension. Stores Supabase config
// in chrome.storage.local under the key 'supabase_config' and exposes a
// comprehensive API on window.AppState for use from popup, background and content scripts.
(function(){
  const STORAGE_KEY = 'supabase_config';
  const GIGS_STORAGE_KEY = 'scraped_gigs';
  // Default Supabase config provided by user (will be written only if no config exists)
  const DEFAULT_SUPABASE_CONFIG = {
    url: 'https://ufstufxizwnbzypmdzhp.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmc3R1ZnhpenduYnp5cG1kemhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTE2NDYsImV4cCI6MjA3NTMyNzY0Nn0.yb0Cd_W9qnuib7muldWHUdSZWpJEx_CV8AaPJIN1dr8'
  };
  
  // Supabase client instance
  let supabaseClient = null;
  let connectionStatus = { connected: false, lastChecked: null, error: null };

  function getStorage(key){
    return new Promise((res)=> chrome.storage.local.get(key, (r)=> res(r)));
  }

  function setStorage(data){
    return new Promise((res)=> chrome.storage.local.set(data, ()=> res()));
  }

  async function getSupabaseConfig(){
    const data = await getStorage(STORAGE_KEY);
    return data[STORAGE_KEY] || { url: '', key: '' };
  }

  function setSupabaseConfig(cfg){
    return new Promise((res)=> chrome.storage.local.set({[STORAGE_KEY]: cfg}, ()=> res()));
  }

  // Initialize Supabase client
  async function initializeSupabase() {
    try {
      const config = await getSupabaseConfig();
      
      if (!config.url || !config.key) {
        connectionStatus = { connected: false, lastChecked: new Date(), error: 'Missing Supabase configuration' };
        return null;
      }

      // Dynamically import Supabase client
      if (typeof window !== 'undefined' && window.supabase) {
        supabaseClient = window.supabase.createClient(config.url, config.key);
      } else {
        // For content scripts and background scripts, we'll use fetch API
        supabaseClient = {
          url: config.url,
          key: config.key,
          // Custom methods for Chrome extension environment
          from: (table) => ({
            select: (columns = '*') => ({
              async execute() {
                return await fetchSupabaseData('GET', table, null, columns);
              }
            }),
            insert: (data) => ({
              async execute() {
                return await fetchSupabaseData('POST', table, data);
              }
            }),
            update: (data) => ({
              eq: (column, value) => ({
                async execute() {
                  return await fetchSupabaseData('PATCH', table, data, null, { [column]: value });
                }
              })
            }),
            delete: () => ({
              eq: (column, value) => ({
                async execute() {
                  return await fetchSupabaseData('DELETE', table, null, null, { [column]: value });
                }
              })
            })
          })
        };
      }

      // Test connection
      await testSupabaseConnection();
      return supabaseClient;
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      connectionStatus = { connected: false, lastChecked: new Date(), error: error.message };
      return null;
    }
  }

  // Test Supabase connection
  async function testSupabaseConnection() {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      console.log('[AppState] Testing Supabase connection...');
      
      // Try to fetch from a simple table or use a health check
      const response = await fetchSupabaseData('GET', 'gigs', null, 'count');
      
      console.log('[AppState] Supabase connection test successful:', response);
      
      connectionStatus = { 
        connected: true, 
        lastChecked: new Date(), 
        error: null 
      };
      
      return true;
    } catch (error) {
      console.error('[AppState] Supabase connection test failed:', error);
      connectionStatus = { 
        connected: false, 
        lastChecked: new Date(), 
        error: error.message 
      };
      return false;
    }
  }

  // Generic fetch function for Supabase API calls
  async function fetchSupabaseData(method, table, data = null, columns = '*', filters = {}) {
    const config = await getSupabaseConfig();
    
    if (!config.url || !config.key) {
      throw new Error('Supabase configuration missing');
    }

    const url = new URL(`${config.url}/rest/v1/${table}`);
    
    // Add columns parameter for SELECT queries
    if (method === 'GET' && columns !== '*') {
      url.searchParams.set('select', columns);
    }

    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      url.searchParams.set(key, `eq.${value}`);
    });

    const options = {
      method,
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url.toString(), options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase API error: ${response.status} - ${errorText}`);
    }

    if (method === 'GET') {
      return await response.json();
    }
    
    return { success: true };
  }

  // Call a Supabase RPC (PostgREST) function
  async function callSupabaseRPC(fnName, payload) {
    console.log(`[AppState] Calling Supabase RPC function: ${fnName}`);
    console.log(`[AppState] RPC payload:`, payload);
    
    const config = await getSupabaseConfig();
    if (!config.url || !config.key) throw new Error('Supabase configuration missing');

    const url = new URL(`${config.url}/rest/v1/rpc/${fnName}`);
    console.log(`[AppState] RPC URL:`, url.toString());
    
    const options = {
      method: 'POST',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    };

    console.log(`[AppState] RPC request options:`, {
      method: options.method,
      headers: options.headers,
      bodyLength: options.body.length
    });

    const resp = await fetch(url.toString(), options);
    const text = await resp.text();
    
    console.log(`[AppState] RPC response status:`, resp.status);
    console.log(`[AppState] RPC response text:`, text);
    
    if (!resp.ok) {
      throw new Error(`RPC ${fnName} failed: ${resp.status} ${text}`);
    }
    try { 
      const result = JSON.parse(text);
      console.log(`[AppState] RPC parsed result:`, result);
      return result;
    } catch(e){ 
      console.log(`[AppState] RPC non-JSON result:`, text);
      return text; 
    }
  }

  // Test Supabase setup and RPC function
  async function testSupabaseSetup() {
    console.log('[AppState] Testing complete Supabase setup...');
    
    try {
      // Test connection
      const connected = await testSupabaseConnection();
      if (!connected) {
        return { success: false, error: 'Connection failed', details: connectionStatus };
      }

      // Test direct table insertion with sample data
      const testGig = {
        url: 'https://test.com/gig1',
        title: 'Test Gig',
        user_id: 'extension_user',
        scraped_at: new Date().toISOString(),
        overview_title: 'Test Overview',
        seller_name: 'Test Seller'
      };

      console.log('[AppState] Testing direct table insertion with sample data...');
      
      // Delete existing test record
      try {
        await fetchSupabaseData('DELETE', 'gigs', null, '*', { 
          user_id: 'extension_user', 
          url: 'https://test.com/gig1' 
        });
        console.log('[AppState] Deleted existing test record');
      } catch (deleteError) {
        console.log('[AppState] Delete test record failed (might not exist):', deleteError.message);
      }
      
      // Insert test record
      const insertResult = await fetchSupabaseData('POST', 'gigs', testGig);
      console.log('[AppState] Direct insert test result:', insertResult);

      // Verify insertion by querying
      const queryResult = await fetchSupabaseData('GET', 'gigs', null, '*', { user_id: 'extension_user' });
      console.log('[AppState] Query test result:', queryResult);

      return { 
        success: true, 
        connection: connectionStatus,
        insertTest: insertResult,
        queryTest: queryResult
      };

    } catch (error) {
      console.error('[AppState] Supabase setup test failed:', error);
      return { 
        success: false, 
        error: error.message,
        connection: connectionStatus
      };
    }
  }

  // Gig data management
  async function saveGigsToStorage(gigs) {
    await setStorage({ [GIGS_STORAGE_KEY]: gigs });
    return gigs;
  }

  async function getGigsFromStorage() {
    const data = await getStorage(GIGS_STORAGE_KEY);
    return data[GIGS_STORAGE_KEY] || [];
  }

  async function saveGigsToSupabase(gigs) {
    console.log('[AppState] Starting saveGigsToSupabase with', gigs.length, 'gigs');
    
    if (!supabaseClient) {
      console.log('[AppState] Supabase client not initialized, initializing...');
      await initializeSupabase();
    }

    if (!connectionStatus.connected) {
      console.error('[AppState] Supabase not connected, status:', connectionStatus);
      throw new Error('Supabase not connected');
    }

    console.log('[AppState] Supabase is connected, proceeding with save...');

    try {
      // Save comprehensive gig data to Supabase
      let count = 0;
      for (const gig of gigs) {
        try {
          console.log(`[AppState] Processing gig ${count + 1}/${gigs.length}:`, gig.title || gig.url);
          
          // Prepare comprehensive gig data for Supabase
          const gigData = {
            url: gig.url || '',
            title: gig.title || '',
            edit_url: gig.editUrl || '',
            scraped_at: gig.scraped_at || new Date().toISOString(),
            user_id: 'extension_user',
            
            // Overview data - handle both old and new structure
            overview_title: gig.overview?.title || gig.title || '',
            overview_description: gig.overview?.description || '',
            seller_name: gig.overview?.seller_info?.name || '',
            seller_rating: gig.overview?.seller_info?.rating || '',
            seller_level: gig.overview?.seller_info?.level || '',
            delivery_time: gig.overview?.delivery_time || '',
            revisions: gig.overview?.revisions || '',
            tags: JSON.stringify(gig.overview?.tags || []),
            images: JSON.stringify(gig.overview?.images || []),
            video_url: gig.overview?.video || '',
            
            // Pricing data - handle both old and new structure
            packages: JSON.stringify(gig.pricing?.packages || gig.overview?.packages || []),
            extras: JSON.stringify(gig.pricing?.extras || gig.overview?.extras || []),
            currency: gig.pricing?.currency || '',
            
            // Description data - handle both old and new structure
            description_content: gig.description?.description || gig.overview?.description || '',
            faq: JSON.stringify(gig.description?.faq || []),
            features: JSON.stringify(gig.description?.features || []),
            benefits: JSON.stringify(gig.description?.benefits || []),
            process: JSON.stringify(gig.description?.process || []),
            
            // Requirements data
            requirements: JSON.stringify(gig.requirements?.requirements || []),
            what_to_provide: JSON.stringify(gig.requirements?.what_to_provide || []),
            what_you_get: JSON.stringify(gig.requirements?.what_you_get || []),
            additional_info: gig.requirements?.additional_info || '',
            
            // Gallery data
            gallery_images: JSON.stringify(gig.gallery?.images || []),
            gallery_videos: JSON.stringify(gig.gallery?.videos || []),
            portfolio_items: JSON.stringify(gig.gallery?.portfolio_items || []),
            categories: JSON.stringify(gig.gallery?.categories || []),
            
            // Metadata
            metadata: JSON.stringify(gig.metadata || {}),
            error: gig.error || null
          };

          console.log(`[AppState] Prepared gig data for Supabase:`, {
            url: gigData.url,
            title: gigData.title,
            overview_title: gigData.overview_title,
            seller_name: gigData.seller_name
          });

          // Use direct table insert instead of RPC function
          try {
            console.log(`[AppState] Attempting direct insert for gig:`, gigData.title);
            
            // First, try to delete existing record with same user_id and url
            try {
              await fetchSupabaseData('DELETE', 'gigs', null, '*', { 
                user_id: gigData.user_id, 
                url: gigData.url 
              });
              console.log(`[AppState] Deleted existing record for:`, gigData.url);
            } catch (deleteError) {
              console.log(`[AppState] Delete failed (might not exist):`, deleteError.message);
            }
            
            // Then insert new record using direct fetch
            const insertResult = await fetchSupabaseData('POST', 'gigs', gigData);
            console.log(`[AppState] Direct insert result:`, insertResult);
            
            console.log(`[AppState] Successfully inserted gig:`, gigData.title);
          } catch (insertError) {
            console.error(`[AppState] Direct insert failed:`, insertError);
            throw insertError;
          }
          
          count += 1;
          console.log(`[AppState] Successfully saved gig ${count}/${gigs.length}`);
          
          // Small delay to be polite
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          console.error(`[AppState] Failed to save gig to Supabase:`, e, gig && gig.url);
        }
      }

      console.log(`[AppState] Completed saving ${count}/${gigs.length} gigs to Supabase`);
      return { success: true, count };
    } catch (error) {
      console.error('[AppState] Failed to save gigs to Supabase:', error);
      throw error;
    }
  }

  async function getGigsFromSupabase() {
    if (!supabaseClient) {
      await initializeSupabase();
    }

    if (!connectionStatus.connected) {
      throw new Error('Supabase not connected');
    }

    try {
      const result = await fetchSupabaseData('GET', 'gigs', null, '*', { user_id: 'extension_user' });
      return result || [];
    } catch (error) {
      console.error('Failed to get gigs from Supabase:', error);
      throw error;
    }
  }

  // Sync gigs between local storage and Supabase
  async function syncGigs(gigs) {
    try {
      // Save to local storage first
      await saveGigsToStorage(gigs);
      
      // Try to save to Supabase if connected
      if (connectionStatus.connected) {
        await saveGigsToSupabase(gigs);
      }
      
      return { success: true, synced: connectionStatus.connected };
    } catch (error) {
      console.error('Failed to sync gigs:', error);
      // Still return success for local storage
      return { success: true, synced: false, error: error.message };
    }
  }

  // Simple change notification across contexts
  const listeners = new Set();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (changes[STORAGE_KEY]) {
      const newVal = changes[STORAGE_KEY].newValue || { url: '', key: '' };
      listeners.forEach(cb => {
        try { cb(newVal); } catch(e) { console.error('AppState listener error', e); }
      });
      
      // Reinitialize Supabase when config changes
      initializeSupabase();
    }
  });

  // Expose comprehensive API on window for easy consumption in all scripts
  window.AppState = {
    // Configuration management
    getSupabaseConfig,
    setSupabaseConfig,
    
    // Supabase connection management
    initializeSupabase,
    testSupabaseConnection,
    getConnectionStatus: () => connectionStatus,
    testSupabaseSetup,
    
    // Gig data management
    saveGigsToStorage,
    getGigsFromStorage,
    saveGigsToSupabase,
    getGigsFromSupabase,
    syncGigs,
    
    // Event system
    onChange: (cb)=> { listeners.add(cb); return () => listeners.delete(cb); },
    
    // Utility methods
    getStorage,
    setStorage
  };

  // Auto-initialize Supabase when state.js loads
  initializeSupabase();

  // Write the provided Supabase defaults into storage if they differ from what's stored.
  // This ensures the user-provided NEXT_PUBLIC values are applied immediately.
  (async function ensureDefaultConfig(){
    try{
      const cfg = await getSupabaseConfig();
      const needWrite = !cfg || cfg.url !== DEFAULT_SUPABASE_CONFIG.url || cfg.key !== DEFAULT_SUPABASE_CONFIG.key;
      if (needWrite) {
        await setSupabaseConfig(DEFAULT_SUPABASE_CONFIG);
        // reinitialize with defaults
        await initializeSupabase();
        console.log('Supabase config written/updated in storage');
      } else {
        console.log('Supabase config already matches provided defaults');
      }
    }catch(e){ console.error('ensureDefaultConfig error', e); }
  })();

})();
