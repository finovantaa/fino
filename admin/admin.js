let adminPassword = '';
let currentContent = null;

function $(id){ return document.getElementById(id); }

function setStatus(text, type = ''){
  const el = $('loginStatus');
  if(!el) return;
  el.textContent = text;
  el.dataset.type = type;
}

document.addEventListener('DOMContentLoaded', () => {
  const loginButton = $('loginButton');
  const passwordInput = $('passwordInput');

  if(loginButton){
    loginButton.addEventListener('click', openAdmin);
  }

  if(passwordInput){
    passwordInput.addEventListener('keydown', (event) => {
      if(event.key === 'Enter'){
        event.preventDefault();
        openAdmin();
      }
    });
  }

  document.querySelectorAll('.tabs button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      button.classList.add('active');
      $(button.dataset.tab)?.classList.add('active');
      syncRawJson();
    });
  });

  $('logoutButton')?.addEventListener('click', logoutAdmin);
  $('saveButton')?.addEventListener('click', saveAll);
  $('saveTop')?.addEventListener('click', saveAll);
  $('addService')?.addEventListener('click', addService);
  $('downloadButton')?.addEventListener('click', downloadContent);
  $('applyRawJson')?.addEventListener('click', applyRawJson);
  $('reloadRequests')?.addEventListener('click', loadRequests);
  $('restoreArchiveButton')?.addEventListener('click', restoreContentFromArchive);
});

async function openAdmin(){
  const passwordInput = $('passwordInput');
  const loginButton = $('loginButton');
  adminPassword = (passwordInput?.value || '').trim();

  if(!adminPassword){
    setStatus('Enter password.', 'error');
    return;
  }

  if(loginButton) loginButton.disabled = true;
  setStatus('Checking password...', 'loading');

  try{
    const authResponse = await fetch('/api/auth?ts=' + Date.now(), {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Cache-Control':'no-cache'},
      body:JSON.stringify({password:adminPassword})
    });

    const authData = await authResponse.json().catch(() => ({}));

    if(!authResponse.ok || !authData.ok || !authData.authenticated){
      adminPassword = '';
      if(passwordInput) passwordInput.value = '';
      setStatus(authData.error || 'Wrong admin password.', 'error');
      if(loginButton) loginButton.disabled = false;
      return;
    }
  }catch(error){
    setStatus('Login API error. Open /api/auth is not available. Redeploy v43.', 'error');
    if(loginButton) loginButton.disabled = false;
    return;
  }

  setStatus('Checking CMS...', 'loading');

  try{
    const healthResponse = await fetch('/api/health?ts=' + Date.now(), {
      cache:'no-store',
      headers:{'Cache-Control':'no-cache'}
    });

    const health = await healthResponse.json();

    if(!health.worker){
      setStatus('Worker API is not running.', 'error');
      if(loginButton) loginButton.disabled = false;
      return;
    }

    if(!health.adminPasswordConfigured){
      setStatus('ADMIN_PASSWORD is not configured in Cloudflare.', 'error');
      if(loginButton) loginButton.disabled = false;
      return;
    }

    if(!health.kvBindingFound){
      setStatus('KV binding missing. CONTENT binding is required.', 'error');
      if(loginButton) loginButton.disabled = false;
      return;
    }

    if(!health.kvWriteTest || !health.kvReadTest){
      setStatus('KV is connected but write/read test failed.', 'error');
      if(loginButton) loginButton.disabled = false;
      return;
    }

    await loadContent();

    $('loginPanel')?.classList.add('hidden');
    $('dashboard')?.classList.remove('hidden');

    const saveStatus = $('saveStatus');
    if(saveStatus) saveStatus.textContent = `CMS connected: ${health.binding}.`;

    await loadRequests();
  }catch(error){
    adminPassword = '';
    if(passwordInput) passwordInput.value = '';
    setStatus('Cannot open admin. Check /api/health after deploy.', 'error');
  }finally{
    if(loginButton) loginButton.disabled = false;
  }
}

function logoutAdmin(){
  adminPassword = '';
  currentContent = null;
  if($('passwordInput')) $('passwordInput').value = '';
  if($('saveStatus')) $('saveStatus').textContent = '';
  setStatus('Logged out.', 'ok');
  $('dashboard')?.classList.add('hidden');
  $('loginPanel')?.classList.remove('hidden');
  setTimeout(() => $('passwordInput')?.focus(), 50);
}

async function loadContent(){
  let response = await fetch('/api/content?ts=' + Date.now(), {
    cache:'no-store',
    headers:{'Cache-Control':'no-cache'}
  });

  if(!response.ok){
    response = await fetch('../data/content.json?ts=' + Date.now(), {cache:'no-store'});
  }

  currentContent = await response.json();
  delete currentContent._cms;
  normalizeContent();
  renderAllEditors();
}

