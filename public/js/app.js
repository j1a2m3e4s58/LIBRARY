// --- Main SPA Application Engine ---

let dashboardInterval = null;
let accountFlow = { mode: '', username: '', phone: '', token: '' };

document.addEventListener('DOMContentLoaded', () => {
  // Check session status on page load
  initApp();

  // Bind Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  const signupForm = document.getElementById('signup-form');
  if (signupForm) signupForm.addEventListener('submit', handleSignup);
  document.getElementById('show-signup-btn')?.addEventListener('click', () => toggleAuthMode(true));
  document.getElementById('show-login-btn')?.addEventListener('click', () => toggleAuthMode(false));
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('open'));
  document.getElementById('forgot-password-btn')?.addEventListener('click', () => openAccountFlow('forgot-phone'));
  document.getElementById('flow-close-btn')?.addEventListener('click', closeAccountFlow);
  document.getElementById('account-flow-form')?.addEventListener('submit', handleAccountFlow);
  const userMenuTrigger = document.getElementById('user-menu-trigger');
  const userMenuDropdown = document.getElementById('user-menu-dropdown');
  userMenuTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = userMenuDropdown.hidden;
    userMenuDropdown.hidden = !opening;
    userMenuTrigger.setAttribute('aria-expanded', String(opening));
  });
  document.getElementById('my-profile-btn')?.addEventListener('click', () => {
    userMenuDropdown.hidden = true;
    showToast('Your account name and role appear in the navigation profile.', 'info');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.user-profile')) {
      userMenuDropdown.hidden = true;
      userMenuTrigger?.setAttribute('aria-expanded', 'false');
    }
  });

  // Bind Navigation Links
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      navigateTo(view);
    });
  });

  // Bind Logout Button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout();
      showToast('Logged out successfully', 'info');
    });
  }

  // Bind Modals Forms
  document.getElementById('book-form').addEventListener('submit', handleBookSubmit);
  document.getElementById('member-form').addEventListener('submit', handleMemberSubmit);
  document.getElementById('issue-form').addEventListener('submit', handleIssueSubmit);
});

// App Entry Point
function initApp() {
  if (Auth.isLoggedIn()) {
    showAppLayout();
  } else {
    Auth.logout();
  }
}

// Show/Hide Authentication Screens
function showAppLayout() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('app-section').style.display = 'block';

  const user = Auth.getUser();
  if (user) {
    document.getElementById('app-section').classList.toggle('role-student', user.role === 'student');
    document.getElementById('user-display-name').textContent = user.username;
    document.getElementById('dropdown-user-name').textContent = user.username;
    const roleBadge = document.getElementById('user-display-role');
    roleBadge.textContent = user.role;
    
    // Toggle role badges and avatars styling dynamically
    const avatarImg = document.getElementById('user-avatar-img');
    if (user.role === 'admin') {
      roleBadge.className = 'badge badge-active';
      document.getElementById('nav-item-settings').style.display = 'block';
      if (avatarImg) avatarImg.style.display = 'none';
    } else {
      roleBadge.className = 'badge badge-issued';
      document.getElementById('nav-item-settings').style.display = 'none';
      if (avatarImg) avatarImg.style.display = 'none';
    }
    document.querySelectorAll('.nav-link').forEach(link => {
      if (['books','members','borrow','fines'].includes(link.dataset.view)) {
        link.closest('li').style.display = user.role === 'student' ? 'none' : '';
      }
    });
    document.querySelectorAll('.student-only-nav').forEach(item => { item.hidden = user.role !== 'student'; });
  }

  // Set Top bar Current date
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date-display').textContent = new Date().toLocaleDateString('en-US', dateOptions);

  // Navigate to default view (Dashboard)
  navigateTo('dashboard');
}

function toggleAuthMode(showSignup) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authCard = document.querySelector('.auth-card');
  const switcher = document.querySelector('.auth-card > .auth-switch');
  loginForm.hidden = showSignup;
  signupForm.hidden = !showSignup;
  if (switcher) switcher.hidden = showSignup;
  authCard?.classList.toggle('signup-mode', showSignup);
  document.querySelector('.auth-header .eyebrow').textContent = showSignup ? 'JOIN THE TEAM' : 'WELCOME BACK';
  document.querySelector('.auth-header h1').textContent = showSignup ? 'Create your staff account' : 'Sign in to your library';
  document.querySelector('.auth-header p').textContent = showSignup ? 'Start with librarian access. An admin controls advanced settings.' : 'Enter your staff account details below.';
}

async function handleSignup(e) {
  e.preventDefault();
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  if (password !== confirm) return showToast('The two passwords do not match.', 'warning');
  try {
    const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password }) });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Account creation failed.', 'error');
    showToast('Account created. Now secure it with your telephone number.', 'success');
    e.target.reset();
    openAccountFlow('signup-phone', { username });
  } catch (err) {
    showToast('Could not connect to the server.', 'error');
  }
}

