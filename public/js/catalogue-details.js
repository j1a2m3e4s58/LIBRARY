function openLiteratureDetails(bookId) {
  const book = catalogueData.find(item => item.id === bookId);
  if (!book) return;
  let modal = document.getElementById('literature-details-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'literature-details-modal';
    modal.className = 'literature-details-modal';
    document.body.appendChild(modal);
  }
  const copies = Array.from({ length: book.total_copies }, (_, index) => {
    const available = index < book.available_copies;
    const dueAt = new Date(Date.now() + (index + 2) * 86400000 + 5 * 3600000).toISOString();
    return `<div class="copy-row"><div><strong>KH-${String(book.id).padStart(3,'0')}-${String(index + 1).padStart(2,'0')}</strong><span><i class="fa-solid fa-location-dot"></i> Main Shelf · ${escapeHtml(book.category)}</span>${available ? '' : `<span class="copy-countdown" data-due="${dueAt}"><i class="fa-regular fa-hourglass-half"></i> Calculating return time...</span>`}</div><span class="copy-status ${available ? 'available' : 'borrowed'}">${available ? 'AVAILABLE' : 'BORROWED'}</span></div>`;
  }).join('');
  const user = Auth.getUser();
  const actionText = book.available_copies > 0 ? 'Request this book' : 'Join the waitlist';
  modal.innerHTML = `<div class="literature-dialog" role="dialog" aria-modal="true" aria-labelledby="literature-dialog-title"><button class="literature-close" onclick="closeLiteratureDetails()" aria-label="Close">&times;</button><section class="literature-dialog-book"><div class="dialog-book-image" style="background-image:linear-gradient(180deg,rgba(4,24,15,.06),rgba(4,24,15,.72)),url('${catalogueImage(book)}')"><span>${escapeHtml(book.category)}</span></div><span class="dialog-eyebrow">${escapeHtml(book.category)}</span><h2 id="literature-dialog-title">${escapeHtml(book.title)}</h2><p class="dialog-author">by ${escapeHtml(book.author)}</p><div class="dialog-book-meta"><div><span>Publisher</span><strong>${escapeHtml(book.publisher)}</strong></div><div><span>Published</span><strong>${book.year_published}</strong></div><div><span>ISBN</span><strong>${escapeHtml(book.isbn)}</strong></div><div><span>Copies</span><strong>${book.available_copies} of ${book.total_copies} ready</strong></div></div></section><section class="literature-dialog-copies"><span class="dialog-eyebrow">LIVE INVENTORY</span><h3>Physical copies</h3><p>Check shelf status, then send a request to the circulation desk.</p><div class="copy-list">${copies}</div><div class="student-next-step"><i class="fa-solid ${book.available_copies > 0 ? 'fa-hand-pointer' : 'fa-bell'}"></i><div><strong>${book.available_copies > 0 ? 'Ready for your request' : 'Currently unavailable'}</strong><span>${book.available_copies > 0 ? 'A librarian will confirm collection after your request.' : 'Join the waitlist and the library will notify you when a copy returns.'}</span></div></div><button class="dialog-request-btn" onclick="submitLiteratureRequest(${book.id})">${actionText}<i class="fa-solid fa-arrow-right"></i></button><small class="request-user-note">Requesting as ${escapeHtml(user?.username || 'guest')}</small></section></div>`;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  updateReturnCountdowns();
}

function updateReturnCountdowns() {
  document.querySelectorAll('.copy-countdown').forEach(item => {
    const remaining = new Date(item.dataset.due) - new Date();
    if (remaining <= 0) { item.innerHTML = '<i class="fa-solid fa-circle-check"></i> Return expected now'; return; }
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    item.innerHTML = `<i class="fa-regular fa-hourglass-half"></i> Due back in ${days}d ${hours}h ${minutes}m`;
  });
}
setInterval(updateReturnCountdowns, 60000);

function closeLiteratureDetails() {
  document.getElementById('literature-details-modal')?.classList.remove('active');
  document.body.style.overflow = '';
}

function submitLiteratureRequest(bookId) {
  const book = catalogueData.find(item => item.id === bookId);
  const user = Auth.getUser();
  const requests = JSON.parse(localStorage.getItem('knowledge_hub_requests') || '[]');
  if (requests.some(item => item.bookId === bookId && item.username === user?.username)) {
    return showToast('You already have an active request for this title.', 'info');
  }
  requests.push({ bookId, title: book.title, username: user?.username || 'guest', type: book.available_copies > 0 ? 'borrow-request' : 'waitlist', createdAt: new Date().toISOString() });
  localStorage.setItem('knowledge_hub_requests', JSON.stringify(requests));
  closeLiteratureDetails();
  showToast(book.available_copies > 0 ? 'Request sent. Visit the circulation desk after confirmation.' : 'You joined the waitlist for this title.', 'success');
}

document.addEventListener('click', event => {
  if (event.target.id === 'literature-details-modal') closeLiteratureDetails();
});