function normalizeContent(){
  currentContent ||= {};
  currentContent.site ||= {};
  currentContent.sections ||= {};
  currentContent.sections.vision ||= {};
  currentContent.sections.catalog ||= {};
  currentContent.sections.operations ||= {steps:[], terminal:[]};
  currentContent.sections.contact ||= {};
  currentContent.company ||= {};
  currentContent.seo ||= {};
  currentContent.legal ||= {};
  currentContent.services ||= [];
}

function renderAllEditors(){
  renderHomeEditor();
  renderServicesEditor();
  renderLegalEditor();
  renderCompanyEditor();
  renderSeoEditor();
  syncRawJson();
}

function renderHomeEditor(){
  const site = currentContent.site;
  const sections = currentContent.sections;

  setValue('siteBrand', site.brand);
  setValue('siteEyebrow', site.eyebrow);
  setValue('heroTitle', site.heroTitle);
  setValue('heroText', site.heroText);
  setValue('primaryButton', site.primaryButton);
  setValue('secondaryButton', site.secondaryButton);
  setValue('rootNote', site.rootNote);

  setValue('visionCode', sections.vision.code);
  setValue('visionTitle', sections.vision.title);
  setValue('visionText', sections.vision.text);

  setValue('catalogCode', sections.catalog.code);
  setValue('catalogTitle', sections.catalog.title);

  setValue('operationsCode', sections.operations.code);
  setValue('operationsTitle', sections.operations.title);
  setValue('operationsStepsEditor', (sections.operations.steps || []).map(s => `${s.title || ''} | ${s.text || ''}`).join('\n'));
  setValue('terminalEditor', (sections.operations.terminal || []).map(([k,v]) => `${k || ''} | ${v || ''}`).join('\n'));

  setValue('contactCode', sections.contact.code);
  setValue('contactTitle', sections.contact.title);
  setValue('contactText', sections.contact.text);
  setValue('contactNote', sections.contact.note);
  setValue('contactSuccess', sections.contact.success);
}

function collectHomeEditor(){
  const site = currentContent.site;
  const sections = currentContent.sections;

  site.brand = getValue('siteBrand');
  site.eyebrow = getValue('siteEyebrow');
  site.heroTitle = getValue('heroTitle');
  site.heroText = getValue('heroText');
  site.primaryButton = getValue('primaryButton');
  site.secondaryButton = getValue('secondaryButton');
  site.rootNote = getValue('rootNote');

  sections.vision = {
    code: getValue('visionCode'),
    title: getValue('visionTitle'),
    text: getValue('visionText')
  };

  sections.catalog = {
    code: getValue('catalogCode'),
    title: getValue('catalogTitle')
  };

  sections.operations = {
    code: getValue('operationsCode'),
    title: getValue('operationsTitle'),
    steps: parsePipeLines(getValue('operationsStepsEditor')).map(([title, text]) => ({title, text})),
    terminal: parsePipeLines(getValue('terminalEditor'))
  };

  sections.contact = {
    code: getValue('contactCode'),
    title: getValue('contactTitle'),
    text: getValue('contactText'),
    note: getValue('contactNote'),
    success: getValue('contactSuccess')
  };
}

function parsePipeLines(value){
  return String(value || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split('|');
    const left = (parts.shift() || '').trim();
    const right = parts.join('|').trim();
    return [left, right];
  });
}

