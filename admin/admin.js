let adminPassword = '';
let currentContent = null;

const $ = (id) => document.getElementById(id);

async function openAdmin(){
  adminPassword = $('passwordInput').value.trim();
  if(!adminPassword){
    $('loginStatus').textContent = 'Enter password.';
    return;
  }

  $('loginStatus').textContent = 'Checking CMS...';

  try{
    const health = await fetch('/api/health?ts=' + Date.now(), {cache:'no-store'}).then(r => r.json());
    if(!health.worker){
      $('loginStatus').textContent = 'Worker API is not running.';
      return;
    }
    if(!health.kvBindingFound){
      $('loginStatus').textContent = 'KV binding missing. Add CONTENT binding or use archive v37/v38 with wrangler.toml.';
      return;
    }
    if(!health.kvWriteTest || !health.kvReadTest){
      $('loginStatus').textContent = 'KV is connected but write/read test failed.';
      return;
    }

    await loadContent();
    $('loginPanel').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
    $('loginStatus').textContent = '';
    $('saveStatus').textContent = `CMS connected: ${health.binding}. Content key: ${health.contentKey}.`;
    await loadRequests();
  }catch(error){
    $('loginStatus').textContent = 'Cannot open admin. Worker API is not deployed or /api/health failed.';
  }
}

$('loginButton').addEventListener('click', openAdmin);

$('passwordInput').addEventListener('keydown', (event) => {
  if(event.key === 'Enter'){
    event.preventDefault();
    openAdmin();
  }
});

document.querySelectorAll('.tabs button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    button.classList.add('active');
    $(button.dataset.tab).classList.add('active');
    syncRawJson();
  });
});

async function loadContent(){
  let response = await fetch('/api/content?ts=' + Date.now(), {cache:'no-store'});
  if(!response.ok){
    response = await fetch('../data/content.json', {cache:'no-store'});
  }
  currentContent = await response.json();
  delete currentContent._cms;
  normalizeContent();
  renderAllEditors();
}

function normalizeContent(){
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

  $('siteBrand').value = site.brand || '';
  $('siteEyebrow').value = site.eyebrow || '';
  $('heroTitle').value = site.heroTitle || '';
  $('heroText').value = site.heroText || '';
  $('primaryButton').value = site.primaryButton || '';
  $('secondaryButton').value = site.secondaryButton || '';
  $('rootNote').value = site.rootNote || '';

  $('visionCode').value = sections.vision.code || '';
  $('visionTitle').value = sections.vision.title || '';
  $('visionText').value = sections.vision.text || '';

  $('catalogCode').value = sections.catalog.code || '';
  $('catalogTitle').value = sections.catalog.title || '';

  $('operationsCode').value = sections.operations.code || '';
  $('operationsTitle').value = sections.operations.title || '';
  $('operationsStepsEditor').value = (sections.operations.steps || []).map(s => `${s.title || ''} | ${s.text || ''}`).join('\n');
  $('terminalEditor').value = (sections.operations.terminal || []).map(([k,v]) => `${k || ''} | ${v || ''}`).join('\n');

  $('contactCode').value = sections.contact.code || '';
  $('contactTitle').value = sections.contact.title || '';
  $('contactText').value = sections.contact.text || '';
  $('contactNote').value = sections.contact.note || '';
  $('contactSuccess').value = sections.contact.success || '';
}

function collectHomeEditor(){
  const site = currentContent.site;
  const sections = currentContent.sections;

  site.brand = $('siteBrand').value;
  site.eyebrow = $('siteEyebrow').value;
  site.heroTitle = $('heroTitle').value;
  site.heroText = $('heroText').value;
  site.primaryButton = $('primaryButton').value;
  site.secondaryButton = $('secondaryButton').value;
  site.rootNote = $('rootNote').value;

  sections.vision = {
    code: $('visionCode').value,
    title: $('visionTitle').value,
    text: $('visionText').value
  };

  sections.catalog = {
    code: $('catalogCode').value,
    title: $('catalogTitle').value
  };

  sections.operations = {
    code: $('operationsCode').value,
    title: $('operationsTitle').value,
    steps: parsePipeLines($('operationsStepsEditor').value).map(([title, text]) => ({title, text})),
    terminal: parsePipeLines($('terminalEditor').value)
  };

  sections.contact = {
    code: $('contactCode').value,
    title: $('contactTitle').value,
    text: $('contactText').value,
    note: $('contactNote').value,
    success: $('contactSuccess').value
  };
}

function parsePipeLines(value){
  return value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split('|');
    const left = (parts.shift() || '').trim();
    const right = parts.join('|').trim();
    return [left, right];
  });
}