// Navigation / Router logic
function navigateTo(view) {
  document.querySelector('.sidebar')?.classList.remove('open');
  // Clear any active intervals (e.g. dashboard carousel)
  if (dashboardInterval) {
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }

  // Update nav link active statuses
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    if (link.getAttribute('data-view') === view) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update background image of the app layout dynamically
  const appLayout = document.getElementById('app-section');
  if (appLayout) {
    let bgImage = 'url("images/ghana-library-login-v2.png")';
    let bgSize = 'cover';
    let bgPosition = 'center';
    let bgRepeat = 'no-repeat';

    if (view === 'books') {
      bgImage = 'url("images/ghana-library-catalog-v2.png")';
    } else if (view === 'catalogue') {
      bgImage = 'url("images/ghana-library-catalog-v2.png")';
    } else if (view === 'members') {
      bgImage = 'url("images/ghana-library-members-v2.png")';
    } else if (view === 'borrow') {
      bgImage = 'url("images/ghana-library-service-v2.png")';
    } else if (view === 'fines') {
      bgImage = 'url("images/ghana-library-fines-v2.png")';
    } else if (view === 'settings') {
      bgImage = 'url("images/ghana-library-settings-v2.png")';
    }

    appLayout.className = `app-layout view-${view}`;

    appLayout.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), ${bgImage}`;
    appLayout.style.backgroundSize = bgSize;
    appLayout.style.backgroundPosition = bgPosition;
    appLayout.style.backgroundRepeat = bgRepeat;
  }

  // Update Top Bar title
  const viewMeta = {
    dashboard: ['Overview', 'A quick picture of today’s library activity.'],
    books: ['Collection', 'Find, organize, and maintain every learning resource.'],
    catalogue: ['Literature Catalogue', 'Browse the shelf visually and discover what is ready to borrow.'],
    members: ['Readers', 'Manage the people who use The Knowledge Hub.'],
    borrow: ['Circulation', 'Issue, renew, and receive resources in one place.'],
    fines: ['Accounts', 'Review overdue charges and record payments.'],
    settings: ['Administration', 'Control access, rates, and workspace preferences.']
    , 'my-loans': ['My Loans', 'Track borrowed books and live return deadlines.']
    , reservations: ['Reservations', 'Review your holds, queue positions, and collection windows.']
    , 'student-fines': ['Outstanding Fines', 'Understand charges connected to your borrowed books.']
  };
  const [viewTitle, viewSubtitle] = viewMeta[view] || viewMeta.dashboard;
  document.getElementById('current-view-title').textContent = viewTitle;
  document.getElementById('current-view-subtitle').textContent = viewSubtitle;

  // Render view
  switch(view) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'books':
      renderBooks();
      break;
    case 'catalogue':
      renderLiteratureCatalogue();
      break;
    case 'my-loans': renderMyLoans(); break;
    case 'reservations': renderStudentReservations(); break;
    case 'student-fines': renderStudentFines(); break;
    case 'members':
      renderMembers();
      break;
    case 'borrow':
      renderBorrow();
      break;
    case 'fines':
      renderFines();
      break;
    case 'settings':
      renderSettings();
      break;
    default:
      renderDashboard();
  }
}

// Handle login submissions
async function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username').value;
  const passwordInput = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password: passwordInput })
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.verificationRequired) openAccountFlow('signup-phone', { username: data.username });
      showToast(data.error || 'Login failed', 'error');
      return;
    }

    Auth.login(data.token, data.user);
    showToast(`Welcome back, ${data.user.username}!`, 'success');
    showAppLayout();
  } catch (err) {
    console.error(err);
    showToast('Failed to connect to authentication server.', 'error');
  }
}

function openAccountFlow(mode, values = {}) {
  accountFlow = { ...accountFlow, ...values, mode };
  document.getElementById('account-flow-modal').hidden = false;
  renderAccountFlow();
}

function closeAccountFlow() {
  document.getElementById('account-flow-modal').hidden = true;
  accountFlow = { mode: '', username: '', phone: '', token: '' };
}

function renderAccountFlow() {
  const title = document.getElementById('flow-title');
  const description = document.getElementById('flow-description');
  const step = document.getElementById('flow-step');
  const fields = document.getElementById('flow-fields');
  const submit = document.getElementById('flow-submit');
  const note = document.getElementById('demo-token-note');
  const icon = document.getElementById('flow-icon');
  note.hidden = true;

  if (accountFlow.mode === 'signup-phone') {
    step.textContent = 'STEP 1 OF 2'; title.textContent = 'Add your telephone number';
    description.textContent = 'This number will verify your account and help you recover access later.';
    fields.innerHTML = phoneField(); submit.textContent = 'Send verification code'; icon.className = 'fa-solid fa-mobile-screen-button';
  } else if (accountFlow.mode === 'signup-token') {
    step.textContent = 'STEP 2 OF 2'; title.textContent = 'Enter your verification code';
    description.textContent = `Enter the four-digit code sent to ${maskPhone(accountFlow.phone)}.`;
    fields.innerHTML = tokenField(); submit.textContent = 'Verify account'; note.hidden = false; icon.className = 'fa-solid fa-shield-halved';
  } else if (accountFlow.mode === 'forgot-phone') {
    step.textContent = 'PASSWORD RECOVERY'; title.textContent = 'Find your account';
    description.textContent = 'Enter the exact telephone number used during registration.';
    fields.innerHTML = phoneField(); submit.textContent = 'Get reset code'; icon.className = 'fa-solid fa-key';
  } else if (accountFlow.mode === 'forgot-token') {
    step.textContent = 'VERIFY YOUR IDENTITY'; title.textContent = 'Enter the reset code';
    description.textContent = `Enter the four-digit code sent to ${maskPhone(accountFlow.phone)}.`;
    fields.innerHTML = tokenField(); submit.textContent = 'Continue'; note.hidden = false; icon.className = 'fa-solid fa-message';
  } else if (accountFlow.mode === 'reset-password') {
    step.textContent = 'FINAL STEP'; title.textContent = 'Create a new password';
    description.textContent = 'Choose a secure password containing at least six characters.';
    fields.innerHTML = '<div class="form-group"><label for="flow-password">New password</label><input id="flow-password" type="password" minlength="6" required autocomplete="new-password" placeholder="At least 6 characters"></div><div class="form-group"><label for="flow-confirm-password">Confirm new password</label><input id="flow-confirm-password" type="password" minlength="6" required autocomplete="new-password" placeholder="Type it again"></div>';
    submit.textContent = 'Reset password'; icon.className = 'fa-solid fa-lock-open';
  }
  fields.querySelector('input')?.focus();
}

function phoneField() { return '<div class="form-group"><label for="flow-phone">Telephone number</label><input id="flow-phone" type="tel" required autocomplete="tel" placeholder="e.g. +233 24 123 4567"></div>'; }
function tokenField() { return '<div class="form-group"><label for="flow-token">Four-digit code</label><input id="flow-token" class="token-input" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="one-time-code" placeholder="• • • •"></div>'; }
function maskPhone(phone) { return phone.length > 4 ? `${phone.slice(0, 4)}••••${phone.slice(-3)}` : phone; }

async function flowRequest(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

async function handleAccountFlow(e) {
  e.preventDefault();
  const button = document.getElementById('flow-submit');
  button.disabled = true;
  try {
    if (accountFlow.mode === 'signup-phone') {
      accountFlow.phone = document.getElementById('flow-phone').value.replace(/\s+/g, '');
      await flowRequest('/api/auth/phone/start', { username: accountFlow.username, phone: accountFlow.phone });
      accountFlow.mode = 'signup-token'; renderAccountFlow(); showToast('Verification code sent.', 'success');
    } else if (accountFlow.mode === 'signup-token') {
      const token = document.getElementById('flow-token').value;
      await flowRequest('/api/auth/phone/confirm', { username: accountFlow.username, token });
      document.getElementById('login-username').value = accountFlow.username;
      closeAccountFlow(); toggleAuthMode(false); showToast('Account verified. You can now sign in.', 'success');
    } else if (accountFlow.mode === 'forgot-phone') {
      accountFlow.phone = document.getElementById('flow-phone').value.replace(/\s+/g, '');
      await flowRequest('/api/auth/password/request', { phone: accountFlow.phone });
      accountFlow.mode = 'forgot-token'; renderAccountFlow(); showToast('Reset code sent.', 'success');
    } else if (accountFlow.mode === 'forgot-token') {
      const token = document.getElementById('flow-token').value;
      if (token !== '1234') throw new Error('Incorrect reset code.');
      accountFlow.token = token; accountFlow.mode = 'reset-password'; renderAccountFlow();
    } else if (accountFlow.mode === 'reset-password') {
      const password = document.getElementById('flow-password').value;
      if (password !== document.getElementById('flow-confirm-password').value) throw new Error('The two passwords do not match.');
      await flowRequest('/api/auth/password/reset', { phone: accountFlow.phone, token: accountFlow.token, password });
      closeAccountFlow(); toggleAuthMode(false); showToast('Password changed. Sign in with your new password.', 'success');
    }
  } catch (err) { showToast(err.message, 'error'); }
  finally { button.disabled = false; }
}

// --- MODAL CONTROLS ---

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// ==========================================================================
// VIEW RENDERING & CONTROLLER LOGIC
// ==========================================================================

// --- 1. DASHBOARD VIEW ---
async function renderDashboard() {
  const container = document.getElementById('view-container');
  container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading Dashboard metrics...</p></div>`;

  try {
    const res = await Auth.fetch('/api/reports/dashboard');
    const data = await res.json();
    
    // Check fine currency setting
    const setRes = await Auth.fetch('/api/settings');
    const settings = await setRes.json();
    const rate = parseFloat(settings.fine_rate || '2.00');

    container.innerHTML = `
      <section class="dashboard-hero" id="dashboard-hero">
        <div class="hero-slide active" style="background-image:url('images/ghana-library-login-v2.png')"><div class="hero-copy"><span>THE KNOWLEDGE HUB</span><h2>Welcome back, ${Auth.getUser()?.username || 'Librarian'}.</h2><p>Keep learning resources moving and your library community connected.</p></div></div>
        <div class="hero-slide" style="background-image:url('images/ghana-library-catalog-v2.png')"><div class="hero-copy"><span>DISCOVER & ORGANIZE</span><h2>A collection built for every curious mind.</h2><p>Find resources quickly, track availability, and keep the shelves ready.</p></div></div>
        <div class="hero-slide" style="background-image:url('images/ghana-library-members-v2.png')"><div class="hero-copy"><span>COMMUNITY FIRST</span><h2>Make every reader feel welcome.</h2><p>Simple membership services and clear records from one workspace.</p></div></div>
        <button class="hero-arrow hero-prev" type="button" aria-label="Previous banner"><i class="fa-solid fa-arrow-left"></i></button>
        <button class="hero-arrow hero-next" type="button" aria-label="Next banner"><i class="fa-solid fa-arrow-right"></i></button>
        <div class="hero-dots"><button class="active" aria-label="Banner 1"></button><button aria-label="Banner 2"></button><button aria-label="Banner 3"></button></div>
        <div class="hero-progress"><span></span></div>
      </section>
      <!-- Horizontal Looping Metrics Carousel -->
      <div class="metrics-carousel-section">
        <div class="metrics-slider-track" id="metrics-slider-track">
          
          <!-- Card 1: Total Books -->
          <div class="metric-card-slide metric-indigo">
            <div class="metric-card-content">
              <div class="metric-card-label"><i class="fa-solid fa-book"></i> Total Inventory</div>
              <div class="metric-card-value">${data.total_books}</div>
            </div>
          </div>
          
          <!-- Card 2: Available Copies -->
          <div class="metric-card-slide metric-green">
            <div class="metric-card-content">
              <div class="metric-card-label"><i class="fa-solid fa-square-check"></i> Available Copies</div>
              <div class="metric-card-value">${data.available_books}</div>
            </div>
          </div>
          
          <!-- Card 3: Issued Books -->
          <div class="metric-card-slide metric-gold">
            <div class="metric-card-content">
              <div class="metric-card-label"><i class="fa-solid fa-handshake-angle"></i> Issued Books</div>
              <div class="metric-card-value">${data.borrowed_books}</div>
            </div>
          </div>
          
          <!-- Card 4: Overdue Books -->
          <div class="metric-card-slide metric-coral">
            <div class="metric-card-content">
              <div class="metric-card-label"><i class="fa-solid fa-clock"></i> Overdue Books</div>
              <div class="metric-card-value">${data.overdue_books}</div>
            </div>
          </div>
          
          <!-- Card 5: Registered Members -->
          <div class="metric-card-slide metric-teal">
            <div class="metric-card-content">
              <div class="metric-card-label"><i class="fa-solid fa-users"></i> Registered Members</div>
              <div class="metric-card-value">${data.total_members}</div>
            </div>
          </div>

        </div>
      </div>

      <div class="row">
        <!-- Fines Breakdown Card -->
        <div class="col-6">
          <div class="card" style="height: 100%;">
            <div class="card-header">
              <h3><i class="fa-solid fa-scale-balanced"></i> Fines Overview (GHS)</h3>
            </div>
            <div class="card-body">
              <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 12px;">
                  <span style="font-weight: 550; color: var(--text-secondary);">Total Unpaid Fines:</span>
                  <span class="badge badge-suspended" style="font-size: 1rem; padding: 4px 12px;">GHS ${parseFloat(data.total_unpaid_fines).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 12px;">
                  <span style="font-weight: 550; color: var(--text-secondary);">Total Fines Collected:</span>
                  <span class="badge badge-active" style="font-size: 1rem; padding: 4px 12px;">GHS ${parseFloat(data.total_paid_fines).toFixed(2)}</span>
                </div>
                <div style="margin-top: 10px; padding: 12px; background-color: rgba(255,255,255,0.05); border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.1);">
                  <i class="fa-solid fa-circle-info"></i> The standard library charge rate is currently set to <strong>GHS ${rate.toFixed(2)} per day</strong> overdue.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Info Panel -->
        <div class="col-6">
          <div class="card" style="height: 100%;">
            <div class="card-header">
              <h3><i class="fa-solid fa-circle-question"></i> System Quick Start</h3>
            </div>
            <div class="card-body" style="font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary);">
              <p>Welcome to The Knowledge Hub. From this workspace you can:</p>
              <ul style="list-style-type: disc; padding-left: 20px; margin-top: 8px;">
                <li>Manage your book catalog under <strong>Book Inventory</strong>.</li>
                <li>Track students and member profiles under <strong>Member Management</strong>.</li>
                <li>Issue materials, return books, and extend loan periods under <strong>Borrow / Issue</strong>.</li>
                <li>Collect outstanding fines under <strong>Fine Management</strong>.</li>
                <li>Change system rates and configure settings inside the <strong>Settings</strong> module.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
    initDashboardHero();

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Dashboard error</h4><p>Failed to gather stats from server.</p></div>`;
  }
}