function renderServicesEditor(){
  const box = $('servicesEditor');
  if(!box) return;

  box.innerHTML = '';

  currentContent.services.forEach((service, index) => {
    const item = document.createElement('div');
    item.className = 'service-edit';
    item.innerHTML = `
      <header>
        <strong>${escapeHtml(String(service.number || index + 1).padStart(2,'0'))} / ${escapeHtml(service.title || 'Service')}</strong>
        <button type="button" data-remove="${index}">Remove</button>
      </header>

      <div class="image-admin">
        <div class="image-preview">
          <img src="${escapeAttr(service.image || '')}" alt="">
        </div>
        <div>
          <label>Upload image
            <input type="file" accept="image/*" data-image-upload="${index}">
          </label>
          <p class="muted small-note">Compressed to WebP in browser and saved with this card.</p>
        </div>
      </div>

      <div class="grid two">
        <label>Number<input data-field="number" data-index="${index}" value="${escapeAttr(service.number || '')}"></label>
        <label>Category<input data-field="category" data-index="${index}" value="${escapeAttr(service.category || '')}"></label>
      </div>
      <div class="grid two">
        <label>Tag<input data-field="tag" data-index="${index}" value="${escapeAttr(service.tag || '')}"></label>
        <label>Price<input data-field="price" data-index="${index}" value="${escapeAttr(service.price || '')}"></label>
      </div>
      <label>Title<input data-field="title" data-index="${index}" value="${escapeAttr(service.title || '')}"></label>
      <label>Description<textarea data-field="description" data-index="${index}" rows="3">${escapeHtml(service.description || '')}</textarea></label>
      <label>Image path / uploaded data<input data-field="image" data-index="${index}" value="${escapeAttr(service.image || '')}"></label>
    `;
    box.appendChild(item);
  });

  box.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      const index = Number(input.dataset.index);
      currentContent.services[index][input.dataset.field] = input.value;

      if(input.dataset.field === 'image'){
        const preview = input.closest('.service-edit')?.querySelector('.image-preview img');
        if(preview) preview.src = input.value;
      }

      if(input.dataset.field === 'price' && $('saveStatus')){
        $('saveStatus').textContent = 'Price changed. Click Save changes.';
      }

      syncRawJson();
    });
  });

  box.querySelectorAll('[data-image-upload]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if(!file) return;

      const index = Number(input.dataset.imageUpload);
      const serviceBox = input.closest('.service-edit');

      if($('saveStatus')) $('saveStatus').textContent = 'Compressing image...';

      try{
        const dataUrl = await compressImageToWebP(file, 1200, 0.82);
        currentContent.services[index].image = dataUrl;

        const imageInput = serviceBox.querySelector('[data-field="image"]');
        const preview = serviceBox.querySelector('.image-preview img');

        if(imageInput) imageInput.value = dataUrl;
        if(preview) preview.src = dataUrl;
        if($('saveStatus')) $('saveStatus').textContent = 'Image uploaded. Click Save changes.';
        syncRawJson();
      }catch(error){
        if($('saveStatus')) $('saveStatus').textContent = 'Image upload failed. Try another image.';
      }
    });
  });

  box.querySelectorAll('[data-remove]').forEach(button => {
    button.addEventListener('click', () => {
      currentContent.services.splice(Number(button.dataset.remove), 1);
      renderServicesEditor();
      syncRawJson();
    });
  });
}

function collectServicesEditor(){
  const cards = [...document.querySelectorAll('#servicesEditor .service-edit')];

  currentContent.services = cards.map((card, fallbackIndex) => {
    const pick = (field) => {
      const input = card.querySelector(`[data-field="${field}"]`);
      return input ? input.value : '';
    };

    return {
      id: currentContent.services?.[fallbackIndex]?.id || `service-${fallbackIndex + 1}`,
      number: pick('number') || String(fallbackIndex + 1).padStart(2,'0'),
      category: pick('category'),
      tag: pick('tag'),
      title: pick('title'),
      description: pick('description'),
      price: pick('price'),
      image: pick('image')
    };
  });
}

function addService(){
  currentContent.services.push({
    id: `service-${Date.now()}`,
    number: String(currentContent.services.length + 1).padStart(2,'0'),
    category: 'New service',
    tag: 'New',
    title: 'New Service',
    description: 'Service description.',
    price: '€000',
    image: 'assets/services/web-visual.webp'
  });
  renderServicesEditor();
  syncRawJson();
}

function renderLegalEditor(){
  setValue('privacyHtml', currentContent.legal.privacyHtml);
  setValue('termsHtml', currentContent.legal.termsHtml);
}
function collectLegalEditor(){
  currentContent.legal.privacyHtml = getValue('privacyHtml');
  currentContent.legal.termsHtml = getValue('termsHtml');
}

function renderCompanyEditor(){
  const c = currentContent.company;
  setValue('companyLegalForm', c.legalForm);
  setValue('companySiren', c.siren);
  setValue('companyBase', c.base);
  setValue('companyEmail', c.email);
  setValue('companyAddress', c.address);
  setValue('companyTva', c.tva);
  setValue('companyPhone', c.phone);
  setValue('companyActivity', c.activity);
}
function collectCompanyEditor(){
  currentContent.company = {
    legalForm: getValue('companyLegalForm'),
    siren: getValue('companySiren'),
    base: getValue('companyBase'),
    email: getValue('companyEmail'),
    address: getValue('companyAddress'),
    tva: getValue('companyTva'),
    phone: getValue('companyPhone'),
    activity: getValue('companyActivity')
  };
}

function renderSeoEditor(){
  const s = currentContent.seo;
  setValue('seoHomeTitle', s.homeTitle);
  setValue('seoHomeDescription', s.homeDescription);
  setValue('seoPrivacyTitle', s.privacyTitle);
  setValue('seoTermsTitle', s.termsTitle);
}
function collectSeoEditor(){
  currentContent.seo = {
    homeTitle: getValue('seoHomeTitle'),
    homeDescription: getValue('seoHomeDescription'),
    privacyTitle: getValue('seoPrivacyTitle'),
    termsTitle: getValue('seoTermsTitle')
  };
}

