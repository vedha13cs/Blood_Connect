/**
 * BloodConnect — Core Interactive Logic & Application Engine
 * Supports seamless hybrid mode: Flask API + MongoDB backend or Standalone offline Demo mode.
 */

// ==========================================================================
// 1. Data Store & Initial Seeds
// ==========================================================================
const DEFAULT_CITY = 'Mangaluru';
let currentCity = DEFAULT_CITY;
let isBackendLive = false;
let currentUser = null;

const SEED_DONORS = [
  { id: 'D-101', name: 'Dr. Asha Kamath', group: 'O+', city: 'Mangaluru', area: 'Kadri', phone: '9845100021', verified: true, distance: '1.4 km', lastDonated: '4 months ago', count: 6 },
  { id: 'D-102', name: 'Ravi Shekhar', group: 'A+', city: 'Mangaluru', area: 'Bejai', phone: '9900200045', verified: true, distance: '2.8 km', lastDonated: '6 months ago', count: 4 },
  { id: 'D-103', name: 'Vikram Prabhu', group: 'B+', city: 'Mangaluru', area: 'Hampankatta', phone: '9741300099', verified: true, distance: '3.1 km', lastDonated: '2 months ago', count: 9 },
  { id: 'D-104', name: 'Deepa Nayak', group: 'AB+', city: 'Mangaluru', area: 'Kankanady', phone: '9448500032', verified: true, distance: '2.0 km', lastDonated: '5 months ago', count: 3 },
  { id: 'D-105', name: 'Mohammed Imran', group: 'O-', city: 'Mangaluru', area: 'Bunder', phone: '9008100033', verified: true, distance: '4.2 km', lastDonated: '3 months ago', count: 12 },
  { id: 'D-106', name: 'Sneha Rao', group: 'A-', city: 'Mangaluru', area: 'Urwa', phone: '9880200078', verified: true, distance: '2.5 km', lastDonated: '7 months ago', count: 2 },
  { id: 'D-107', name: 'Karthik Shenoy', group: 'B-', city: 'Mangaluru', area: 'Surathkal', phone: '9611400054', verified: true, distance: '12 km', lastDonated: '4 months ago', count: 5 },
  { id: 'D-108', name: 'Meera Pai', group: 'O-', city: 'Udupi', area: 'Manipal', phone: '9731200008', verified: true, distance: '1.8 km', lastDonated: '2 months ago', count: 8 },
  { id: 'D-109', name: 'Girish Shetty', group: 'B+', city: 'Udupi', area: 'Brahmavar', phone: '9844500067', verified: true, distance: '4.0 km', lastDonated: '5 months ago', count: 4 },
  { id: 'D-110', name: 'Ananya Sharma', group: 'O+', city: 'Bengaluru', area: 'Indiranagar', phone: '9901100082', verified: true, distance: '3.5 km', lastDonated: '3 months ago', count: 7 },
  { id: 'D-111', name: 'Arjun Verma', group: 'AB-', city: 'Bengaluru', area: 'Koramangala', phone: '9845000091', verified: true, distance: '4.1 km', lastDonated: '6 months ago', count: 5 }
];