function renderServicesEditor(){
  const box = $('servicesEditor');
  box.innerHTML = '';
  currentContent.services.forEach((service, index) => {
    const item = document.createElement('div');
    item.className = 'service-edit';
    item.innerHTML = `
      <header>
        <strong>${String(service.number || index + 1).padStart(2,'0')} / ${escapeHtml(service.title || 'Service')}</strong>
        <button type="button" data-remove="${index}">[ remove ]</button>
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
      if(input.dataset.field === 'price') $('saveStatus').textContent = 'Price changed. Click Save changes.';
      if(input.dataset.field === 'image'){
        const preview = input.closest('.service-edit')?.querySelector('.image-preview img');
        if(preview) preview.src = input.value;
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

      $('saveStatus').textContent = 'Compressing image...';

      try{
        const dataUrl = await compressImageToWebP(file, 1200, 0.82);
        currentContent.services[index].image = dataUrl;

        const imageInput = serviceBox.querySelector('[data-field="image"]');
        const preview = serviceBox.querySelector('.image-preview img');

        if(imageInput) imageInput.value = dataUrl;
        if(preview) preview.src = dataUrl;
        $('saveStatus').textContent = 'Image uploaded. Click [save changes] to publish it.';
        syncRawJson();
      }catch(error){
        $('saveStatus').textContent = 'Image upload failed. Try another image.';
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

$('addService').addEventListener('click', () => {
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
});


function collectServicesEditor(){
  const cards = [...document.querySelectorAll('#servicesEditor .service-edit')];
  const services = cards.map((card, fallbackIndex) => {
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

  currentContent.services = services;
}

function renderLegalEditor(){
  $('privacyHtml').value = currentContent.legal.privacyHtml || '';
  $('termsHtml').value = currentContent.legal.termsHtml || '';
}
function collectLegalEditor(){
  currentContent.legal.privacyHtml = $('privacyHtml').value;
  currentContent.legal.termsHtml = $('termsHtml').value;
}

function renderCompanyEditor(){
  const c = currentContent.company;
  $('companyLegalForm').value = c.legalForm || '';
  $('companySiren').value = c.siren || '';
  $('companyBase').value = c.base || '';
  $('companyEmail').value = c.email || '';
  $('companyAddress').value = c.address || '';
  $('companyTva').value = c.tva || '';
  $('companyPhone').value = c.phone || '';
  $('companyActivity').value = c.activity || '';
}
function collectCompanyEditor(){
  currentContent.company = {
    legalForm: $('companyLegalForm').value,
    siren: $('companySiren').value,
    base: $('companyBase').value,
    email: $('companyEmail').value,
    address: $('companyAddress').value,
    tva: $('companyTva').value,
    phone: $('companyPhone').value,
    activity: $('companyActivity').value
  };
}

function renderSeoEditor(){
  const s = currentContent.seo;
  $('seoHomeTitle').value = s.homeTitle || '';
  $('seoHomeDescription').value = s.homeDescription || '';
  $('seoPrivacyTitle').value = s.privacyTitle || '';
  $('seoTermsTitle').value = s.termsTitle || '';
}
function collectSeoEditor(){
  currentContent.seo = {
    homeTitle: $('seoHomeTitle').value,
    homeDescription: $('seoHomeDescription').value,
    privacyTitle: $('seoPrivacyTitle').value,
    termsTitle: $('seoTermsTitle').value
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

['saveButton','saveTop'].forEach(id => $(id)?.addEventListener('click', saveAll));

async function saveAll(){
  collectAllEditors();
  $('saveStatus').textContent = 'Saving changes...';

  const response = await fetch('/api/content', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({password:adminPassword, content:currentContent})
  });

  const data = await response.json().catch(() => ({}));

  if(!response.ok || !data.ok){
    $('saveStatus').textContent = data.error || 'Save failed.';
    return;
  }

  $('saveStatus').textContent = 'Saved. Verifying changes...';

  const verifyResponse = await fetch('/api/content?ts=' + Date.now(), {cache:'no-store'});
  const verifyData = await verifyResponse.json().catch(() => null);

  if(verifyData && verifyData._cms && verifyData._cms.source === 'kv'){
    $('saveStatus').textContent = `Changes saved successfully. Services updated: ${verifyData.services ? verifyData.services.length : 0}. Refresh the public site with Ctrl+F5.`;
  }else{
    $('saveStatus').textContent = 'Saved, but public read did not verify KV source. Check Worker deployment.';
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
$('downloadButton')?.addEventListener('click', downloadContent);

function syncRawJson(){
  const raw = $('rawJson');
  if(raw) raw.value = JSON.stringify(currentContent, null, 2);
}
$('applyRawJson')?.addEventListener('click', () => {
  try{
    currentContent = JSON.parse($('rawJson').value);
    normalizeContent();
    renderAllEditors();
    $('saveStatus').textContent = 'Raw JSON applied. Click [save changes] to publish.';
  }catch(error){
    $('saveStatus').textContent = 'Invalid JSON.';
  }
});

$('reloadRequests').addEventListener('click', loadRequests);

async function loadRequests(){
  const list = $('requestsList');
  list.innerHTML = '<p class="muted">Loading requests...</p>';
  try{
    const response = await fetch(`/api/contact?password=${encodeURIComponent(adminPassword)}&ts=${Date.now()}`, {cache:'no-store'});
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

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(value){
  return escapeHtml(value).replace(/`/g, '&#96;');
}