function collectAllEditors(){
  collectHomeEditor();
  collectServicesEditor();
  collectLegalEditor();
  collectCompanyEditor();
  collectSeoEditor();
  syncRawJson();
}

async function saveAll(){
  collectAllEditors();

  if(!adminPassword){
    if($('saveStatus')) $('saveStatus').textContent = 'You are logged out. Enter password again.';
    return;
  }

  if($('saveStatus')) $('saveStatus').textContent = 'Saving changes...';

  const response = await fetch('/api/content', {
    method:'POST',
    headers:{'Content-Type':'application/json', 'Cache-Control':'no-cache'},
    body:JSON.stringify({password:adminPassword, content:currentContent})
  });

  const data = await response.json().catch(() => ({}));

  if(!response.ok || !data.ok){
    if($('saveStatus')) $('saveStatus').textContent = data.error || 'Save failed.';
    return;
  }

  if($('saveStatus')) $('saveStatus').textContent = 'Saved. Verifying changes...';

  const verifyResponse = await fetch('/api/content?ts=' + Date.now(), {
    cache:'no-store',
    headers:{'Cache-Control':'no-cache'}
  });
  const verifyData = await verifyResponse.json().catch(() => null);

  if(verifyData && verifyData._cms && verifyData._cms.source === 'kv'){
    if($('saveStatus')) $('saveStatus').textContent = `Changes saved successfully. Services updated: ${verifyData.services ? verifyData.services.length : 0}.`;
  }else{
    if($('saveStatus')) $('saveStatus').textContent = 'Saved, but public read did not verify KV source.';
  }
}

async function loadRequests(){
  const list = $('requestsList');
  if(!list || !adminPassword) return;

  list.innerHTML = '<p class="muted">Loading requests...</p>';

  try{
    const response = await fetch(`/api/contact?password=${encodeURIComponent(adminPassword)}&ts=${Date.now()}`, {
      cache:'no-store',
      headers:{'Cache-Control':'no-cache'}
    });

    const data = await response.json();
    const requests = data.requests || [];

    if(!requests.length){
      list.innerHTML = '<p class="muted">No requests yet.</p>';
      return;
    }

    list.innerHTML = requests.map(item => `
      <article class="request-item">
        <header><span>${escapeHtml(item.name || 'No name')} · ${escapeHtml(item.email || '')}</span><time>${escapeHtml(item.createdAt || '')}</time></header>
        <p>${escapeHtml(item.message || '')}</p>
      </article>
    `).join('');
  }catch(error){
    list.innerHTML = '<p class="muted">Requests unavailable. Check Worker/KV binding.</p>';
  }
}


async function restoreContentFromArchive(){
  if(!adminPassword){
    if($('saveStatus')) $('saveStatus').textContent = 'You are logged out. Enter password again.';
    return;
  }

  const confirmed = confirm('Restore content from the archive? This will replace current KV content, including services, prices, policies and page text.');
  if(!confirmed) return;

  if($('saveStatus')) $('saveStatus').textContent = 'Restoring content from archive...';

  try{
    const response = await fetch('/api/reset-content', {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Cache-Control':'no-cache'},
      body:JSON.stringify({password:adminPassword})
    });

    const data = await response.json().catch(() => ({}));

    if(!response.ok || !data.ok){
      if($('saveStatus')) $('saveStatus').textContent = data.error || 'Restore failed.';
      return;
    }

    await loadContent();

    if($('saveStatus')) {
      $('saveStatus').textContent = `Content restored from archive. Services restored: ${data.servicesCount || 0}. Refresh the public site with Ctrl+F5.`;
    }
  }catch(error){
    if($('saveStatus')) $('saveStatus').textContent = 'Restore failed. Check Worker deployment.';
  }
}


function downloadContent(){
  collectAllEditors();
  const blob = new Blob([JSON.stringify(currentContent, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'content.json';
  a.click();
  URL.revokeObjectURL(url);
}

function applyRawJson(){
  try{
    currentContent = JSON.parse(getValue('rawJson'));
    normalizeContent();
    renderAllEditors();
    if($('saveStatus')) $('saveStatus').textContent = 'Raw JSON applied. Click Save changes.';
  }catch(error){
    if($('saveStatus')) $('saveStatus').textContent = 'Invalid JSON.';
  }
}

function syncRawJson(){
  const raw = $('rawJson');
  if(raw && currentContent) raw.value = JSON.stringify(currentContent, null, 2);
}

function compressImageToWebP(file, maxWidth = 1200, quality = 0.82){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/webp', quality));
      };

      img.onerror = reject;
      img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setValue(id, value){
  const el = $(id);
  if(el) el.value = value || '';
}

function getValue(id){
  const el = $(id);
  return el ? el.value : '';
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(value){
  return escapeHtml(value).replace(/`/g, '&#96;');
}
