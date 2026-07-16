const staffDashboardRenderer = renderDashboard;
renderDashboard = function renderRoleDashboard() {
  return Auth.getUser()?.role === 'student' ? renderStudentHome() : staffDashboardRenderer();
};

const studentDemo = {
  loans: [
    { id: 1, title: 'Probability and Statistics for Engineering and the Sciences', author: 'Jay Devore', due: '2026-07-19T16:00:00', progress: 62, status: 'Due soon' },
    { id: 2, title: 'Clean Code', author: 'Robert C. Martin', due: '2026-07-23T16:00:00', progress: 35, status: 'On time' },
    { id: 3, title: 'Homegoing', author: 'Yaa Gyasi', due: '2026-07-14T16:00:00', progress: 88, status: 'Overdue' }
  ],
  reservations: [
    { id: 'R-1042', title: 'Artificial Intelligence: A Modern Approach', date: '15 Jul 2026', queue: 1, deadline: '18 Jul 2026', state: 'Ready for collection' },
    { id: 'R-1057', title: 'Computer Science: An Overview', date: '14 Jul 2026', queue: 2, deadline: 'Waiting for return', state: 'In queue' }
  ],
  fines: [
    { id: 'F-208', title: 'Homegoing', reason: '1 day overdue', total: 8, paid: 0, date: '15 Jul 2026' },
    { id: 'F-194', title: 'The Beautyful Ones Are Not Yet Born', reason: 'Late return', total: 6, paid: 6, date: '3 Jul 2026' }
  ]
};

function setStudentBackground(image) {
  const app = document.getElementById('app-section');
  app.style.backgroundImage = `linear-gradient(rgba(2,18,10,.22),rgba(2,18,10,.38)),url('images/${image}')`;
  app.style.backgroundSize = 'cover'; app.style.backgroundPosition = 'center';
}

const studentHeroSlides = [
  ['student-reading-bg.png', 'YOUR KNOWLEDGE HUB', 'Welcome back, {student}.', 'See what is available, manage your books, and stay ahead of every deadline.'],
  ['ghana-library-login-v2.png', 'DISCOVER MORE', 'Thousands of ideas begin with one book.', 'Explore literature, course texts, and research resources from your phone.'],
  ['student-reservations-bg.png', 'RESERVE WITH EASE', 'Your next book can wait for you.', 'Join a queue, follow your position, and collect approved reservations on time.'],
  ['ghana-library-catalog-v2.png', 'EXPLORE THE COLLECTION', 'Find the right title for every course.', 'Search the complete catalogue and see live copy availability before you visit.'],
  ['student-loans-bg.png', 'READ ON TIME', 'Your borrowing journey, clearly organized.', 'Follow return countdowns, renew early, and avoid unnecessary charges.'],
  ['ghana-library-members-v2.png', 'A READING COMMUNITY', 'Learn alongside curious minds.', 'The Knowledge Hub connects students with ideas, stories, and research support.'],
  ['ghana-library-service-v2.png', 'HELP WHEN YOU NEED IT', 'Library support made simple.', 'Get guidance from the circulation team and keep every request moving.'],
  ['ghana-library-fines-v2.png', 'STAY ON TRACK', 'Clear deadlines, fewer surprises.', 'See overdue items and charges early so you can act before they grow.'],
  ['ghana-library-settings-v2.png', 'LEARN ANYWHERE', 'Your library travels with you.', 'Use the student workspace comfortably on mobile, tablet, or desktop.']
];