function initDashboardHero() {
  const hero = document.getElementById('dashboard-hero');
  if (!hero) return;
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const dots = [...hero.querySelectorAll('.hero-dots button')];
  let current = 0;
  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
    hero.classList.remove('progressing'); void hero.offsetWidth; hero.classList.add('progressing');
  };
  const start = () => { clearInterval(dashboardInterval); dashboardInterval = setInterval(() => show(current + 1), 6000); };
  hero.querySelector('.hero-prev').addEventListener('click', () => { show(current - 1); start(); });
  hero.querySelector('.hero-next').addEventListener('click', () => { show(current + 1); start(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); start(); }));
  hero.addEventListener('mouseenter', () => clearInterval(dashboardInterval));
  hero.addEventListener('mouseleave', start);
  show(0); start();
}

let catalogueData = [];

async function renderLiteratureCatalogue() {
  const container = document.getElementById('view-container');
  container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Opening the literature shelf...</p></div>`;
  try {
    const res = await Auth.fetch('/api/books');
    catalogueData = await res.json();
    const categories = [...new Set(catalogueData.map(book => book.category))].sort();
    const available = catalogueData.reduce((sum, book) => sum + Number(book.available_copies || 0), 0);
    container.innerHTML = `
      <section class="catalogue-intro">
        <div><span class="catalogue-eyebrow">DIGITAL SHELF</span><h2>Find your next great read.</h2><p>Explore every title held by The Knowledge Hub and see availability instantly.</p></div>
        <div class="catalogue-summary"><div><strong>${catalogueData.length}</strong><span>Titles</span></div><div><strong>${available}</strong><span>Copies ready</span></div><div><strong>${categories.length}</strong><span>Subjects</span></div></div>
      </section>
      <section class="catalogue-controls">
        <div class="catalogue-search"><i class="fa-solid fa-magnifying-glass"></i><input id="catalogue-search" type="search" placeholder="Search title, author, ISBN, or subject" oninput="filterCatalogue()"></div>
        <select id="catalogue-category" onchange="filterCatalogue()"><option value="">Every subject</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}</select>
        <div class="catalogue-view-switch"><button class="active" type="button" onclick="setCatalogueView('grid',this)" aria-label="Grid view"><i class="fa-solid fa-grip"></i></button><button type="button" onclick="setCatalogueView('list',this)" aria-label="List view"><i class="fa-solid fa-list"></i></button></div>
      </section>
      <div id="catalogue-results-label" class="catalogue-results-label"></div>
      <section id="catalogue-grid" class="literature-grid"></section>`;
    displayCatalogue(catalogueData);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Shelf unavailable</h4><p>The catalogue could not be loaded.</p></div>`;
  }
}

