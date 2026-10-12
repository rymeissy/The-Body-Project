/* ==========================================================================
   The Body Project — logika prototype
   Vanilla JS, tanpa dependensi eksternal
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Utilitas ---------- */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const rupiah = n => 'Rp ' + n.toLocaleString('id-ID');

  const initials = name =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const dayLabel = key => {
    const d = DAYS.find(x => x.key === key);
    return d ? `${d.day}, ${d.date} Okt 2026` : key;
  };

  /* ---------- State ---------- */
  const state = {
    view: 'schedule',
    day: '2026-10-13',
    type: 'all',
    branch: 'all',
    instructor: 'all',
    search: '',

    // Alur pemesanan
    step: 1,
    klass: null,
    payMode: null,   // 'package' | 'dropin' | 'waitlist'
    packageId: null,
    paymentId: 'qris'
  };

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3200);
  }

  /* ======================================================================
     NAVIGASI
     ====================================================================== */
  function switchView(name) {
    state.view = name;

    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
    $$('#tabbar button').forEach(b => {
      const active = b.dataset.view === name;
      active ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('#tabbar button').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  /* ======================================================================
     FILTER
     ====================================================================== */

  // Chips tipe kelas
  $$('#typeFilter .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#typeFilter .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      state.type = chip.dataset.type;
      renderClasses();
    });
  });

  /* ---------- Kalender: deret hari ---------- */
  /** Sisa slot pada suatu tanggal, mengikuti filter cabang & tipe saat ini. */
  function slotsOn(dayKey) {
    return CLASSES.filter(k =>
      k.day === dayKey &&
      (state.branch === 'all' || k.branchId === state.branch) &&
      (state.type === 'all' || k.type === state.type)
    ).reduce((sum, k) => sum + Math.max(k.capacity - k.taken, 0), 0);
  }

  function renderCalendar() {
    $('#calRow').innerHTML = DAYS.map(d => {
      const slots = slotsOn(d.key);
      const selected = d.key === state.day;
      const dot = slots > 0
        ? `<span class="cal-day__dot${selected ? ' is-selected' : ''}"
                title="${slots} slot tersedia"></span>`
        : '<span class="cal-day__dot is-empty"></span>';

      return `
        <button class="cal-day" type="button" data-day="${d.key}"
                aria-pressed="${selected}">
          <span class="cal-day__name">${d.day}</span>
          <span class="cal-day__num">${d.date}</span>
          ${dot}
        </button>`;
    }).join('');

    $$('#calRow .cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        state.day = btn.dataset.day;
        renderCalendar();
        renderClasses();
      });
    });
  }

  /* ---------- Kartu paket ---------- */
  function renderPackageCard() {
    const p = PACKAGES[0];   // paket aktif
    const pct = Math.round((p.remaining / p.total) * 100);

    $('#pkgCard').innerHTML = `
      <div class="pkg-card__top">
        <span class="pkg-card__icon" aria-hidden="true">✂</span>
        <div class="pkg-card__id">
          <p class="pkg-card__name">
            ${p.name}
            <span class="pkg-card__badge">${p.status}</span>
          </p>
          <p class="pkg-card__meta">Exp. ${p.expires} <span aria-hidden="true">•</span> ${p.includes}</p>
        </div>
      </div>

      <div class="pkg-card__divider"></div>

      <div class="pkg-card__bottom">
        <p class="pkg-card__count">
          <strong>${p.remaining}</strong>/${p.total} sisa sesi tersedia
        </p>
        <button class="btn-topup" type="button" data-topup="${p.id}">
          <span aria-hidden="true">+</span> Top Up Sesi
        </button>
      </div>

      <div class="pkg-card__bar" role="progressbar"
           aria-valuenow="${p.remaining}" aria-valuemin="0" aria-valuemax="${p.total}"
           aria-label="Sesi terpakai">
        <span style="width:${pct}%"></span>
      </div>`;

    $$('[data-topup]').forEach(btn => {
      btn.addEventListener('click', () => toast('Top up sesi segera hadir'));
    });
  }

  // Branch switch di baris atas — memutar lewat 8 cabang
  $('#branchSwitch').addEventListener('click', () => {
    const current = BRANCH_DETAILS.findIndex(
      b => b.name === $('#branchName').textContent.trim());
    const next = BRANCH_DETAILS[(current + 1) % BRANCH_DETAILS.length];
    applyBranchFilter(next.id, true);
    toast('Cabang diubah ke ' + next.name);
  });

  $('#calLink').addEventListener('click', () => toast('Kalender penuh segera hadir'));

  /* ======================================================================
     RENDER DAFTAR KELAS
     ====================================================================== */

  /** Selisih waktu dalam menit, mis. "08:00" & "08:50" → 50 */
  function durationOf(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  function statusBadge(k) {
    const left = k.capacity - k.taken;

    if (left === 0) {
      return `<span class="quota-pill is-full">
                <span aria-hidden="true">⊘</span> Penuh · Waitlist ${k.waitlist}
              </span>`;
    }
    return `<span class="quota-pill">
              <span aria-hidden="true">⊕</span> Sisa ${left} dari ${k.capacity} slot
            </span>`;
  }

  function classCard(k) {
    const full = k.capacity - k.taken === 0;
    const tipe = TYPE_LABELS[k.type] || k.type;

    return `
      <article class="class-card ${full ? 'is-full' : ''}">
        <div class="class-card__head">
          <div>
            <p class="class-card__time">
              ${k.start} – ${k.end} <span>WIB</span>
            </p>
            <p class="class-card__where">
              ${durationOf(k.start, k.end)} Menit <span aria-hidden="true">•</span>
              ${tipe} ${k.studio}
            </p>
          </div>
          ${statusBadge(k)}
        </div>

        <h3 class="class-card__title">${k.name}</h3>

        <div class="class-card__tags">
          <span class="tag tag--level">${k.level}</span>
          ${k.usesPackage ? `
            <span class="tag tag--cover">
              <span class="tag__icon" aria-hidden="true">🛡</span> Dapat kuota paket
            </span>` : ''}
        </div>

        <div class="class-card__foot">
          <div class="instructor">
            <span class="avatar avatar--ring" aria-hidden="true">${initials(k.instructor)}</span>
            <span class="instructor__text">
              <span class="instructor__name">${k.instructor}</span>
              <span class="instructor__role">${INSTRUCTOR_ROLES[k.instructor] || 'Pilates Instructor'}</span>
            </span>
          </div>
          <button class="btn btn--primary" type="button" data-book="${k.id}">
            ${full ? 'Daftar Tunggu' : 'Book Seat'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </article>`;
  }

  function filteredClasses() {
    return CLASSES.filter(k => {
      if (k.day !== state.day) return false;
      if (state.type !== 'all' && k.type !== state.type) return false;
      if (state.branch !== 'all' && k.branchId !== state.branch) return false;
      return true;
    });
  }

  function renderClasses() {
    const list = $('#classList');
    const items = filteredClasses();

    if (items.length === 0) {
      const namaCabang = state.branch === 'all' ? '' : ' di ' + branchName(state.branch);
      list.innerHTML = `
        <div class="empty" style="grid-column:1/-1;">
          <div class="empty__icon" aria-hidden="true">🗓️</div>
          <p>Tidak ada kelas${namaCabang} pada tanggal ini.<br>
             Coba pilih tanggal lain atau ganti filter tipe.</p>
        </div>`;
      return;
    }

    list.innerHTML = items.map(classCard).join('');

    $$('[data-book]', list).forEach(btn => {
      btn.addEventListener('click', () => openSheet(btn.dataset.book));
    });
  }

  /* ======================================================================
     RENDER VIEW: CABANG
     ====================================================================== */
  const mapsLink = addr =>
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);

  function branchName(id) {
    const b = BRANCH_DETAILS.find(x => x.id === id);
    return b ? b.name : id;
  }

  /** Jumlah sesi terjadwal pada satu cabang (seluruh rentang tanggal). */
  function branchSessionCount(id) {
    return CLASSES.filter(k => k.branchId === id).length;
  }

  function renderBranches() {
    $('#branchList').innerHTML = BRANCH_DETAILS.map((b, i) => {
      const sesi = branchSessionCount(b.id);
      // Nada hero sedikit berbeda antar cabang agar daftar tidak monoton
      const hue = 28 + (i * 9) % 26;

      return `
        <article class="branch-card">

          <div class="branch-card__hero" style="--h:${hue}">
            ${b.flag ? `
              <span class="badge-flag">
                <span class="badge-flag__dot" aria-hidden="true"></span>
                Flagship Studio
              </span>` : ''}

            <div class="branch-card__overlay">
              <span class="pill pill--dark">
                <span aria-hidden="true">◷</span> Buka Hari Ini
                <span class="pill__sep" aria-hidden="true">•</span> ${b.hours}
              </span>
              <span class="pill pill--dark">
                <span aria-hidden="true">➤</span> ${b.distance}
              </span>
            </div>
          </div>

          <div class="branch-card__main">
            <div class="branch-card__head">
              <h3 class="branch-card__name">${b.name}</h3>
              <span class="tag tag--status">${b.status}</span>
            </div>

            <p class="branch-card__addr">
              <span aria-hidden="true">◉</span> ${b.address}
            </p>

            <div class="branch-card__tags">
              ${b.facilities.map(f => `
                <span class="tag tag--facility">
                  <span class="tag__icon" aria-hidden="true">${f.icon}</span>${f.label}
                </span>`).join('')}
            </div>
          </div>

          <div class="branch-card__foot">
            <button class="btn btn--primary" type="button" data-branch-jump="${b.id}">
              <span aria-hidden="true">▤</span>
              Lihat Jadwal (${sesi} Sesi)
            </button>

            <a class="btn-map" href="${mapsLink(b.address)}"
               target="_blank" rel="noopener noreferrer"
               aria-label="Buka ${b.name} di Google Maps">
              <span aria-hidden="true">🗺</span>
            </a>
          </div>
        </article>`;
    }).join('');

    $$('[data-branch-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        applyBranchFilter(btn.dataset.branchJump, true);
        switchView('schedule');
        toast('Menampilkan jadwal ' + branchName(btn.dataset.branchJump));
      });
    });
  }

  /** Terapkan pilihan cabang ke pill baris atas, jam buka, dan daftar kelas. */
  function applyBranchFilter(id, updateSwitcher) {
    state.branch = id;

    if (updateSwitcher) {
      const b = BRANCH_DETAILS.find(x => x.id === id);
      $('#branchName').textContent = b ? b.name : id;
      if (b) $('#openHours').textContent = b.hours;
    }

    renderCalendar();
    renderClasses();
  }

  /* ======================================================================
     RENDER VIEW: PAKET
     ====================================================================== */
  function renderPackages() {
    $('#packageList').innerHTML = PACKAGES.map(p => {
      const pct = Math.round((p.remaining / p.total) * 100);
      const low = p.remaining <= 2;

      return `
        <div class="panel">
          <div class="panel__head">
            <span class="panel__title">${p.name}</span>
            <span class="tag ${low ? 'tag--quota' : 'tag--level'}">
              ${p.remaining}/${p.total} sesi
            </span>
          </div>
          <div class="panel__body">
            <div class="progress">
              <div class="progress__bar ${low ? 'is-low' : ''}" style="width:${pct}%"></div>
            </div>
            <dl style="margin:14px 0 0;">
              <div class="kv"><dt>Berlaku sampai</dt><dd>${p.expires}</dd></div>
              <div class="kv"><dt>Harga paket</dt><dd>${rupiah(p.price)}</dd></div>
              <div class="kv"><dt>Harga per sesi</dt><dd>${rupiah(Math.round(p.price / p.total))}</dd></div>
              <div class="kv"><dt>Sisa sesi</dt><dd>${p.remaining} sesi</dd></div>
            </dl>
          </div>
        </div>`;
    }).join('');

    $('#policyList').innerHTML = POLICIES.map(t => `
      <li style="display:flex; gap:9px; font-size:12px; color:var(--ink-600); line-height:1.55;">
        <span style="color:var(--green-600);" aria-hidden="true">✓</span>
        <span>${t}</span>
      </li>`).join('');
  }

  /* ======================================================================
     RENDER VIEW: RIWAYAT
     ====================================================================== */
  function renderHistory() {
    $('#historyList').innerHTML = HISTORY.map(h => {
      const tone = h.sideType === 'void'
        ? 'style="color:var(--red-700);"'
        : 'style="color:var(--green-700);"';

      return `
        <div class="item">
          <span class="item__icon" aria-hidden="true"
                style="${h.sideType === 'void' ? 'background:var(--red-100);' : ''}">${h.icon}</span>
          <span class="item__body">
            <span class="item__title">${h.title}</span>
            <span class="item__sub">${h.sub}</span>
          </span>
          <span class="item__side" ${tone}>${h.side}</span>
        </div>`;
    }).join('');

    $('#historyCount').textContent = HISTORY.length + ' item';
  }

  /* ======================================================================
     BOTTOM SHEET — 3 LANGKAH
     ====================================================================== */
  const sheet    = $('#bookingSheet');
  const backdrop = $('#backdrop');

  function openSheet(classId) {
    state.klass = CLASSES.find(k => k.id === classId);
    state.step = 1;
    state.payMode = null;
    state.packageId = null;
    state.paymentId = 'qris';

    sheet.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
    });
    renderSheet();
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { sheet.hidden = true; }, 280);
  }

  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) closeSheet();
  });

  function stepsBar() {
    const labels = ['Pilih Paket', 'Data', 'Bayar'];
    return `<div class="steps">${labels.map((l, i) => {
      const n = i + 1;
      const cls = n === state.step ? 'is-active' : n < state.step ? 'is-done' : '';
      return `<div class="step ${cls}">
                <span class="step__dot">${n < state.step ? '✓' : n}</span>
                <span>${l}</span>
              </div>`;
    }).join('')}</div>`;
  }

  /* ---------- Langkah 1: pilih paket ---------- */
  function stepOne() {
    const k = state.klass;
    const full = k.capacity - k.taken === 0;
    const usable = PACKAGES.filter(p => p.remaining > 0);

    const pkgOptions = usable.map(p => `
      <button class="option ${state.payMode === 'package' && state.packageId === p.id ? 'is-selected' : ''}"
              type="button" data-mode="package" data-pkg="${p.id}">
        <span class="option__radio" aria-hidden="true">✓</span>
        <span class="option__body">
          <span class="option__title">Gunakan Kuota Paket Anda</span>
          <span class="option__sub">${p.name} · Sisa ${p.remaining} sesi · Berlaku s.d. ${p.expires}</span>
        </span>
        <span class="option__price">Rp 0</span>
      </button>`).join('');

    const exhausted = PACKAGES.filter(p => p.remaining === 0).map(p => `
      <div class="option is-disabled">
        <span class="option__radio" aria-hidden="true"></span>
        <span class="option__body">
          <span class="option__title">${p.name}</span>
          <span class="option__sub">Kuota habis · Berlaku s.d. ${p.expires}</span>
        </span>
      </div>`).join('');

    const dropIn = `
      <button class="option ${state.payMode === 'dropin' ? 'is-selected' : ''}"
              type="button" data-mode="dropin">
        <span class="option__radio" aria-hidden="true">✓</span>
        <span class="option__body">
          <span class="option__title">Beli Drop-in / Sesi Baru</span>
          <span class="option__sub">Berlaku untuk 1 kelas · QRIS · BCA VA · GoPay · Kartu Kredit</span>
        </span>
        <span class="option__price">${rupiah(DROPIN_PRICE)}</span>
      </button>`;

    const waitlist = full ? `
      <button class="option ${state.payMode === 'waitlist' ? 'is-selected' : ''}"
              type="button" data-mode="waitlist">
        <span class="option__radio" aria-hidden="true">✓</span>
        <span class="option__body">
          <span class="option__title">Masuk Daftar Tunggu</span>
          <span class="option__sub">Kursi akan dilepas otomatis bila ada pembatalan · Bayar di akhir</span>
        </span>
        <span class="option__price">Gratis</span>
      </button>` : '';

    return `
      ${stepsBar()}
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel__head"><span class="panel__title">Kelas Dipilih</span></div>
        <div class="panel__body">
          <div style="font-size:15px;font-weight:600;">${k.name}</div>
          <div style="font-size:12px;color:var(--ink-400);margin-top:3px;">
            ${dayLabel(k.day)} · ${k.start}–${k.end} WIB · ${k.studio}
          </div>
        </div>
      </div>

      <div class="panel__title" style="margin-bottom:10px;">Metode Pemotongan &amp; Bayar</div>
      ${pkgOptions}
      ${exhausted}
      ${dropIn}
      ${waitlist}`;
  }

  /* ---------- Langkah 2: data peserta ---------- */
  function stepTwo() {
    const k = state.klass;
    const pkg = PACKAGES.find(p => p.id === state.packageId);
    const usingPackage = state.payMode === 'package';

    return `
      ${stepsBar()}
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel__head"><span class="panel__title">Data Peserta</span>
          <span class="tag tag--level">Tersimpan</span>
        </div>
        <div class="panel__body">
          <dl style="margin:0;">
            <div class="kv"><dt>Nama lengkap</dt><dd>${CUSTOMER.name}</dd></div>
            <div class="kv"><dt>Email</dt><dd>${CUSTOMER.email}</dd></div>
            <div class="kv"><dt>No. WhatsApp</dt><dd>${CUSTOMER.phone}</dd></div>
          </dl>
        </div>
      </div>

      ${usingPackage ? `
        <div class="summary" style="margin-bottom:16px;">
          <div class="panel__title">Rincian</div>
          <div class="kv" style="border:0; padding-bottom:0;">
            <dt>${pkg.name}</dt><dd>Rp 0</dd>
          </div>
          <div class="kv">
            <dt>Sisa setelah booking</dt>
            <dd>${pkg.remaining - 1} dari ${pkg.total} sesi</dd>
          </div>
          <div class="kv"><dt>Berlaku sampai</dt><dd>${pkg.expires}</dd></div>
        </div>` : `
        <div class="summary" style="margin-bottom:16px;">
          <div class="panel__title">Rincian</div>
          <div class="kv" style="border:0; padding-bottom:0;">
            <dt>Sesi ${k.name}</dt><dd>${rupiah(DROPIN_PRICE)}</dd>
          </div>
          <div class="kv"><dt>Biaya layanan</dt><dd>Rp 0</dd></div>
        </div>`}

      <div class="panel">
        <div class="panel__head"><span class="panel__title">Persiapan &amp; Kebijakan Kelas</span></div>
        <div class="panel__body">
          <ul style="display:grid; gap:9px;">
            ${POLICIES.slice(0, 3).map(t => `
              <li style="display:flex; gap:8px; font-size:12px; color:var(--ink-600);">
                <span style="color:var(--green-600);" aria-hidden="true">•</span><span>${t}</span>
              </li>`).join('')}
          </ul>
        </div>
      </div>`;
  }

  /* ---------- Langkah 3: pembayaran ---------- */
  function stepThree() {
    const k = state.klass;
    const amount = state.payMode === 'dropin' ? DROPIN_PRICE : 0;

    return `
      ${stepsBar()}
      <div class="panel__title" style="margin-bottom:10px;">Pilih Metode Pembayaran</div>
      <div class="pay-grid" style="margin-bottom:16px;">
        ${PAYMENT_METHODS.map(p => `
          <button class="pay ${state.paymentId === p.id ? 'is-selected' : ''}"
                  type="button" data-pay="${p.id}">
            <span class="pay__logo" aria-hidden="true">${p.logo}</span>
            <span>
              <span style="display:block;font-weight:600;">${p.label}</span>
              <span style="display:block;font-size:10px;color:var(--ink-400);">${p.desc}</span>
            </span>
          </button>`).join('')}
      </div>

      <div class="summary">
        <div class="panel__title">Ringkasan Pesanan</div>
        <div class="kv" style="border:0; padding-bottom:0;">
          <dt>${k.name}</dt><dd>${dayLabel(k.day)}</dd>
        </div>
        <div class="kv"><dt>Waktu</dt><dd>${k.start}–${k.end} WIB</dd></div>
        <div class="kv"><dt>Lokasi</dt><dd>${k.branch} · ${k.studio}</dd></div>
        <div class="kv"><dt>Metode</dt><dd>${PAYMENT_METHODS.find(p => p.id === state.paymentId).label}</dd></div>
        <div class="summary__total">
          <span style="font-size:13px;color:var(--ink-600);">Total</span>
          <strong>${amount === 0 ? 'Memotong kuota' : rupiah(amount)}</strong>
        </div>
      </div>`;
  }

  /* ---------- Langkah 4: sukses ---------- */
  function stepSuccess() {
    const k = state.klass;
    const amount = state.payMode === 'dropin' ? DROPIN_PRICE : 0;

    return `
      <div class="success">
        <div class="success__mark" aria-hidden="true">✓</div>
        <h3>Pemesanan Berhasil</h3>
        <p>${state.payMode === 'waitlist'
            ? 'Anda tercatat dalam daftar tunggu. Kami akan memberi tahu bila kursi tersedia.'
            : 'Kursi Anda sudah diamankan. E-ticket telah dikirim ke akun Anda.'}</p>
      </div>

      <div class="ticket">
        <dl style="margin:0;">
          <div class="kv" style="border:0;padding-bottom:0;"><dt>Kode booking</dt><dd><strong>TBP-26014-08</strong></dd></div>
          <div class="kv"><dt>Kelas</dt><dd>${k.name}</dd></div>
          <div class="kv"><dt>Jadwal</dt><dd>${dayLabel(k.day)}, ${k.start} WIB</dd></div>
          <div class="kv"><dt>Lokasi</dt><dd>${k.branch}</dd></div>
          <div class="kv"><dt>Instruktur</dt><dd>${k.instructor}</dd></div>
          <div class="kv"><dt>Total</dt><dd>${amount === 0 ? 'Memotong kuota' : rupiah(amount)}</dd></div>
        </dl>
      </div>`;
  }

  /* ---------- Render sheet ---------- */
  function renderSheet() {
    const k = state.klass;
    $('#sheetSub').textContent =
      `${k.name} · ${dayLabel(k.day)} · ${k.start} WIB`;

    const body = $('#sheetBody');
    const foot = $('#sheetFoot');

    if (state.step === 1) { body.innerHTML = stepOne();  foot.innerHTML = footOne(); }
    if (state.step === 2) { body.innerHTML = stepTwo();  foot.innerHTML = footTwo(); }
    if (state.step === 3) { body.innerHTML = stepThree();foot.innerHTML = footThree(); }
    if (state.step === 4) { body.innerHTML = stepSuccess(); foot.innerHTML = footSuccess(); }

    bindSheet();
    body.scrollTop = 0;
  }

  function footOne() {
    const ready = state.payMode !== null;
    return `<button class="btn btn--primary btn--block" type="button" data-act="next" ${ready ? '' : 'disabled style="opacity:.45;"'}>
              ${state.payMode === 'waitlist' ? 'Lanjut ke Data Peserta' : 'Lanjut'}
              <span aria-hidden="true">→</span>
            </button>`;
  }

  function footTwo() {
    return `<button class="btn btn--ghost btn--block" type="button" data-act="back" style="margin-bottom:8px;">
              Kembali
            </button>
            <button class="btn btn--primary btn--block" type="button" data-act="next">
              Lanjut ke Pembayaran <span aria-hidden="true">→</span>
            </button>`;
  }

  function footThree() {
    return `<button class="btn btn--ghost btn--block" type="button" data-act="back" style="margin-bottom:8px;">
              Kembali
            </button>
            <button class="btn btn--primary btn--block" type="button" data-act="pay">
              ${state.payMode === 'dropin'
                ? 'Bayar ' + rupiah(DROPIN_PRICE)
                : state.payMode === 'waitlist' ? 'Daftar Tunggu' : 'Konfirmasi &amp; Potong Kuota'}
            </button>`;
  }

  function footSuccess() {
    return `<button class="btn btn--primary btn--block" type="button" data-act="close">Selesai</button>`;
  }

  function bindSheet() {
    // Opsi paket / drop-in / waitlist
    $$('#sheetBody [data-mode]').forEach(el => {
      el.addEventListener('click', () => {
        state.payMode = el.dataset.mode;
        state.packageId = el.dataset.pkg || null;
        renderSheet();
      });
    });

    // Metode pembayaran
    $$('#sheetBody [data-pay]').forEach(el => {
      el.addEventListener('click', () => {
        state.paymentId = el.dataset.pay;
        renderSheet();
      });
    });

    // Aksi footer
    $$('#sheetFoot [data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;

        if (act === 'next') {
          if (state.payMode === 'package' && !state.packageId) return;
          state.step++;
          renderSheet();
          return;
        }
        if (act === 'back') { state.step--; renderSheet(); return; }
        if (act === 'close') { closeSheet(); switchView('history'); return; }

        if (act === 'pay') {
          const k = state.klass;

          // Simulasikan verifikasi otomatis + issuance e-ticket
          if (state.payMode === 'package') {
            const p = PACKAGES.find(x => x.id === state.packageId);
            p.remaining -= 1;
            renderPackageCard();
            renderPackages();
          }

          if (state.payMode !== 'waitlist') {
            k.taken += 1;
            if (k.taken > k.capacity) k.taken = k.capacity;
          } else {
            k.waitlist += 1;
          }

          HISTORY.unshift({
            id: 'h' + Date.now(),
            icon: state.payMode === 'waitlist' ? '⋯' : '✓',
            title: k.name,
            sub: `${k.branch} · ${k.start} WIB · ${state.payMode === 'waitlist' ? 'Daftar tunggu' : 'Menunggu hadir'}`,
            side: state.payMode === 'waitlist' ? 'Menunggu' : 'Terjual',
            sideType: state.payMode === 'waitlist' ? 'void' : 'done'
          });

          renderHistory();
          renderClasses();

          state.step = 4;
          renderSheet();

          toast(state.payMode === 'waitlist'
            ? 'Anda masuk daftar tunggu'
            : state.payMode === 'dropin'
              ? 'Pembayaran berhasil — e-ticket diterbitkan'
              : 'Kursi dipesan dari kuota paket');
        }
      });
    });
  }

  /* ======================================================================
     AUTH — gerbang sebelum masuk ke aplikasi
     ====================================================================== */
  const authScreen = $('#authScreen');
  const appShell   = $('#appShell');
  const KEY        = 'tbp.auth';
  const KEY_USER   = 'tbp.user';

  const formLogin    = $('#formLogin');
  const formRegister = $('#formRegister');

  /* ---------- Perpindahan form (dipicu link silang) ---------- */
  function setAuthForm(which) {
    const isReg = which === 'register';

    formLogin.hidden = isReg;
    formRegister.hidden = !isReg;

    authScreen.scrollTop = 0;

    const target = isReg ? formRegister : formLogin;
    const first = target.querySelector('input:not([type="checkbox"])');
    if (first) first.focus();
  }

  $$('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => setAuthForm(btn.dataset.goto));
  });

  /* ---------- Penyimpanan sesi ---------- */
  function readSession() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch { return null; }
  }

  function saveSession(user, mode) {
    const data = { user, mode, at: new Date().toISOString() };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      localStorage.setItem(KEY_USER, JSON.stringify(user));
    } catch { /* mode privat — abaikan */ }
    return data;
  }

  function clearSession() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY_USER);
    } catch { /* abaikan */ }
  }

  function signedInUser() {
    try { return JSON.parse(localStorage.getItem(KEY_USER) || 'null'); }
    catch { return null; }
  }

  /** Tampilkan aplikasi atau gerbang auth sesuai status sesi. */
  function gate() {
    const user = signedInUser();

    // ?demo=1 → lewati gerbang auth tanpa menyimpan sesi (dipakai preview.html)
    const forced = new URLSearchParams(location.search).get('demo') === '1';

    if (forced || (user && user.name)) {
      authScreen.hidden = true;
      appShell.hidden = false;
      applyUserToProfile(forced ? { name: CUSTOMER.name, email: CUSTOMER.email,
                                    phone: CUSTOMER.phone, since: CUSTOMER.memberSince } : user);
    } else {
      authScreen.hidden = false;
      appShell.hidden = true;
      document.body.style.overflow = '';
      formLogin.reset();
      formRegister.reset();
      setMeter('');
    }
  }

  /** Terapkan data pengguna yang masuk ke seluruh bagian aplikasi. */
  function applyUserToProfile(user) {
    // Inisial pada avatar kartu profil.
    // Selector harus spesifik: memakai .avatar akan ikut menangkap
    // avatar instruktur pada kartu kelas Jadwal.
    const avatarEl = $('#profileAvatar');
    if (avatarEl) avatarEl.textContent = initials(user.name);

    const nameEl = $('#profileName');
    if (nameEl) nameEl.textContent = user.name;

    const emailEl = $('#profileEmail');
    if (emailEl) emailEl.textContent = user.email || CUSTOMER.email;

    const phoneEl = $('#profilePhone');
    if (phoneEl) phoneEl.textContent = user.phone || CUSTOMER.phone;

    // Tanggal bergabung = hari akun dibuat
    const sinceEl = $('#profileSince');
    if (sinceEl && user.since) sinceEl.textContent = user.since;

    // Nama di sheet pemesanan
    $$('#sheetBody .kv').forEach(row => {
      const dt = row.querySelector('dt');
      const dd = row.querySelector('dd');
      if (!dt || !dd) return;
      if (dt.textContent.trim() === 'Nama lengkap') dd.textContent = user.name;
      if (dt.textContent.trim() === 'Email') dd.textContent = user.email || CUSTOMER.email;
    });

    // Ringkasan pada halaman Paket
    const sub = $('#logoutSub');
    if (sub) sub.textContent = 'Keluar dari ' + user.name;
  }

  /* ---------- Tampilkan / sembunyikan kata sandi ---------- */
  $$('[data-reveal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = $('#' + btn.dataset.reveal);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
      input.focus();
    });
  });

  /* ---------- Validasi ---------- */
  const RE_EMAIL  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_PHONE  = /^(\+?62|0)[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,5}$/;

  function setError(inputId, errId, message) {
    const input = $('#' + inputId);
    const err   = $('#' + errId);
    const field = input.closest('.field');

    err.textContent = message;
    field.classList.toggle('is-invalid', Boolean(message));
    input.setAttribute('aria-invalid', String(Boolean(message)));
    return !message;
  }

  function clearErrors(form) {
    $$('.field__error', form).forEach(p => { p.textContent = ''; });
    $$('.field', form).forEach(f => f.classList.remove('is-invalid'));
  }

  /* ---------- Meter kekuatan kata sandi ---------- */
  function setMeter(value) {
    const meter = document.querySelector('.meter');
    const bar   = $('#passMeter');

    if (!meter || !bar) return;

    // Lebar & warna ditentukan CSS lewat atribut data-level.
    // Inline style harus dikosongkan, kalau tidak ia mengalahkan CSS.
    bar.style.width = '';

    if (!value) {
      meter.removeAttribute('data-level');
      return;
    }

    let score = 0;
    if (value.length >= 6) score++;
    if (value.length >= 10) score++;
    if (/[A-Z]/.test(value) && /\d/.test(value)) score++;
    if (/[^\w\s]/.test(value)) score++;

    meter.dataset.level = score <= 1 ? 'weak' : score === 2 ? 'medium' : 'strong';
  }

  $('#regPass').addEventListener('input', e => setMeter(e.target.value));

  /* ---------- Masuk ---------- */
  formLogin.addEventListener('submit', e => {
    e.preventDefault();
    clearErrors(formLogin);

    const id   = $('#loginId').value.trim();
    const pass = $('#loginPass').value;

    let ok = true;
    const looksEmail = id.includes('@');

    if (!id) {
      ok = setError('loginId', 'errLoginId', 'Email atau nomor WhatsApp wajib diisi.');
    } else if (looksEmail && !RE_EMAIL.test(id)) {
      ok = setError('loginId', 'errLoginId', 'Format email tidak valid.');
    } else if (!looksEmail && !RE_PHONE.test(id.replace(/[\s-]/g, ''))) {
      ok = setError('loginId', 'errLoginId', 'Nomor WhatsApp tidak valid. Contoh: 081234567890');
    }

    if (!pass) {
      ok = setError('loginPass', 'errLoginPass', 'Kata sandi wajib diisi.');
    } else if (pass.length < 6) {
      ok = setError('loginPass', 'errLoginPass', 'Kata sandi minimal 6 karakter.');
    }

    if (!ok) return;

    // Simulasi verifikasi server
    submitWithLoading(e.submitter, 'Memverifikasi…', () => {
      const user = {
        name: looksEmail ? CUSTOMER.name : id,
        email: looksEmail ? id : CUSTOMER.email,
        phone: looksEmail ? CUSTOMER.phone : id
      };
      saveSession(user, 'password');
      gate();
      toast('Selamat datang kembali, ' + user.name.split(' ')[0]);
    });
  });

  /* ---------- Daftar ---------- */
  formRegister.addEventListener('submit', e => {
    e.preventDefault();
    clearErrors(formRegister);

    const name  = $('#regName').value.trim();
    const email = $('#regEmail').value.trim();
    const phone = $('#regPhone').value.trim();
    const pass  = $('#regPass').value;
    const pass2 = $('#regPass2').value;
    const agree = $('#regAgree').checked;

    let ok = true;

    if (!name) {
      ok = setError('regName', 'errRegName', 'Nama lengkap wajib diisi.');
    } else if (name.length < 3) {
      ok = setError('regName', 'errRegName', 'Nama terlalu pendek.');
    }

    if (!email) {
      ok = setError('regEmail', 'errRegEmail', 'Email wajib diisi.');
    } else if (!RE_EMAIL.test(email)) {
      ok = setError('regEmail', 'errRegEmail', 'Format email tidak valid.');
    }

    if (!phone) {
      ok = setError('regPhone', 'errRegPhone', 'No. WhatsApp wajib diisi.');
    } else if (!RE_PHONE.test(phone.replace(/[\s-]/g, ''))) {
      ok = setError('regPhone', 'errRegPhone', 'Nomor tidak valid. Contoh: 081234567890');
    }

    if (!pass) {
      ok = setError('regPass', 'errRegPass', 'Kata sandi wajib diisi.');
    } else if (pass.length < 6) {
      ok = setError('regPass', 'errRegPass', 'Minimal 6 karakter.');
    }

    if (pass2 !== pass) {
      ok = setError('regPass2', 'errRegPass2',
        pass2 ? 'Kata sandi tidak sama.' : 'Ulangi kata sandi.');
    }

    if (!agree) {
      const err = $('#errRegAgree');
      err.textContent = 'Anda harus menyetujui syarat dan ketentuan.';
      ok = false;
    }

    if (!ok) {
      const firstBad = formRegister.querySelector('.field.is-invalid');
      if (firstBad) firstBad.querySelector('input').focus();
      return;
    }

    submitWithLoading(e.submitter, 'Membuat akun…', () => {
      const today = new Date().toLocaleDateString('id-ID',
        { day: 'numeric', month: 'long', year: 'numeric' });
      saveSession({ name, email, phone, since: today }, 'register');
      gate();
      toast('Akun berhasil dibuat. Selamat datang, ' + name.split(' ')[0]);
    });
  });

  /** Tampilkan status memuat pada tombol, lalu jalankan aksi. */
  function submitWithLoading(btn, label, action) {
    const target = btn || $('button[type="submit"]', authScreen);
    const original = target.innerHTML;
    target.disabled = true;
    target.textContent = label;
    setTimeout(() => {
      target.disabled = false;
      target.innerHTML = original;
      action();
    }, 700);
  }

  /* ---------- Masuk sosial ---------- */
  $$('[data-provider]').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider;
      submitWithLoading(btn, 'Menghubungkan…', () => {
        const user = provider === 'Google'
          ? { name: CUSTOMER.name, email: CUSTOMER.email, phone: CUSTOMER.phone }
          : { name: 'Anindya Kirana', email: CUSTOMER.email, phone: CUSTOMER.phone };
        saveSession(user, provider.toLowerCase());
        gate();
        toast('Berhasil masuk dengan ' + provider);
      });
    });
  });

  /* ---------- Lupa kata sandi ---------- */
  $('#forgotLink').addEventListener('click', () => {
    const id = $('#loginId').value.trim();
    toast(id
      ? 'Tautan reset dikirim ke ' + id
      : 'Isi email atau nomor WhatsApp terlebih dahulu');
  });

  /* ---------- Keluar ---------- */
  $('#logoutBtn').addEventListener('click', () => {
    clearSession();
    gate();
    setAuthForm('login');
    toast('Anda telah keluar');
  });

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    renderCalendar();
    renderPackageCard();
    renderClasses();
    renderBranches();
    renderPackages();
    renderHistory();
    gate();
  }

  init();
})();
