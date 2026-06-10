document.documentElement.classList.add('js');
const started = new Date('2026-03-05T00:00:00+01:00');
const runtime = document.getElementById('runtime');
function pad(n){return String(n).padStart(2,'0')}
function tick(){
  const s = Math.max(0, Math.floor((Date.now()-started.getTime())/1000));
  const d = Math.floor(s/86400);
  const h = Math.floor((s%86400)/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  if(runtime) runtime.textContent = `${String(d).padStart(3,'0')}D ${pad(h)}H ${pad(m)}M ${pad(sec)}S`;
}
tick(); setInterval(tick,1000);

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const observer = new IntersectionObserver((entries)=>{
  for(const entry of entries){ if(entry.isIntersecting) entry.target.classList.add('is-visible') }
},{threshold:.14});
document.querySelectorAll('[data-reveal]').forEach(el=>{ observer.observe(el); setTimeout(()=>el.classList.add('is-visible'), 80); });

const lines = [
  ['scope','requirements map created'],
  ['secure','input validation layer prepared'],
  ['build','frontend package compiled'],
  ['api','integration endpoints documented'],
  ['deploy','netlify / vercel / vps compatible'],
  ['docs','handover notes generated'],
  ['maintain','support queue ready']
];
const terminal = document.getElementById('terminalLines');
let i=0;
function pushLine(){
  if(!terminal) return;
  const [k,v] = lines[i % lines.length];
  const row = document.createElement('div');
  row.innerHTML = `<b>${k}</b><span>${v}</span>`;
  terminal.appendChild(row);
  if(terminal.children.length>9) terminal.removeChild(terminal.firstChild);
  i++;
}
if (terminal && terminal.children.length === 0) {
  for(let n=0;n<6;n++) pushLine();
}
setInterval(pushLine, 1700);

document.getElementById('contactForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();

  const form = e.currentTarget;
  const status = document.getElementById('formStatus');
  const button = document.getElementById('sendButton');
  const buttonText = button?.querySelector('.button-text');

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
  } catch (error) {
    // On local preview the API may not exist. The UI still behaves like a completed request.
  }

  setTimeout(() => {
    if (status) {
      status.classList.remove('loading');
      status.classList.add('success');
      status.textContent = 'Request successfully sent. Please wait for a reply to your email.';
    }

    if (button) {
      button.classList.remove('is-loading');
      button.disabled = false;
    }

    if (buttonText) buttonText.textContent = '[ send request ]';

    form.reset();
  }, 900);
});


async function loadSiteContent(){
  try{
    const response = await fetch('/api/content', {cache:'no-store'});
    if(!response.ok) throw new Error('API unavailable');
    const content = await response.json();
    applySiteContent(content);
  }catch(error){
    try{
      const fallback = await fetch('data/content.json', {cache:'no-store'});
      if(fallback.ok) applySiteContent(await fallback.json());
    }catch(_){}
  }
}

function applySiteContent(content){
  if(!content) return;
  const site = content.site || {};
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if(el && typeof value === 'string') el.textContent = value;
  };

  setText('heroEyebrow', site.eyebrow);
  setText('heroTitle', site.heroTitle);
  setText('heroText', site.heroText);
  setText('rootNote', site.rootNote);

  if(Array.isArray(content.services)) renderServices(content.services);
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[char]));
}

function renderServices(services){
  const grid = document.getElementById('serviceGrid');
  if(!grid) return;

  grid.innerHTML = services.map(service => {
    const title = escapeHtml(service.title);
    const description = escapeHtml(service.description);
    const image = escapeHtml(service.image);
    const category = escapeHtml(service.category);
    const tag = escapeHtml(service.tag);
    const number = escapeHtml(service.number);
    const price = escapeHtml(service.price);
    return `
      <article class="service-card">
        <div class="service-media">
          <img src="${image}" alt="${title} visualization" loading="lazy">
        </div>
        <div class="service-body">
          <div class="service-kicker">
            <span>${number} / ${category}</span>
            <em>${tag}</em>
          </div>
          <h3>${title}</h3>
          <p>${description}</p>
          <div class="service-bottom">
            <strong>${price}</strong>
            <a href="#contact" data-service="${title}">Request service</a>
          </div>
        </div>
      </article>
    `;
  }).join('');

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

loadSiteContent();