function catalogueTone(category = '') {
  const tones = ['cover-forest','cover-gold','cover-indigo','cover-coral','cover-teal','cover-plum'];
  return tones[[...category].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length];
}

function catalogueImage(book) {
  const images = ['ghana-library-catalog-v2.png','ghana-library-members-v2.png','ghana-library-service-v2.png','ghana-library-fines-v2.png','ghana-library-settings-v2.png','ghana-library-login-v2.png'];
  const seed = [...`${book.title}${book.isbn}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `images/${images[seed % images.length]}`;
}

function displayCatalogue(books) {
  const grid = document.getElementById('catalogue-grid');
  if (!grid) return;
  document.getElementById('catalogue-results-label').textContent = `${books.length} ${books.length === 1 ? 'title' : 'titles'} found`;
  if (!books.length) {
    grid.innerHTML = `<div class="catalogue-empty"><i class="fa-solid fa-book-open"></i><h3>No matching literature</h3><p>Try another keyword or subject.</p></div>`;
    return;
  }
  grid.innerHTML = books.map(book => `
    <article class="literature-card" role="button" tabindex="0" onclick="openLiteratureDetails(${book.id})" onkeydown="if(event.key==='Enter')openLiteratureDetails(${book.id})">
      <div class="literature-cover ${catalogueTone(book.category)}" style="background-image:linear-gradient(180deg,rgba(4,24,15,.08),rgba(4,24,15,.76)),url('${catalogueImage(book)}')"><span>${escapeHtml(book.category)}</span><i class="fa-solid fa-book-open"></i><small>THE KNOWLEDGE HUB</small></div>
      <div class="literature-info"><span class="literature-author">${escapeHtml(book.author)}</span><h3>${escapeHtml(book.title)}</h3><div class="literature-meta"><span><i class="fa-regular fa-calendar"></i> ${book.year_published}</span><span><i class="fa-solid fa-barcode"></i> ${escapeHtml(book.isbn)}</span></div><div class="literature-footer"><span class="availability ${book.available_copies > 0 ? 'ready' : 'out'}"><i class="fa-solid ${book.available_copies > 0 ? 'fa-circle-check' : 'fa-clock'}"></i> ${book.available_copies > 0 ? `${book.available_copies} ready` : 'On loan'}</span><span>${book.available_copies}/${book.total_copies} copies</span></div></div>
    </article>`).join('');
}

function filterCatalogue() {
  const query = document.getElementById('catalogue-search').value.toLowerCase().trim();
  const category = document.getElementById('catalogue-category').value;
  displayCatalogue(catalogueData.filter(book => (!category || book.category === category) && [book.title,book.author,book.isbn,book.category].some(value => String(value).toLowerCase().includes(query))));
}

function setCatalogueView(view, button) {
  document.getElementById('catalogue-grid').classList.toggle('list-view', view === 'list');
  document.querySelectorAll('.catalogue-view-switch button').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
}

// --- 2. BOOKS VIEW ---
let booksData = [];

async function renderBooks() {
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="panel-header">
      <div class="search-filter-bar">
        <div class="search-input-group">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="books-search-input" placeholder="Search by Title, Author, ISBN, Category..." oninput="filterBooks()">
        </div>
      </div>
      <button class="btn btn-primary" onclick="showAddBookModal()" style="background: rgba(37, 99, 235, 0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(96, 165, 250, 0.45); color: #ffffff; font-weight: 600; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: all 0.2s ease;">
        <i class="fa-solid fa-plus"></i> Add New Book
      </button>
    </div>

    <div class="card">
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="table-custom" id="books-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>ISBN</th>
                <th>Category</th>
                <th>Publisher</th>
                <th>Year</th>
                <th>Copies (Available/Total)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="books-table-body">
              <tr>
                <td colspan="8" class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading books...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  await fetchBooks();
}

async function fetchBooks() {
  try {
    const res = await Auth.fetch('/api/books');
    booksData = await res.json();
    displayBooksList(booksData);
  } catch (err) {
    showToast('Failed to load book inventory', 'error');
  }
}

function displayBooksList(books) {
  const tbody = document.getElementById('books-table-body');
  if (!tbody) return;

  if (books.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <i class="fa-regular fa-folder-open"></i>
          <h4>No books cataloged</h4>
          <p>Try searching something else or add a new book to the library.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = books.map(book => `
    <tr>
      <td style="font-weight: 600;">${escapeHtml(book.title)}</td>
      <td>${escapeHtml(book.author)}</td>
      <td><code>${escapeHtml(book.isbn)}</code></td>
      <td><span class="badge collection-category">${escapeHtml(book.category)}</span></td>
      <td>${escapeHtml(book.publisher)}</td>
      <td>${book.year_published}</td>
      <td>
        <span class="badge ${book.available_copies > 0 ? 'badge-active' : 'badge-suspended'}">
          ${book.available_copies}
        </span>
        / ${book.total_copies}
      </td>
      <td class="actions">
        <button class="btn btn-secondary btn-sm" onclick="showEditBookModal(${book.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm" onclick="handleDeleteBook(${book.id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function filterBooks() {
  const query = document.getElementById('books-search-input').value.toLowerCase();
  const filtered = booksData.filter(b => 
    b.title.toLowerCase().includes(query) ||
    b.author.toLowerCase().includes(query) ||
    b.isbn.toLowerCase().includes(query) ||
    b.category.toLowerCase().includes(query)
  );
  displayBooksList(filtered);
}

function showAddBookModal() {
  document.getElementById('book-form-id').value = '';
  document.getElementById('book-modal-title').textContent = 'Add New Book';
  document.getElementById('book-form').reset();
  openModal('book-modal');
}

function showEditBookModal(id) {
  const book = booksData.find(b => b.id === id);
  if (!book) return;

  document.getElementById('book-form-id').value = book.id;
  document.getElementById('book-modal-title').textContent = 'Edit Book Details';
  
  document.getElementById('book-title').value = book.title;
  document.getElementById('book-author').value = book.author;
  document.getElementById('book-isbn').value = book.isbn;
  document.getElementById('book-category').value = book.category;
  document.getElementById('book-publisher').value = book.publisher;
  document.getElementById('book-year').value = book.year_published;
  document.getElementById('book-copies').value = book.total_copies;

  openModal('book-modal');
}

async function handleBookSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('book-form-id').value;
  const payload = {
    title: document.getElementById('book-title').value,
    author: document.getElementById('book-author').value,
    isbn: document.getElementById('book-isbn').value,
    category: document.getElementById('book-category').value,
    publisher: document.getElementById('book-publisher').value,
    year_published: document.getElementById('book-year').value,
    total_copies: document.getElementById('book-copies').value
  };

  const isEdit = !!id;
  const url = isEdit ? `/api/books/${id}` : '/api/books';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await Auth.fetch(url, {
      method,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Operation failed', 'error');
      return;
    }

    closeModal('book-modal');
    showToast(isEdit ? 'Book details updated' : 'New book added to library', 'success');
    fetchBooks();
  } catch (err) {
    console.error(err);
  }
}