const SEED_BANKS = [
  {
    id: 'B-201',
    name: 'KMC Hospital Blood Centre',
    city: 'Mangaluru',
    address: 'Ambedkar Circle, Light House Hill Rd',
    phone: '0824-2444590',
    type: 'NABH Accredited',
    stock: { 'A+': 18, 'A-': 4, 'B+': 22, 'B-': 3, 'O+': 31, 'O-': 2, 'AB+': 9, 'AB-': 1 }
  },
  {
    id: 'B-202',
    name: 'District Wenlock Hospital Blood Centre',
    city: 'Mangaluru',
    address: 'Opp. Railway Station, Hampankatta',
    phone: '0824-2425555',
    type: 'Government Red Cross',
    stock: { 'A+': 26, 'A-': 5, 'B+': 19, 'B-': 4, 'O+': 28, 'O-': 6, 'AB+': 7, 'AB-': 2 }
  },
  {
    id: 'B-203',
    name: 'Father Muller Charitable Hospital Blood Bank',
    city: 'Mangaluru',
    address: 'Father Muller Rd, Kankanady',
    phone: '0824-2238000',
    type: 'Charitable Trust',
    stock: { 'A+': 14, 'A-': 3, 'B+': 16, 'B-': 2, 'O+': 20, 'O-': 4, 'AB+': 5, 'AB-': 1 }
  },
  {
    id: 'B-204',
    name: 'Kasturba Hospital Blood Centre',
    city: 'Udupi',
    address: 'Tiger Circle, Manipal',
    phone: '0820-2922286',
    type: 'NABH Super-Specialty',
    stock: { 'A+': 25, 'A-': 6, 'B+': 30, 'B-': 5, 'O+': 40, 'O-': 8, 'AB+': 12, 'AB-': 3 }
  },
  {
    id: 'B-205',
    name: 'Victoria Hospital Central Blood Bank',
    city: 'Bengaluru',
    address: 'Fort Road, Near City Market',
    phone: '080-26701150',
    type: 'Apex State Centre',
    stock: { 'A+': 45, 'A-': 12, 'B+': 52, 'B-': 9, 'O+': 64, 'O-': 11, 'AB+': 18, 'AB-': 4 }
  }
];

const SEED_REQUESTS = {
  'BR-8492': {
    id: 'BR-8492',
    patient: 'Suma Rai',
    group: 'B+',
    units: 2,
    hospital: 'KMC Hospital, Mangaluru',
    urgency: 'Critical',
    phone: '9845012345',
    status: 'Matching Donors',
    step: 2,
    time: '25 mins ago'
  },
  'BR-1024': {
    id: 'BR-1024',
    patient: 'Venkatesh Rao',
    group: 'O-',
    units: 3,
    hospital: 'Wenlock Hospital, Mangaluru',
    urgency: 'Urgent',
    phone: '9900112233',
    status: 'Units Dispatched',
    step: 4,
    time: '2 hours ago'
  }
};

const CITIES = [
  'Mangaluru', 'Bengaluru', 'Udupi', 'Mysuru', 'Hubballi',
  'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune',
  'Ahmedabad', 'Jaipur', 'Kochi', 'Kolkata', 'Lucknow', 'Patna',
  'Thiruvananthapuram', 'Visakhapatnam'
];