function studentHeroMarkup() {
  const student = escapeHtml(Auth.getUser()?.username || 'Student');
  const slides = studentHeroSlides.map((slide, index) => `<div class="hero-slide${index === 0 ? ' active' : ''}" style="background-image:url('images/${slide[0]}')"><div class="hero-copy"><span>${slide[1]}</span><h2>${slide[2].replace('{student}', student)}</h2><p>${slide[3]}</p></div></div>`).join('');
  const dots = studentHeroSlides.map((_, index) => `<button${index === 0 ? ' class="active"' : ''} aria-label="Show banner ${index + 1}"></button>`).join('');
  return `<section class="dashboard-hero" id="dashboard-hero">${slides}<button class="hero-arrow hero-prev" type="button" aria-label="Previous banner"><i class="fa-solid fa-arrow-left"></i></button><button class="hero-arrow hero-next" type="button" aria-label="Next banner"><i class="fa-solid fa-arrow-right"></i></button><div class="hero-dots">${dots}</div><div class="hero-progress"><span></span></div></section>`;
}

function expandStudentHero() {
  const hero = document.getElementById('dashboard-hero');
  if (!hero || hero.querySelectorAll('.hero-slide').length > 3) return;
  const progress = hero.querySelector('.hero-progress');
  const dots = hero.querySelector('.hero-dots');
  studentHeroSlides.slice(3).forEach((slide, offset) => {
    const panel = document.createElement('div');
    panel.className = 'hero-slide';
    panel.style.backgroundImage = `url('images/${slide[0]}')`;
    panel.innerHTML = `<div class="hero-copy"><span>${slide[1]}</span><h2>${slide[2]}</h2><p>${slide[3]}</p></div>`;
    hero.insertBefore(panel, progress);
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show banner ${offset + 4}`);
    dots.appendChild(dot);
  });
}

async function renderStudentHome() {
  setStudentBackground('student-reading-bg.png');
  const container = document.getElementById('view-container');
  let books = [];
  try { const response = await Auth.fetch('/api/books'); books = await response.json(); } catch (_) {}
  const availableCopies = books.reduce((sum, book) => sum + Number(book.available_copies || 0), 0);
  const unavailableTitles = books.filter(book => Number(book.available_copies) === 0).length;
  const issuedCopies = books.reduce((sum, book) => sum + Number(book.total_copies - book.available_copies), 0);
  const myOverdue = studentDemo.loans.filter(loan => new Date(loan.due) < new Date()).length;
  container.innerHTML = `<section class="dashboard-hero" id="dashboard-hero"><div class="hero-slide active" style="background-image:url('images/student-reading-bg.png')"><div class="hero-copy"><span>YOUR KNOWLEDGE HUB</span><h2>Welcome back, ${escapeHtml(Auth.getUser()?.username || 'Student')}.</h2><p>See what is available, manage your books, and stay ahead of every deadline.</p></div></div><div class="hero-slide" style="background-image:url('images/student-reservations-bg.png')"><div class="hero-copy"><span>DISCOVER MORE</span><h2>Thousands of ideas begin with one book.</h2><p>Explore literature, course texts, and research resources from your phone.</p></div></div><div class="hero-slide" style="background-image:url('images/student-loans-bg.png')"><div class="hero-copy"><span>READ ON TIME</span><h2>Your borrowing journey, clearly organized.</h2><p>Follow return countdowns, renew early, and avoid unnecessary charges.</p></div></div><button class="hero-arrow hero-prev" type="button"><i class="fa-solid fa-arrow-left"></i></button><button class="hero-arrow hero-next" type="button"><i class="fa-solid fa-arrow-right"></i></button><div class="hero-dots"><button class="active"></button><button></button><button></button></div><div class="hero-progress"><span></span></div></section><section class="student-welcome"><div><span>STUDENT SNAPSHOT</span><h2>Your library at a glance</h2><p>Library-wide availability plus information that belongs specifically to you.</p></div><div class="student-id-card"><i class="fa-solid fa-graduation-cap"></i><span>Membership status</span><strong>ACTIVE · UG-2026-8941</strong></div></section><section class="student-stat-grid student-library-stats"><button onclick="navigateTo('catalogue')"><i class="fa-solid fa-book-open"></i><span>Copies available</span><strong>${availableCopies}</strong><small>Ready across the library</small></button><button onclick="navigateTo('catalogue')"><i class="fa-solid fa-ban"></i><span>Unavailable titles</span><strong>${unavailableTitles}</strong><small>Join a waitlist</small></button><button onclick="navigateTo('catalogue')"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Copies issued</span><strong>${issuedCopies}</strong><small>Currently with readers</small></button><button onclick="navigateTo('my-loans')"><i class="fa-solid fa-clock"></i><span>My overdue books</span><strong>${myOverdue}</strong><small>Only your personal record</small></button><button onclick="navigateTo('reservations')"><i class="fa-regular fa-bookmark"></i><span>My reservations</span><strong>${studentDemo.reservations.length}</strong><small>1 ready for collection</small></button></section><section class="student-home-grid"><div class="student-panel"><div class="student-panel-title"><div><span>UPCOMING</span><h3>Return deadlines</h3></div><button onclick="navigateTo('my-loans')">See all</button></div>${studentDemo.loans.slice(0,2).map(loan => loanCompactCard(loan)).join('')}</div><div class="student-panel"><div class="student-panel-title"><div><span>FOR YOU</span><h3>Library essentials</h3></div></div><div class="student-actions"><button onclick="navigateTo('catalogue')"><i class="fa-solid fa-magnifying-glass"></i><span><strong>Explore literature</strong><small>Browse ${books.length || 29} titles</small></span></button><button onclick="navigateTo('reservations')"><i class="fa-solid fa-bell"></i><span><strong>Collection alerts</strong><small>Check holds before they expire</small></span></button><button onclick="showToast('Ask a librarian from the circulation desk for research support.','info')"><i class="fa-solid fa-circle-question"></i><span><strong>Research help</strong><small>Get guidance from a librarian</small></span></button></div></div></section>`;
  expandStudentHero(); initDashboardHero(); startStudentCountdowns();
}

function loanCompactCard(loan) {
  return `<article class="student-loan-compact"><div class="mini-book-cover"><i class="fa-solid fa-book-open"></i></div><div><h4>${escapeHtml(loan.title)}</h4><span>${escapeHtml(loan.author)}</span><strong class="student-countdown" data-due="${loan.due}">Calculating...</strong></div></article>`;
}

function renderMyLoans() {
  setStudentBackground('student-loans-bg.png');
  const container = document.getElementById('view-container');
  container.innerHTML = `<section class="student-page-banner"><span>PERSONAL CIRCULATION</span><h2>Books currently with you</h2><p>Track reading progress and return every resource before its deadline.</p></section><div class="student-loan-grid">${studentDemo.loans.map(loan => `<article class="student-loan-card"><div class="loan-cover"><i class="fa-solid fa-book-open"></i><span>${loan.progress}% read</span></div><div class="loan-card-body"><span class="loan-state ${loan.status.toLowerCase().replace(' ','-')}">${loan.status}</span><h3>${escapeHtml(loan.title)}</h3><p>${escapeHtml(loan.author)}</p><div class="reading-progress"><span style="width:${loan.progress}%"></span></div><div class="loan-deadline"><span>Return countdown</span><strong class="student-countdown" data-due="${loan.due}">Calculating...</strong></div><button onclick="showToast('Renewal request sent to the circulation desk.','success')">Request renewal</button></div></article>`).join('')}</div><section class="student-panel reading-history"><div class="student-panel-title"><div><span>RECENT HISTORY</span><h3>Previously returned</h3></div></div><div class="history-row"><i class="fa-solid fa-circle-check"></i><div><strong>Things Fall Apart</strong><span>Returned 3 July 2026 · On time</span></div></div><div class="history-row"><i class="fa-solid fa-circle-check"></i><div><strong>Introduction to Statistics</strong><span>Returned 18 June 2026 · On time</span></div></div></section>`;
  startStudentCountdowns();
}

function renderStudentReservations() {
  setStudentBackground('student-reservations-bg.png');
  const local = JSON.parse(localStorage.getItem('knowledge_hub_requests') || '[]').filter(item => item.username === Auth.getUser()?.username);
  const combined = [...studentDemo.reservations, ...local.map((item,index) => ({ id:`RQ-${index+1}`,title:item.title,date:'Today',queue:index+1,deadline:item.type==='waitlist'?'Waiting for return':'Collect within 48 hours',state:item.type==='waitlist'?'In queue':'Request submitted' }))];
  document.getElementById('view-container').innerHTML = `<section class="student-page-banner"><span>HOLDS & QUEUES</span><h2>Your reservations</h2><p>Watch queue positions and collect approved books before their hold expires.</p></section><div class="reservation-list">${combined.map(item => `<article class="reservation-card" data-id="${item.id}"><div class="reservation-icon"><i class="fa-regular fa-bookmark"></i></div><div class="reservation-main"><span>${item.id}</span><h3>${escapeHtml(item.title)}</h3><p>Reserved ${item.date}</p></div><div><span>Queue</span><strong>#${item.queue}</strong></div><div><span>Collection deadline</span><strong>${item.deadline}</strong></div><span class="reservation-state">${item.state}</span><button onclick="cancelStudentReservation('${item.id}',this)"><i class="fa-solid fa-xmark"></i> Cancel</button></article>`).join('')}</div>`;
}

function cancelStudentReservation(id, button) {
  button.closest('.reservation-card').remove();
  showToast(`Reservation ${id} cancelled.`, 'info');
}

function renderStudentFines() {
  setStudentBackground('student-fines-bg.png');
  const unpaid = studentDemo.fines.reduce((sum, fine) => sum + fine.total - fine.paid, 0);
  document.getElementById('view-container').innerHTML = `<section class="student-page-banner fines-banner"><div><span>ACCOUNT & PENALTIES</span><h2>Outstanding fines</h2><p>Every charge is connected to the book and return event that created it.</p></div><div class="fine-total"><span>Balance due</span><strong>GHS ${unpaid.toFixed(2)}</strong></div></section><div class="student-fine-list">${studentDemo.fines.map(fine => `<article class="student-fine-card"><div class="fine-book"><i class="fa-solid fa-book"></i><div><span>${fine.id} · ${fine.date}</span><h3>${escapeHtml(fine.title)}</h3><p>${fine.reason}</p></div></div><div><span>Charge</span><strong>GHS ${fine.total.toFixed(2)}</strong></div><div><span>Paid</span><strong>GHS ${fine.paid.toFixed(2)}</strong></div><div><span>Remaining</span><strong class="${fine.total-fine.paid>0?'fine-due':'fine-cleared'}">GHS ${(fine.total-fine.paid).toFixed(2)}</strong></div><button ${fine.total-fine.paid===0?'disabled':''} onclick="showToast('Payment reference created. Complete payment at the accounts desk.','info')">${fine.total-fine.paid===0?'Settled':'Get payment reference'}</button></article>`).join('')}</div><section class="fine-guidance"><i class="fa-solid fa-circle-info"></i><div><strong>How fines are resolved</strong><p>Return the book first, obtain a payment reference here, then settle it at the library accounts desk. Your record updates after confirmation.</p></div></section>`;
}

let studentCountdownTimer;
function startStudentCountdowns() {
  clearInterval(studentCountdownTimer);
  const update = () => document.querySelectorAll('.student-countdown').forEach(element => {
    const difference = new Date(element.dataset.due) - new Date();
    const overdue = difference < 0; const value = Math.abs(difference);
    const days = Math.floor(value/86400000), hours=Math.floor(value%86400000/3600000), minutes=Math.floor(value%3600000/60000);
    element.textContent = overdue ? `Overdue by ${days}d ${hours}h` : `${days}d ${hours}h ${minutes}m remaining`;
    element.classList.toggle('overdue', overdue);
  });
  update(); studentCountdownTimer = setInterval(update, 60000);
}