async function handleDeleteBook(id) {
  if (!confirm('Are you sure you want to delete this book? This action is permanent.')) return;
  try {
    const res = await Auth.fetch(`/api/books/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Failed to delete book', 'error');
      return;
    }

    showToast('Book deleted successfully', 'success');
    fetchBooks();
  } catch (err) {
    console.error(err);
  }
}

// --- 3. MEMBERS VIEW ---
let membersData = [];

async function renderMembers() {
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="panel-header">
      <div class="search-filter-bar">
        <div class="search-input-group">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="members-search-input" placeholder="Search members by Name, Code, Email..." oninput="filterMembers()">
        </div>
      </div>
      <button class="btn btn-primary" onclick="showAddMemberModal()" style="background: rgba(37, 99, 235, 0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(96, 165, 250, 0.45); color: #ffffff; font-weight: 600; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: all 0.2s ease;">
        <i class="fa-solid fa-plus"></i> Register Member
      </button>
    </div>

    <div class="card">
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Member Code</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Phone Number</th>
                <th>Status</th>
                <th>Registration Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="members-table-body">
              <tr>
                <td colspan="7" class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading members...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  await fetchMembers();
}

async function fetchMembers() {
  try {
    const res = await Auth.fetch('/api/members');
    membersData = await res.json();
    displayMembersList(membersData);
  } catch (err) {
    showToast('Failed to load registered members', 'error');
  }
}

function displayMembersList(members) {
  const tbody = document.getElementById('members-table-body');
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fa-solid fa-users-slash"></i>
          <h4>No members registered</h4>
          <p>Register a student/member using the form.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = members.map(member => {
    const formattedDate = new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const statusBadge = member.status === 'active' 
      ? '<span class="badge badge-active">Active</span>' 
      : '<span class="badge badge-suspended">Suspended</span>';

    return `
      <tr>
        <td><code>${escapeHtml(member.member_code)}</code></td>
        <td style="font-weight: 600;">${escapeHtml(member.name)}</td>
        <td>${escapeHtml(member.email)}</td>
        <td>${escapeHtml(member.phone)}</td>
        <td>${statusBadge}</td>
        <td>${formattedDate}</td>
        <td class="actions">
          <button class="btn btn-secondary btn-sm" onclick="showEditMemberModal(${member.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm" onclick="handleDeleteMember(${member.id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterMembers() {
  const query = document.getElementById('members-search-input').value.toLowerCase();
  const filtered = membersData.filter(m => 
    m.name.toLowerCase().includes(query) ||
    m.member_code.toLowerCase().includes(query) ||
    m.email.toLowerCase().includes(query)
  );
  displayMembersList(filtered);
}

function showAddMemberModal() {
  document.getElementById('member-form-id').value = '';
  document.getElementById('member-modal-title').textContent = 'Register Member';
  document.getElementById('member-status-group').style.display = 'none';
  document.getElementById('member-form').reset();
  openModal('member-modal');
}

function showEditMemberModal(id) {
  const member = membersData.find(m => m.id === id);
  if (!member) return;

  document.getElementById('member-form-id').value = member.id;
  document.getElementById('member-modal-title').textContent = 'Edit Member Profile';
  document.getElementById('member-status-group').style.display = 'block';

  document.getElementById('member-code').value = member.member_code;
  document.getElementById('member-name').value = member.name;
  document.getElementById('member-email').value = member.email;
  document.getElementById('member-phone').value = member.phone;
  document.getElementById('member-status').value = member.status;

  openModal('member-modal');
}

async function handleMemberSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('member-form-id').value;
  const payload = {
    member_code: document.getElementById('member-code').value,
    name: document.getElementById('member-name').value,
    email: document.getElementById('member-email').value,
    phone: document.getElementById('member-phone').value,
    status: id ? document.getElementById('member-status').value : 'active'
  };

  const isEdit = !!id;
  const url = isEdit ? `/api/members/${id}` : '/api/members';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await Auth.fetch(url, {
      method,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Operation failed', 'error');
      return;
    }

    closeModal('member-modal');
    showToast(isEdit ? 'Member information updated' : 'Member registered successfully', 'success');
    renderMembers();
  } catch (err) {
    console.error(err);
  }
}

async function handleDeleteMember(id) {
  if (!confirm('Are you sure you want to delete this member?')) return;
  try {
    const res = await Auth.fetch(`/api/members/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Failed to delete member', 'error');
      return;
    }

    showToast('Member deleted successfully', 'success');
    renderMembers();
  } catch (err) {
    console.error(err);
  }
}

// --- 4. BORROW / ISSUE VIEW ---
async function renderBorrow() {
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="panel-header">
      <h3>Active Loans & Borrow History</h3>
      <button class="btn btn-primary" onclick="showIssueBookModal()" style="background: rgba(37, 99, 235, 0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(96, 165, 250, 0.45); color: #ffffff; font-weight: 600; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: all 0.2s ease;">
        <i class="fa-solid fa-share-from-square"></i> Issue / Loan Book
      </button>
    </div>

    <!-- Active Loans Tab -->
    <div class="card mb-24">
      <div class="card-header">
        <h3><i class="fa-solid fa-handshake"></i> Active Borrowings (In Circulation)</h3>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Borrower (Code)</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Pending Fine (GHS)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="active-loans-body">
              <tr>
                <td colspan="7" class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading active loans...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Loan History Tab -->
    <div class="card">
      <div class="card-header">
        <h3><i class="fa-solid fa-history"></i> Return Logs & History</h3>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Borrower (Code)</th>
                <th>Issue Date</th>
                <th>Return Date</th>
                <th>Fine Charged</th>
                <th>Fine Status</th>
              </tr>
            </thead>
            <tbody id="loan-history-body">
              <tr>
                <td colspan="6" class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading loan logs...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  await Promise.all([fetchActiveLoans(), fetchLoanHistory()]);
}

async function fetchActiveLoans() {
  try {
    const res = await Auth.fetch('/api/borrow/active');
    const data = await res.json();
    const tbody = document.getElementById('active-loans-body');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i>
            <h4>All items returned</h4>
            <p>No books are currently checked out.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.map(loan => {
      const statusBadge = loan.is_overdue 
        ? '<span class="badge badge-overdue">Overdue</span>' 
        : '<span class="badge badge-issued">Issued</span>';
      
      const fineText = loan.is_overdue 
        ? `<strong class="text-danger">GHS ${loan.pending_fine.toFixed(2)}</strong> <span style="font-size:0.75rem; color:var(--text-secondary)">(${loan.days_overdue} days)</span>` 
        : 'GHS 0.00';

      const renewBtnHtml = loan.renewed_count >= 3
        ? `<button class="btn btn-secondary btn-sm" disabled title="Max renewal limit reached">Max Renewed</button>`
        : `<button class="btn btn-secondary btn-sm" onclick="handleRenew(${loan.id})"><i class="fa-solid fa-rotate-right"></i> Renew</button>`;

      return `
        <tr>
          <td style="font-weight:600;">${escapeHtml(loan.book_title)}<br><span style="font-size: 0.75rem; font-weight:normal; color:var(--text-secondary)">ISBN: ${loan.book_isbn}</span></td>
          <td>${escapeHtml(loan.member_name)}<br><code>${escapeHtml(loan.member_code)}</code></td>
          <td>${loan.issue_date}</td>
          <td>${loan.due_date}</td>
          <td>${statusBadge}</td>
          <td>${fineText}</td>
          <td class="actions">
            <button class="btn btn-success btn-sm" onclick="handleReturn(${loan.id})"><i class="fa-solid fa-circle-down"></i> Return</button>
            ${renewBtnHtml}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load active borrowings', 'error');
  }
}

async function fetchLoanHistory() {
  try {
    const res = await Auth.fetch('/api/borrow/history');
    const data = await res.json();
    const tbody = document.getElementById('loan-history-body');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i class="fa-regular fa-calendar"></i>
            <h4>No activity log found</h4>
            <p>Once books are returned, they will be archived here.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.map(log => {
      let fineStatusBadge = '-';
      let fineAmount = 'GHS 0.00';

      if (log.fine_amount !== null && log.fine_amount !== undefined) {
        fineAmount = `GHS ${parseFloat(log.fine_amount).toFixed(2)}`;
        fineStatusBadge = log.fine_paid === 1
          ? '<span class="badge badge-active">Paid</span>'
          : '<span class="badge badge-suspended">Unpaid</span>';
      }

      return `
        <tr>
          <td style="font-weight: 550;">${escapeHtml(log.book_title)}</td>
          <td>${escapeHtml(log.member_name)}<br><code>${escapeHtml(log.member_code)}</code></td>
          <td>${log.issue_date}</td>
          <td>${log.return_date}</td>
          <td>${fineAmount}</td>
          <td>${fineStatusBadge}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load borrow logs', 'error');
  }
}

async function showIssueBookModal() {
  try {
    // 1. Fetch available books (available_copies > 0)
    const booksRes = await Auth.fetch('/api/books');
    const books = await booksRes.json();
    const bookSelect = document.getElementById('issue-book-select');
    bookSelect.innerHTML = '<option value="">Choose a book...</option>';
    books.forEach(b => {
      if (b.available_copies > 0) {
        bookSelect.innerHTML += `<option value="${b.id}">${escapeHtml(b.title)} (${b.available_copies} available) - By ${escapeHtml(b.author)}</option>`;
      }
    });

    // 2. Fetch active members (status === 'active')
    const membersRes = await Auth.fetch('/api/members');
    const members = await membersRes.json();
    const memberSelect = document.getElementById('issue-member-select');
    memberSelect.innerHTML = '<option value="">Choose a member...</option>';
    members.forEach(m => {
      if (m.status === 'active') {
        memberSelect.innerHTML += `<option value="${m.id}">${escapeHtml(m.name)} (ID: ${escapeHtml(m.member_code)})</option>`;
      }
    });

    document.getElementById('issue-form').reset();
    document.getElementById('issue-days').value = '14';
    openModal('issue-modal');
  } catch (err) {
    showToast('Error preparing issuing form', 'error');
  }
}

async function handleIssueSubmit(e) {
  e.preventDefault();
  const payload = {
    book_id: document.getElementById('issue-book-select').value,
    member_id: document.getElementById('issue-member-select').value,
    days: document.getElementById('issue-days').value
  };

  try {
    const res = await Auth.fetch('/api/borrow', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to issue book', 'error');
      return;
    }

    closeModal('issue-modal');
    showToast('Book checked out successfully!', 'success');
    renderBorrow();
  } catch (err) {
    console.error(err);
  }
}

async function handleReturn(id) {
  if (!confirm('Are you sure you want to return this book copy?')) return;
  try {
    const res = await Auth.fetch(`/api/borrow/return/${id}`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Return failed', 'error');
      return;
    }

    if (data.fine_accrued > 0) {
      showToast(`Book returned. Overdue fine generated: GHS ${parseFloat(data.fine_accrued).toFixed(2)}`, 'warning');
    } else {
      showToast('Book returned successfully!', 'success');
    }
    renderBorrow();
  } catch (err) {
    console.error(err);
  }
}

async function handleRenew(id) {
  if (!confirm('Renew this book for another 14 days?')) return;
  try {
    const res = await Auth.fetch(`/api/borrow/renew/${id}`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Renewal failed', 'error');
      return;
    }

    showToast('Loan renewed successfully!', 'success');
    renderBorrow();
  } catch (err) {
    console.error(err);
  }
}

// --- 5. FINES VIEW ---
async function renderFines() {
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3><i class="fa-solid fa-file-invoice-dollar"></i> Generated Fines & Settlements</h3>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Member Code</th>
                <th>Book Title</th>
                <th>Fine Amount</th>
                <th>Charged Date</th>
                <th>Settled Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="fines-table-body">
              <tr>
                <td colspan="8" class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading fines records...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  await fetchFines();
}

async function fetchFines() {
  try {
    const res = await Auth.fetch('/api/fines');
    const data = await res.json();
    const tbody = document.getElementById('fines-table-body');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <i class="fa-solid fa-thumbs-up" style="color: var(--color-success);"></i>
            <h4>No fine charges generated</h4>
            <p>All members are up to date with their accounts.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.map(fine => {
      const chargeDate = new Date(fine.charged_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const payDate = fine.paid_date 
        ? new Date(fine.paid_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '-';

      const statusBadge = fine.paid === 1
        ? '<span class="badge badge-active">Paid</span>'
        : '<span class="badge badge-suspended">Unpaid</span>';

      const actionBtn = fine.paid === 0
        ? `<button class="btn btn-success btn-sm" onclick="handlePayFine(${fine.id})"><i class="fa-solid fa-money-bill-wave"></i> Collect Payment</button>`
        : '<span style="color: var(--text-muted); font-size:0.8rem;"><i class="fa-solid fa-circle-check"></i> Settled</span>';

      return `
        <tr>
          <td style="font-weight:600;">${escapeHtml(fine.member_name)}</td>
          <td><code>${escapeHtml(fine.member_code)}</code></td>
          <td>${escapeHtml(fine.book_title)}</td>
          <td style="font-weight:600; color: ${fine.paid === 0 ? 'var(--color-danger)' : 'var(--color-success)'}">GHS ${parseFloat(fine.amount).toFixed(2)}</td>
          <td>${chargeDate}</td>
          <td>${payDate}</td>
          <td>${statusBadge}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load fines data', 'error');
  }
}

async function handlePayFine(id) {
  if (!confirm('Record fine payment in GHS? Please confirm cash collection.')) return;
  try {
    const res = await Auth.fetch(`/api/fines/pay/${id}`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Payment failed', 'error');
      return;
    }

    showToast('Fine payment received and closed.', 'success');
    renderFines();
  } catch (err) {
    console.error(err);
  }
}

// --- 6. SETTINGS VIEW ---
async function renderSettings() {
  const container = document.getElementById('view-container');
  container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading configuration...</div>`;

  try {
    const res = await Auth.fetch('/api/settings');
    const settings = await res.json();
    const rate = parseFloat(settings.fine_rate || '2.00');

    container.innerHTML = `
      <div class="row">
        <!-- Fine Configuration Card -->
        <div class="col-6">
          <div class="card">
            <div class="card-header">
              <h3><i class="fa-solid fa-gears"></i> Standard Fine Policy</h3>
            </div>
            <div class="card-body">
              <form id="settings-form" onsubmit="handleSettingsSubmit(event)">
                <div class="form-group">
                  <label for="settings-fine-rate">Daily Overdue Fine Rate (GHS)*</label>
                  <input type="number" id="settings-fine-rate" step="0.10" min="0.00" value="${rate.toFixed(2)}" required>
                </div>
                <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Save Settings</button>
              </form>
            </div>
          </div>
        </div>

        <!-- Add Librarian User Accounts -->
        <div class="col-6">
          <div class="card">
            <div class="card-header">
              <h3><i class="fa-solid fa-user-plus"></i> Create Librarian Account</h3>
            </div>
            <div class="card-body">
              <form id="reg-lib-form" onsubmit="handleRegisterLibrarianSubmit(event)">
                <div class="form-group">
                  <label for="reg-username">Username*</label>
                  <input type="text" id="reg-username" required placeholder="Librarian username">
                </div>
                <div class="form-group">
                  <label for="reg-password">Password*</label>
                  <input type="password" id="reg-password" required placeholder="Librarian password (min 6 chars)">
                </div>
                <button type="submit" class="btn btn-success"><i class="fa-solid fa-user-shield"></i> Register Librarian</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h4>Settings error</h4><p>Failed to retrieve system settings.</p></div>`;
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const payload = {
    fine_rate: document.getElementById('settings-fine-rate').value
  };

  try {
    const res = await Auth.fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to save settings', 'error');
      return;
    }

    showToast('Fine settings saved successfully', 'success');
  } catch (err) {
    console.error(err);
  }
}

async function handleRegisterLibrarianSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;

  if (password.length < 6) {
    showToast('Password must be at least 6 characters long', 'warning');
    return;
  }

  try {
    const res = await Auth.fetch('/api/auth/register-librarian', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to create user', 'error');
      return;
    }

    showToast('Librarian account created!', 'success');
    document.getElementById('reg-lib-form').reset();
  } catch (err) {
    console.error(err);
  }
}

// --- UTILITIES ---

// Escape HTML tags to prevent XSS injection
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