// Local storage helpers
const storage = {
  get: (key, fallback) => {
    try {
      const v = localStorage.getItem('bc_' + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set: (key, val) => {
    try {
      localStorage.setItem('bc_' + key, JSON.stringify(val));
    } catch (e) {}
  }
};

// Check if Flask backend is alive
async function checkBackend() {
  try {
    const res = await fetch('/api/ping');
    if (res.ok) {
      const data = await res.json();
      isBackendLive = !!data.ok;
    } else {
      const data = await res.json().catch(() => ({}));
      console.warn('BloodConnect API unavailable; using demo mode:', data.error || res.statusText);
      isBackendLive = false;
    }
  } catch (error) {
    console.warn('BloodConnect API unreachable; using demo mode:', error);
    isBackendLive = false;
  }
  console.log(`BloodConnect Engine: Mode = ${isBackendLive ? 'Flask + MongoDB' : 'Local demo only'}`);
}

// ==========================================================================
// 2. UI Helper Functions & Modals
// ==========================================================================
function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (modalId === 'modalTrackRequest' && requestStatusPollTimer) {
    clearInterval(requestStatusPollTimer);
    requestStatusPollTimer = null;
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
  if (requestStatusPollTimer) {
    clearInterval(requestStatusPollTimer);
    requestStatusPollTimer = null;
  }
}

function toggleMobileMenu() {
  const navbar = document.querySelector('.navbar');
  const toggle = document.getElementById('menuToggle');
  if (!navbar || !toggle) return;
  const isOpen = navbar.classList.toggle('menu-open');
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
}

// Close modal on escape key or clicking backdrop
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllModals();
    const navbar = document.querySelector('.navbar');
    const toggle = document.getElementById('menuToggle');
    if (navbar && toggle) {
      navbar.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
    }
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeAllModals();
  }
});

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      ${type === 'success' 
        ? '<polyline points="20 6 9 17 4 12"></polyline>' 
        : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
    </svg>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function normalizeIndianPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

// ==========================================================================
// 3. Location Picker Dropdown & City Filtering
// ==========================================================================
function setCity(city) {
  currentCity = city;
  const label = document.getElementById('currentCityLabel');
  if (label) label.textContent = city;
  
  const searchCityDonor = document.getElementById('searchDonorCity');
  if (searchCityDonor) searchCityDonor.value = city;

  const searchCityBank = document.getElementById('searchBankCity');
  if (searchCityBank) searchCityBank.value = city;

  closeModal('modalLocation');
  showToast(`Location set to ${city}. Results updated!`, 'primary');

  // Trigger search updates if modals are active
  renderDonorsList();
  renderBanksList();
}

function initLocationList() {
  const listEl = document.getElementById('cityOptionsList');
  if (!listEl) return;

  listEl.innerHTML = CITIES.map(c => `
    <button class="form-input" style="text-align: left; cursor: pointer; font-weight: 600; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;" onclick="setCity('${c}')">
      <span>📍 ${c}</span>
      ${c === currentCity ? '<span style="color: var(--primary); font-size: 0.8rem; font-weight: 700;">Active</span>' : ''}
    </button>
  `).join('');
}

// ==========================================================================
// 4. Feature 1: Find Donors
// ==========================================================================
let selectedDonorBloodGroup = 'ALL';

function selectDonorGroup(chip, group) {
  document.querySelectorAll('#donorBloodChips .blood-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  selectedDonorBloodGroup = group;
  renderDonorsList();
}

async function renderDonorsList() {
  const listEl = document.getElementById('donorsListContainer');
  if (!listEl) return;

  const cityQuery = (document.getElementById('searchDonorCity')?.value || '').trim().toLowerCase();
  let donors = isBackendLive ? [] : storage.get('donors', SEED_DONORS);

  if (isBackendLive) {
    try {
      const q = new URLSearchParams();
      if (selectedDonorBloodGroup !== 'ALL') q.set('group', selectedDonorBloodGroup);
      if (cityQuery) q.set('city', cityQuery);
      const res = await fetch('/api/donors?' + q.toString());
      if (!res.ok) throw new Error((await res.json()).error || 'Could not load donor listings.');
      const live = await res.json();
      if (!Array.isArray(live)) throw new Error('The donor API returned an invalid response.');
      donors = live.map(donor => ({
        id: donor.id,
        name: donor.name,
        group: donor.group,
        city: donor.city,
        area: donor.area || '',
        phone: donor.phone,
        verified: donor.verified === true
      }));
    } catch (error) {
      console.error('Could not load donor listings:', error);
      listEl.innerHTML = `
        <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
          <p style="font-weight: 700; color: var(--primary);">Donor directory is unavailable</p>
          <p style="font-size: 0.85rem; margin-top: 4px;">${escapeHtml(error.message)} Please try again shortly.</p>
        </div>
      `;
      return;
    }
  }

  // Filter local data
  const filtered = donors.filter(d => {
    const matchGroup = selectedDonorBloodGroup === 'ALL' || d.group === selectedDonorBloodGroup;
    const matchCity = !cityQuery || d.city.toLowerCase().includes(cityQuery) || (d.area && d.area.toLowerCase().includes(cityQuery));
    return matchGroup && matchCity;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">${isBackendLive ? 'No verified donors found in this area' : 'No demo donors found for this search'}</p>
        <p style="font-size: 0.85rem;">${isBackendLive ? 'Donor registrations are shown after verification.' : 'Try another blood group or location. Demo listings are shown while the live backend is offline.'}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(d => `
    <div class="donor-item-card">
      <div class="donor-left">
        <div class="donor-blood-tag">${escapeHtml(d.group)}</div>
        <div class="donor-details">
          <h4>
            ${escapeHtml(d.name)}
            ${isBackendLive && d.verified ? `
              <svg class="verified-badge" viewBox="0 0 24 24" fill="currentColor" title="Verified Volunteer Donor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            ` : ''}
            ${!isBackendLive ? '<small style="display: block; color: var(--text-light); font-size: 0.68rem;">Demo listing — not verified</small>' : ''}
          </h4>
          <p>📍 ${d.area ? `${escapeHtml(d.area)}, ` : ''}${escapeHtml(d.city)}${!isBackendLive && d.distance ? ` &bull; <span style="color: var(--primary); font-weight: 600;">${escapeHtml(d.distance)}</span>` : ''}${!isBackendLive && d.count ? ` &bull; Donated ${Number(d.count)} times` : ''}</p>
        </div>
      </div>
      <div class="donor-actions">
        <button class="btn-contact" style="background: #ffffff;" data-name="${escapeHtml(d.name)}" data-group="${escapeHtml(d.group)}" onclick="requestFromDonor(this.dataset.name, this.dataset.group)">
          Request
        </button>
      </div>
    </div>
  `).join('');
}

function requestFromDonor(donorName, bloodGroup) {
  closeModal('modalFindDonors');
  openModal('modalRequestBlood');
  const grpSelect = document.getElementById('reqBloodGroup');
  if (grpSelect) grpSelect.value = bloodGroup;
  showToast(`Pre-selected Blood Group ${bloodGroup} for request.`, 'primary');
}

// ==========================================================================
// 5. Feature 2: Find Blood Banks
// ==========================================================================
async function renderBanksList() {
  const listEl = document.getElementById('banksListContainer');
  if (!listEl) return;

  const cityQuery = (document.getElementById('searchBankCity')?.value || '').trim().toLowerCase();
  let banks = isBackendLive ? [] : storage.get('banks', SEED_BANKS);

  if (isBackendLive) {
    try {
      const q = new URLSearchParams();
      if (cityQuery) q.set('city', cityQuery);
      const res = await fetch('/api/banks?' + q.toString());
      if (!res.ok) throw new Error((await res.json()).error || 'Could not load blood-bank listings.');
      banks = await res.json();
      if (!Array.isArray(banks)) throw new Error('The blood-bank API returned an invalid response.');
    } catch (error) {
      console.error('Could not load blood-bank listings:', error);
      listEl.innerHTML = `
        <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
          <p style="font-weight: 700; color: var(--primary);">Blood-bank directory is unavailable</p>
          <p style="font-size: 0.85rem; margin-top: 4px;">${escapeHtml(error.message)} Please try again shortly.</p>
        </div>
      `;
      return;
    }
  }

  const filtered = banks.filter(b => !cityQuery || b.city.toLowerCase().includes(cityQuery) || b.name.toLowerCase().includes(cityQuery));

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">${isBackendLive ? 'No verified blood-bank listings found' : 'No demo blood banks found in this city'}</p>
        <p style="font-size: 0.85rem;">${isBackendLive ? 'Please contact a licensed local blood bank directly; this directory only shows listings added by your administrator.' : 'Try searching for another city. Demo listings are shown while the live backend is offline.'}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(bank => {
    const callNumber = normalizeIndianPhone(bank.phone);
    const stock = isBackendLive && bank.stock && Object.keys(bank.stock).length
      ? `<div style="margin-top: 12px; border-top: 1px dashed var(--border-subtle); padding-top: 10px;">
          <div style="font-size: 0.76rem; font-weight: 700; color: var(--text-light); text-transform: uppercase; margin-bottom: 6px;">Reported stock — call to confirm before travelling</div>
          <div class="stock-grid">${Object.entries(bank.stock).map(([group, quantity]) => {
            const statusClass = quantity > 10 ? 'avail' : quantity > 3 ? 'low' : 'critical';
            return `<div class="stock-chip ${statusClass}"><b>${escapeHtml(group)}:</b> ${Number(quantity)} units</div>`;
          }).join('')}</div>
          ${bank.updated_at ? `<p style="font-size: 0.72rem; color: var(--text-light); margin-top: 6px;">Listing updated: ${escapeHtml(new Date(bank.updated_at).toLocaleString())}</p>` : ''}
        </div>`
      : '<p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 10px;">Live stock is not available here. Call the blood bank to confirm availability.</p>';

    return `
      <div class="bank-item-card" style="flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <span style="font-size: 0.72rem; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">${escapeHtml(isBackendLive ? bank.type || 'Verified listing' : 'Demo listing')}</span>
            <h4 style="font-size: 1.05rem; font-weight: 700; margin-top: 6px;">${escapeHtml(bank.name)}</h4>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">📍 ${escapeHtml(bank.address)}, <b>${escapeHtml(bank.city)}</b></p>
            <p style="font-size: 0.82rem; color: var(--text-main); font-weight: 600; margin-top: 4px;">📞 ${escapeHtml(bank.phone || 'Phone not listed')}</p>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            ${isBackendLive && callNumber ? `<a href="tel:${escapeHtml(callNumber)}" class="btn-contact" aria-label="Call ${escapeHtml(bank.name)}">Call bank</a>` : !isBackendLive && callNumber ? '<span class="btn-contact" aria-disabled="true" title="Demo phone numbers are not verified">Demo phone only</span>' : ''}
            <a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${bank.name} ${bank.address} ${bank.city}`)}" target="_blank" rel="noopener noreferrer" class="btn-contact" style="background: #fff;">Directions</a>
          </div>
        </div>
        ${stock}
      </div>
    `;
  }).join('');
}

// ==========================================================================
// 6. Feature 3: Become a Donor
// ==========================================================================
let donorFormSelectedGroup = 'O+';

function selectRegisterBloodChip(chip, group) {
  document.querySelectorAll('#regBloodChips .blood-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  donorFormSelectedGroup = group;
}

async function handleDonorRegistration(event) {
  event.preventDefault();

  const name = document.getElementById('regName').value.trim();
  const age = parseInt(document.getElementById('regAge').value);
  const city = document.getElementById('regCity').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const consent = document.getElementById('regConsent').checked;

  if (!name || !city || !phone) {
    showToast('Please fill all required fields.', 'primary');
    return;
  }

  if (age < 18 || age > 65) {
    showToast('Donor age must be between 18 and 65 years.', 'primary');
    return;
  }

  if (!/^\d{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit mobile number.', 'primary');
    return;
  }

  if (!consent) {
    showToast('Please consent to volunteer donation guidelines.', 'primary');
    return;
  }

  const maskedPhone = phone.slice(0, 2) + '******' + phone.slice(-2);
  const newDonor = {
    id: 'D-' + Math.floor(1000 + Math.random() * 9000),
    name: name,
    age: age,
    group: donorFormSelectedGroup,
    city: city,
    area: 'Central',
    phone: maskedPhone,
    verified: false,
    distance: 'Nearby',
    lastDonated: 'Eligible now',
    count: 1
  };

  if (isBackendLive) {
    try {
      const response = await fetch('/api/donors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          age: age,
          group: donorFormSelectedGroup,
          city: city,
          phone: phone,
          consent: true
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit donor registration.');
      newDonor.id = result.id;
    } catch (error) {
      console.error('Could not submit donor registration:', error);
      showToast(error.message || 'Could not submit donor registration. Please try again.', 'primary');
      return;
    }
  } else {
    const donors = storage.get('donors', SEED_DONORS);
    donors.unshift(newDonor);
    storage.set('donors', donors);
  }

  // Update donor count stat dynamically
  const donorsCountEl = document.getElementById('statDonorsCount');
  if (donorsCountEl) {
    const cur = parseInt(donorsCountEl.textContent.replace(/\D/g, '')) || 8640;
    donorsCountEl.textContent = (cur + 1).toLocaleString() + '+';
  }

  closeModal('modalBecomeDonor');
  showToast(
    isBackendLive
      ? `Thank you, ${name}. Registration received and pending verification.`
      : `Thank you, ${name}. This demo registration is saved in this browser only.`,
    isBackendLive ? 'success' : 'primary'
  );

  // Show digital donor badge card modal
  showDonorIdCard(newDonor);
}

function showDonorIdCard(donor) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-dialog" style="max-width: 440px; padding: 26px 24px; text-align: center;">
      <span style="font-size: 0.76rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--primary);">BloodConnect Hero Card</span>
      <h3 style="font-size: 1.35rem; font-weight: 800; margin: 4px 0 16px;">Donor Registration</h3>

      <div style="background: linear-gradient(135deg, #78101b 0%, #b31322 100%); color: #fff; border-radius: 18px; padding: 22px; text-align: left; box-shadow: 0 12px 30px rgba(180, 20, 35, 0.35); position: relative; overflow: hidden; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
          <div style="font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            BloodConnect
          </div>
          <div style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">PENDING REVIEW</div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 0.75rem; opacity: 0.8; text-transform: uppercase;">DONOR NAME</div>
            <div style="font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em;">${escapeHtml(donor.name)}</div>
            <div style="font-size: 0.78rem; opacity: 0.9; margin-top: 4px;">📍 ${escapeHtml(donor.city)} &bull; ID: ${escapeHtml(donor.id)}</div>
          </div>
          <div style="width: 50px; height: 50px; background: #ffffff; color: var(--primary); font-size: 1.35rem; font-weight: 800; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            ${escapeHtml(donor.group)}
          </div>
        </div>
      </div>

      <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 20px;">
        Thank you for registering. Your details need to be reviewed before appearing in the verified donor directory. This prototype does not send SMS or request notifications.
      </p>

      <button class="btn-hero-primary" style="width: 100%; justify-content: center;" onclick="this.closest('.modal-overlay').remove()">Done</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ==========================================================================
// 7. Feature 4: Request Blood & Emergency Tracking
// ==========================================================================
async function handleBloodRequest(event) {
  event.preventDefault();

  const patient = document.getElementById('reqPatientName').value.trim();
  const group = document.getElementById('reqBloodGroup').value;
  const units = parseInt(document.getElementById('reqUnits').value) || 1;
  const hospital = document.getElementById('reqHospital').value.trim();
  const urgency = document.getElementById('reqUrgency').value;
  const phone = document.getElementById('reqPhone').value.trim();

  if (!patient || !hospital || !phone) {
    showToast('Please fill all patient and hospital details.', 'primary');
    return;
  }

  if (!/^\d{10}$/.test(phone) || units < 1 || units > 10) {
    showToast('Enter a valid 10-digit mobile number and request 1 to 10 units.', 'primary');
    return;
  }

  const requestData = {
    patient: patient,
    group: group,
    units: units,
    hospital: hospital,
    urgency: urgency,
    phone: phone
  };

  const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    let newReq;
    if (isBackendLive) {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit the request.');
      newReq = result;
    } else {
      newReq = {
        ...requestData,
        id: 'BR-' + Math.floor(1000 + Math.random() * 9000),
        status: 'Submitted',
        step: 1,
        time: new Date().toISOString()
      };
    }

    const requests = storage.get('requests', SEED_REQUESTS);
    requests[newReq.id] = newReq;
    storage.set('requests', requests);

    const reqCountEl = document.getElementById('statRequestsCount');
    if (reqCountEl) {
      const cur = parseInt(reqCountEl.textContent.replace(/\D/g, '')) || 19600;
      reqCountEl.textContent = (cur + 1).toLocaleString() + '+';
    }

    closeModal('modalRequestBlood');
    showToast(
      isBackendLive
        ? `Request ${newReq.id} was saved. Call a listed blood bank to confirm availability.`
        : `Request ${newReq.id} was saved in this browser only. It was not sent to a blood bank.`,
      isBackendLive ? 'success' : 'primary'
    );
    trackRequestId(newReq.id);
  } catch (error) {
    console.error('Could not submit blood request:', error);
    showToast(error.message || 'Could not submit the request. Please try again.', 'primary');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

let requestStatusPollTimer = null;

function trackRequestId(rid) {
  if (requestStatusPollTimer) clearInterval(requestStatusPollTimer);
  openModal('modalTrackRequest');
  const input = document.getElementById('trackInputId');
  if (input) input.value = rid;
  renderTrackStatus(rid);
  if (isBackendLive) {
    requestStatusPollTimer = setInterval(() => renderTrackStatus(rid), 15000);
  }
}

function handleTrackSubmit() {
  const rid = (document.getElementById('trackInputId')?.value || '').trim().toUpperCase();
  if (!rid) {
    showToast('Please enter a valid Tracking ID.', 'primary');
    return;
  }
  trackRequestId(rid);
}

async function renderTrackStatus(rid) {
  const container = document.getElementById('trackResultContainer');
  if (!container) return;

  let req;
  if (isBackendLive) {
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(rid)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load request status.');
      req = result;
    } catch (error) {
      console.error('Could not load blood request status:', error);
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 12px; color: var(--text-muted);">
          <p style="font-weight: 700; color: var(--primary);">${escapeHtml(error.message)}</p>
          <p style="font-size: 0.85rem; margin-top: 4px;">Please check your connection and try again.</p>
        </div>
      `;
      return;
    }
  } else {
    const requests = storage.get('requests', SEED_REQUESTS);
    req = requests[rid];
  }

  if (!req) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 12px; color: var(--text-muted);">
        <p style="font-weight: 700; color: var(--primary);">Request ID "${escapeHtml(rid)}" not found</p>
        <p style="font-size: 0.85rem; margin-top: 4px;">Please check the ID and try again.</p>
      </div>
    `;
    return;
  }

  const step = Number(req.step) || 1;
  const progress = [
    ['Request received', 'The request has been recorded. No blood bank or donor is contacted automatically.'],
    ['Blood bank contacted', 'Call a listed blood bank to confirm current stock and eligibility.'],
    ['Availability confirmed', 'A blood bank or donor has confirmed availability.'],
    ['Request fulfilled', 'The requested blood has been arranged.']
  ];
  const createdDate = req.time ? new Date(req.time) : null;
  const createdAt = createdDate && !Number.isNaN(createdDate.getTime())
    ? createdDate.toLocaleString()
    : 'Not available';

  container.innerHTML = `
    <div class="tracker-box">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--primary);">Tracking ID: ${escapeHtml(req.id)}</span>
          <h4 style="font-size: 1.15rem; font-weight: 800; margin-top: 2px;">${req.patient ? `Patient: ${escapeHtml(req.patient)} (${escapeHtml(req.group)})` : `Blood request (${escapeHtml(req.group)})`}</h4>
          <p style="font-size: 0.82rem; color: var(--text-muted);">${req.hospital ? `📍 ${escapeHtml(req.hospital)} &bull; ` : ''}${Number(req.units) || 1} Units Needed</p>
        </div>
        <div style="text-align: right;">
          <span style="background: ${req.urgency === 'Critical' ? '#fee2e2' : '#fef3c7'}; color: ${req.urgency === 'Critical' ? '#991b1b' : '#92400e'}; font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 99px;">
            ${escapeHtml(req.status || 'Submitted')}
          </span>
          <p style="font-size: 0.75rem; color: var(--text-light); margin-top: 6px;">Created: ${escapeHtml(createdAt)}</p>
        </div>
      </div>

      <div class="stepper">
        ${progress.map(([title, description], index) => {
          const number = index + 1;
          const state = req.status === 'Cancelled'
            ? ''
            : number < step ? 'done' : number === step ? 'active' : '';
          return `<div class="step-item ${state}">
            <div class="step-circle">${number}</div>
            <div class="step-info">
              <h5>${title}</h5>
              <p>${description}</p>
            </div>
          </div>`;
        }).join('')}
      </div>
      ${req.status === 'Cancelled' ? '<p style="color: var(--primary); font-weight: 700; margin-top: 12px;">This request was cancelled.</p>' : ''}
      <button type="button" class="btn-hero-secondary" style="margin-top: 18px;" onclick="closeModal('modalTrackRequest'); openModal('modalFindBanks')">Find &amp; call a blood bank</button>
    </div>
  `;
}

// ==========================================================================
// 8. Role session display
// ==========================================================================
function handleLogout() {
  currentUser = null;
  storage.set('user', null);

  document.getElementById('navLoginBtn').style.display = 'inline-block';
  document.getElementById('navRegisterBtn').style.display = 'inline-block';
  document.getElementById('userProfileBadge').style.display = 'none';

  showToast('You have been logged out.', 'primary');
}

// Check if user was previously logged in
function checkPersistedLogin() {
  const savedUser = storage.get('user', null);
  if (savedUser && savedUser.name) {
    currentUser = savedUser;
    document.getElementById('navLoginBtn').style.display = 'none';
    document.getElementById('navRegisterBtn').style.display = 'none';
    const userBadge = document.getElementById('userProfileBadge');
    userBadge.style.display = 'flex';
    document.getElementById('userAvatarInitial').textContent = savedUser.name[0];
    document.getElementById('userNameDisplay').textContent = savedUser.name.split(' ')[0];
  }
}

// ==========================================================================
// 9. Stats Counter Smooth Animation
// ==========================================================================
function animateCounters() {
  const counters = [
    { id: 'statLivesCount', target: 14280 },
    { id: 'statDonorsCount', target: 8640 },
    { id: 'statBanksCount', target: 420 },
    { id: 'statRequestsCount', target: 19600 }
  ];

  counters.forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;

    let start = 0;
    const duration = 1800; // ms
    const stepTime = 25;
    const totalSteps = duration / stepTime;
    const increment = c.target / totalSteps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= c.target) {
        start = c.target;
        clearInterval(timer);
      }
      el.textContent = Math.floor(start).toLocaleString() + '+';
    }, stepTime);
  });
}

// ==========================================================================
// 10. Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initLocationList();
  checkPersistedLogin();
  animateCounters();

  checkBackend().then(() => {
    renderDonorsList();
    renderBanksList();
    const sampleRequestIds = document.getElementById('sampleRequestIds');
    if (sampleRequestIds && isBackendLive) sampleRequestIds.style.display = 'none';

    const params = new URLSearchParams(window.location.search);
    if (params.get('open') === 'request') {
      openModal('modalRequestBlood');
    } else if (params.get('open') === 'donor') {
      openModal('modalBecomeDonor');
    } else if (params.get('open') === 'donors') {
      openModal('modalFindDonors');
    } else if (params.get('open') === 'banks') {
      openModal('modalFindBanks');
    } else if (params.get('open') === 'track') {
      openModal('modalTrackRequest');
    } else if (params.has('track')) {
      trackRequestId(params.get('track'));
    }
  });

  console.log('BloodConnect Web Engine Initialized Successfully.');
});
