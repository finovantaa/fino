let adminPassword = '';
let currentContent = null;

const $ = (id) => document.getElementById(id);

$('loginButton').addEventListener('click', async () => {
  adminPassword = $('passwordInput').value.trim();
  if(!adminPassword){
    $('loginStatus').textContent = 'Enter password.';
    return;
  }
  $('loginStatus').textContent = 'Loading...';
  try{
    await loadContent();
    $('loginPanel').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
    $('loginStatus').textContent = '';
    await loadRequests();
  }catch(error){
    $('loginStatus').textContent = 'Cannot open admin. Check password / Cloudflare settings.';
  }
});

document.querySelectorAll('.tabs button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    button.classList.add('active');
    $(button.dataset.tab).classList.add('active');
  });
});

async function loadContent(){
  let response = await fetch('/api/content', {cache:'no-store'});
  if(!response.ok){
    response = await fetch('../data/content.json', {cache:'no-store'});
  }
  currentContent = await response.json();
  renderContentEditor();
}

function renderContentEditor(){
  const site = currentContent.site || {};
  $('siteBrand').value = site.brand || 'FINOVANTA';
  $('siteEyebrow').value = site.eyebrow || '';
  $('heroTitle').value = site.heroTitle || '';
  $('heroText').value = site.heroText || '';
  $('rootNote').value = site.rootNote || '';

  const box = $('servicesEditor');
  box.innerHTML = '';
  (currentContent.services || []).forEach((service, index) => {
    const item = document.createElement('div');
    item.className = 'service-edit';
    item.innerHTML = `
      <header>
        <strong>${String(service.number || index + 1).padStart(2,'0')} / ${escapeHtml(service.title || 'Service')}</strong>
        <button type="button" data-remove="${index}">[ remove ]</button>
      </header>
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
      <label>Image path<input data-field="image" data-index="${index}" value="${escapeAttr(service.image || '')}"></label>
    `;
    box.appendChild(item);
  });

  box.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      const index = Number(input.dataset.index);
      currentContent.services[index][input.dataset.field] = input.value;
    });
  });

  box.querySelectorAll('[data-remove]').forEach(button => {
    button.addEventListener('click', () => {
      currentContent.services.splice(Number(button.dataset.remove), 1);
      renderContentEditor();
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
  renderContentEditor();
});

$('saveButton').addEventListener('click', async () => {
  collectSiteFields();
  $('saveStatus').textContent = 'Saving...';
  const response = await fetch('/api/content', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({password:adminPassword, content:currentContent})
  });
  if(response.ok){
    $('saveStatus').textContent = 'Saved. Open the site and refresh to see changes.';
  }else{
    const error = await response.json().catch(() => ({}));
    $('saveStatus').textContent = error.error || 'Save failed.';
  }
});

$('downloadButton').addEventListener('click', () => {
  collectSiteFields();
  const blob = new Blob([JSON.stringify(currentContent, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'content.json';
  a.click();
  URL.revokeObjectURL(url);
});

function collectSiteFields(){
  currentContent.site = {
    ...currentContent.site,
    brand: $('siteBrand').value,
    eyebrow: $('siteEyebrow').value,
    heroTitle: $('heroTitle').value,
    heroText: $('heroText').value,
    rootNote: $('rootNote').value
  };
}

$('reloadRequests').addEventListener('click', loadRequests);

async function loadRequests(){
  const list = $('requestsList');
  list.innerHTML = '<p class="muted">Loading requests...</p>';
  try{
    const response = await fetch(`/api/contact?password=${encodeURIComponent(adminPassword)}`, {cache:'no-store'});
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
    list.innerHTML = '<p class="muted">Requests unavailable. Check Cloudflare Functions and KV binding.</p>';
  }
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(value){
  return escapeHtml(value).replace(/`/g, '&#96;');
}
