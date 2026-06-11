document.documentElement.classList.add('js');

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const observer = new IntersectionObserver((entries)=>{
  for(const entry of entries){ if(entry.isIntersecting) entry.target.classList.add('is-visible') }
},{threshold:.14});
document.querySelectorAll('[data-reveal]').forEach(el=>{ observer.observe(el); setTimeout(()=>el.classList.add('is-visible'), 80); });

let siteContent = null;

async function loadSiteContent(){
  try{
    const response = await fetch('/api/content?ts=' + Date.now(), {cache:'no-store', headers:{'Cache-Control':'no-cache'}});
    if(!response.ok) throw new Error('API unavailable');
    siteContent = await response.json();
  }catch(error){
    try{
      const fallback = await fetch('data/content.json', {cache:'no-store'});
      if(fallback.ok) siteContent = await fallback.json();
    }catch(_){}
  }
  applySiteContent(siteContent || {});
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el && typeof value === 'string') el.textContent = value;
}
function setHtml(id, value){
  const el = document.getElementById(id);
  if(el && typeof value === 'string') el.innerHTML = value;
}
function setMeta(id, value){
  const el = document.getElementById(id);
  if(el && typeof value === 'string') el.setAttribute('content', value);
}

function applySiteContent(content){
  const site = content.site || {};
  const sections = content.sections || {};
  const company = content.company || {};
  const seo = content.seo || {};
  const legal = content.legal || {};

  if(document.getElementById('serviceGrid')){
    document.title = seo.homeTitle || document.title;
    setMeta('pageDescription', seo.homeDescription);
    setText('heroEyebrow', site.eyebrow);
    setText('heroTitle', site.heroTitle);
    setText('heroText', site.heroText);
    setText('rootNote', site.rootNote);
    setText('primaryButton', site.primaryButton);
    setText('secondaryButton', site.secondaryButton);

    if(sections.vision){
      setText('visionCode', sections.vision.code);
      setText('visionTitle', sections.vision.title);
      setText('visionText', sections.vision.text);
    }
    if(sections.catalog){
      setText('catalogCode', sections.catalog.code);
      setText('catalogTitle', sections.catalog.title);
    }
    if(sections.operations){
      setText('operationsCode', sections.operations.code);
      setText('operationsTitle', sections.operations.title);
      renderOperationsSteps(sections.operations.steps || []);
      renderTerminal(sections.operations.terminal || []);
    }
    if(sections.contact){
      setText('contactCode', sections.contact.code);
      setText('contactTitle', sections.contact.title);
      setText('contactText', sections.contact.text);
      setText('contactNote', sections.contact.note);
    }

    setText('companyLegalForm', company.legalForm);
    setText('companySiren', company.siren);
    setText('companyBase', company.base);

    if(Array.isArray(content.services)) renderServices(content.services);
  }

  if(document.getElementById('privacyContent')){
    document.title = seo.privacyTitle || document.title;
    setHtml('privacyContent', legal.privacyHtml);
  }

  if(document.getElementById('termsContent')){
    document.title = seo.termsTitle || document.title;
    setHtml('termsContent', legal.termsHtml);
  }
}

function renderOperationsSteps(steps){
  const list = document.getElementById('operationsSteps');
  if(!list) return;
  list.innerHTML = steps.map(step => `<li><b>${escapeHtml(step.title)}</b><span>${escapeHtml(step.text)}</span></li>`).join('');
}

let terminalInterval = null;
function renderTerminal(lines){
  const terminal = document.getElementById('terminalLines');
  if(!terminal) return;
  if(terminalInterval) clearInterval(terminalInterval);
  const safe = lines.length ? lines : [['system','ready']];
  terminal.innerHTML = safe.slice(0,6).map(([k,v]) => `<div><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`).join('');
  let i = 0;
  terminalInterval = setInterval(() => {
    const [k,v] = safe[i % safe.length];
    const row = document.createElement('div');
    row.innerHTML = `<b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span>`;
    terminal.appendChild(row);
    if(terminal.children.length > 9) terminal.removeChild(terminal.firstChild);
    i++;
  }, 1700);
}

function renderServices(services){
  const grid = document.getElementById('serviceGrid');
  if(!grid) return;

  const list = Array.isArray(services) ? services : [];
  grid.innerHTML = '';

  for(const service of list){
    const article = document.createElement('article');
    article.className = 'service-card';
    article.innerHTML = `
      <div class="service-media">
        <img src="${escapeAttr(service.image || '')}" alt="${escapeAttr(service.title || 'Service')} visualization" loading="lazy">
      </div>
      <div class="service-body">
        <div class="service-kicker">
          <span>${escapeHtml(service.number || '')} / ${escapeHtml(service.category || '')}</span>
          <em>${escapeHtml(service.tag || '')}</em>
        </div>
        <h3>${escapeHtml(service.title || '')}</h3>
        <p>${escapeHtml(service.description || '')}</p>
        <div class="service-bottom">
          <strong>${escapeHtml(service.price || '')}</strong>
          <a href="#contact" data-service="${escapeAttr(service.title || 'Service request')}">Request service</a>
        </div>
      </div>
    `;
    grid.appendChild(article);
  }

  bindServiceLinks();
}

function bindServiceLinks(){
  const serviceLinks = document.querySelectorAll('.service-card a[data-service]');
  const messageField = document.getElementById('contactMessage');
  serviceLinks.forEach(link => {
    link.addEventListener('click', () => {
      const service = link.getAttribute('data-service') || 'Service request';
      document.querySelectorAll('.service-card').forEach(card => card.classList.remove('is-selected'));
      link.closest('.service-card')?.classList.add('is-selected');
      if (messageField) {
        messageField.value = `Hello, I am interested in ${service}. Please send me more details about timing, scope and next steps.`;
        setTimeout(() => messageField.focus(), 120);
      }
      const status = document.getElementById('formStatus');
      if (status) status.textContent = `${service} selected. You can now send your request.`;
    });
  });
}

document.getElementById('contactForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();

  const form = e.currentTarget;
  const status = document.getElementById('formStatus');
  const button = document.getElementById('sendButton');
  const buttonText = button?.querySelector('.button-text');
  const successText = siteContent?.sections?.contact?.success || 'Request successfully sent. Please wait for a reply to your email.';

  if (status) {
    status.classList.remove('success');
    status.classList.add('loading');
    status.textContent = 'Sending request...';
  }

  if (button) {
    button.classList.add('is-loading');
    button.disabled = true;
  }

  if (buttonText) buttonText.textContent = '[ sending ]';

  const payload = {
    name: form.name?.value || '',
    email: form.email?.value || '',
    message: form.message?.value || '',
    page: location.pathname,
    createdAt: new Date().toISOString()
  };

  try {
    await fetch('/api/contact', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
  } catch (error) {}

  setTimeout(() => {
    if (status) {
      status.classList.remove('loading');
      status.classList.add('success');
      status.textContent = successText;
    }

    if (button) {
      button.classList.remove('is-loading');
      button.disabled = false;
    }

    if (buttonText) buttonText.textContent = '[ send request ]';

    form.reset();
  }, 900);
});

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(value){
  return escapeHtml(value).replace(/`/g, '&#96;');
}

loadSiteContent();
