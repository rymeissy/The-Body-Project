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
    const d = toDate(key);
    return `${HARI_MINGGU[d.getDay()]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
  };

  /* ---------- State ---------- */
  // Hari yang dibuka dan bulan date picker ikut tanggal sistem, bukan tanggal
  // mati. Menulisnya mati membuat halaman terbuka di tanggal lama begitu
  // aplikasi dipakai esok hari.
  const HARI_INI = toKey(new Date());
  const BULAN_INI = new Date().getMonth();

  // Halaman yang terakhir dibuka disimpan supaya refresh tidak memundulkan
  // pengguna ke Jadwal. switchView() menulisnya setiap kali tab diganti.
  //
  // Kuncinya dihapus saat logout (clearSession), jadi login berikutnya tetap
  // mulai dari Jadwal. Dengan begitu refresh dan relogin bisa dibedakan tanpa
  // flag tambahan: yang membedakan bukan cara aplikasinya dibuka, tapi apakah
  // sesi sebelumnya masih ada.
  const VIEW_AWAL = (() => {
    try { return localStorage.getItem('tbp.view') || 'schedule'; }
    catch { return 'schedule'; }
  })();

  const state = {
    view: VIEW_AWAL,
    day: HARI_INI,

    // Awal jendela strip 7 hari. Dipisah dari day supaya memilih tanggal lain
    // tidak ikut menggeser strip -- kalau tidak, setiap klik membuat tanggal
    // yang dipilih melompat ke kolom pertama dan pengguna kehilangan tempatnya.
    stripFrom: HARI_INI,

    type: 'all',
    branch: 'all',
    instructor: 'all',
    search: '',

    // Bulan yang ditinjau pada date picker
    pickerYear: new Date().getFullYear(),
    pickerMonth: BULAN_INI,

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
    try { localStorage.setItem('tbp.view', name); } catch { /* mode privat */ }

    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
    $$('#tabbar button').forEach(b => {
      const active = b.dataset.view === name;
      active ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    });

    // Bar judul situs hanya milik halaman Jadwal.
    appShell.classList.toggle('has-header', name === 'schedule');

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

  /* Pilih tanggal tanpa menggeser strip. Jendela 7 hari hanya pindah kalau
     tanggal yang dipilih berada di luar jendela -- misalnya pengguna memilih
     lewat date picker ke tanggal jauh. Selama tanggal itu masih kelihatan di
     strip, posisinya dibiarkan. */
  function selectDay(key) {
    state.day = key;

    const dari = toDate(state.stripFrom);
    const akhir = new Date(dari);
    akhir.setDate(akhir.getDate() + STRIP_PANJANG - 1);

    const k = toDate(key);
    if (k < dari || k > akhir) state.stripFrom = key;
  }

  function renderCalendar() {
    const days = stripDays(state.stripFrom);

    $('#calRow').innerHTML = days.map(d => {
      const slots = slotsOn(d.key);
      const selected = d.key === state.day;
      const bisa = isSelectable(d.key);
      const dot = slots > 0
        ? `<span class="cal-day__dot${selected ? ' is-selected' : ''}"
                title="${slots} slot tersedia"></span>`
        : '<span class="cal-day__dot is-empty"></span>';

      return `
        <button class="cal-day" type="button" data-day="${d.key}"
                aria-pressed="${selected}"
                ${bisa ? '' : 'disabled aria-disabled="true"'}>
          <span class="cal-day__name">${d.day}</span>
          <span class="cal-day__num">${d.date}</span>
          ${dot}
        </button>`;
    }).join('');

    $$('#calRow .cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        selectDay(btn.dataset.day);
        renderCalendar();
        renderClasses();
      });
    });
  }

  /* ---------- Kartu paket ---------- */
  function renderPackageCard() {
    const card = $('#pkgCard');

    // Kartu paket memuat data pribadi — sisa sesi milik orang itu sendiri.
    // Belum masuk, tidak ada yang perlu ditampilkan.
    if (!isSignedIn()) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }

    card.hidden = false;

    const p = PACKAGES[0];   // paket aktif
    const pct = Math.round((p.remaining / p.total) * 100);

    card.innerHTML = `
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

  /* ---------- Date picker (kalender bulanan) ---------- */

  /** "2026-10-13" → "13 Oktober 2026" (contoh format, bukan tanggal tetap) */
  function formatTanggalPanjang(key) {
    const d = toDate(key);
    return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
  }

  /** Kunci tanggal "YYYY-MM-DD" dengan offset bulan. */
  function shiftMonth(year, monthIdx, delta) {
    const d = new Date(year, monthIdx + delta, 1);
    return { year: d.getFullYear(), monthIdx: d.getMonth() };
  }

  /** Kunci sel yang sedang ditinjau pada date picker. */
  function openCalendar() {
    // Mulai dari bulan berisi tanggal yang sedang dipilih
    const cur = new Date(state.day + 'T00:00:00');
    state.pickerYear = cur.getFullYear();
    state.pickerMonth = cur.getMonth();

    sheet.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
    });
    renderCalendarSheet();
    document.body.style.overflow = 'hidden';
  }

  function renderCalendarSheet() {
    const y = state.pickerYear;
    const m = state.pickerMonth;

    $('#sheetTitle').textContent = 'Pilih Tanggal';
    $('#sheetSub').textContent = `${NAMA_BULAN[m]} ${y}`;

    // Kunci pertama sel kalender (Minggu = kolom 0)
    const offset = new Date(y, m, 1).getDay();
    const totalHari = new Date(y, m + 1, 0).getDate();

    let cells = HARI_MINGGU.map(h =>
      `<span class="dp__dow" aria-hidden="true">${h}</span>`).join('');

    for (let i = 0; i < offset; i++) cells += '<span class="dp__cell is-blank"></span>';

    for (let d = 1; d <= totalHari; d++) {
      const key = `${y}-${pad(m + 1)}-${pad(d)}`;
      const aktif = isSelectable(key);
      const dipilih = key === state.day;
      const slots = aktif ? slotsOn(key) : 0;
      const kelasAda = CLASSES.some(k => k.day === key);

      const cls = [
        'dp__cell',
        !aktif ? 'is-off' : '',
        dipilih ? 'is-selected' : '',
        aktif && key === CAL_TODAY ? 'is-today' : '',
        aktif && slots > 0 ? 'has-slots' : '',
        aktif && kelasAda && slots === 0 ? 'is-waitlist' : ''
      ].filter(Boolean).join(' ');

      const label = aktif
        ? `${d} ${NAMA_BULAN[m]} ${y}, ${slots} slot tersedia`
        : `${d} ${NAMA_BULAN[m]} ${y}, ${key < CAL_MIN ? 'sudah lewat' : 'di luar batas pemesanan'}`;

      cells += `<button class="${cls}" type="button" data-pick="${key}"
                       ${aktif ? '' : 'disabled aria-disabled="true"'}
                       aria-pressed="${dipilih}" aria-label="${label}">
                  <span class="dp__num">${d}</span>
                  ${aktif && slots > 0 ? '<span class="dp__dot"></span>' : ''}
                </button>`;
    }

    $('#sheetBody').innerHTML = `
      <div class="dp">
        <div class="dp__nav">
          <button class="dp__navbtn" type="button" data-nav="-1"
                  aria-label="Bulan sebelumnya">‹</button>
          <span class="dp__month">${NAMA_BULAN[m]} ${y}</span>
          <button class="dp__navbtn" type="button" data-nav="1"
                  aria-label="Bulan berikutnya">›</button>
        </div>
        <div class="dp__grid">${cells}</div>
        <p class="dp__legend">
          <span><i class="dp__key has-slots"></i>ada slot kosong</span>
          <span><i class="dp__key is-waitlist"></i>penuh / waitlist</span>
          <span><i class="dp__key is-off"></i>sudah lewat</span>
        </p>
        <p class="dp__hint">Pemesanan dibuka hingga ${formatTanggalPanjang(CAL_MAX)}.</p>
      </div>`;

    $('#sheetFoot').innerHTML = `
      <button class="btn btn--ghost btn--block" type="button" data-dp="close">
        Batal
      </button>`;

    $$('[data-nav]', $('#sheetBody')).forEach(btn => {
      btn.addEventListener('click', () => {
        const next = shiftMonth(y, m, Number(btn.dataset.nav));
        state.pickerYear = next.year;
        state.pickerMonth = next.monthIdx;
        renderCalendarSheet();
      });
    });

    // Sembunyikan tombol navigasi bila tidak ada tanggal yang bisa dipilih
    const bulanAdaIsian = (yy, mm) => {
      const akhir = new Date(yy, mm + 1, 0).getDate();
      for (let d = 1; d <= akhir; d++) {
        if (isSelectable(`${yy}-${pad(mm + 1)}-${pad(d)}`)) return true;
      }
      return false;
    };
    const navMundur = $('[data-nav="-1"]');
    const navMaju   = $('[data-nav="1"]');
    navMundur.hidden = !bulanAdaIsian(y, m - 1);
    navMaju.hidden   = !bulanAdaIsian(y, m + 1);

    $$('[data-pick]', $('#sheetBody')).forEach(btn => {
      btn.addEventListener('click', () => {
        selectDay(btn.dataset.pick);
        closeSheet();
        renderCalendar();
        renderClasses();
      });
    });

    $$('[data-dp]', $('#sheetFoot')).forEach(btn => {
      btn.addEventListener('click', () => closeSheet());
    });

    $('#sheetBody').scrollTop = 0;
  }

  $('#calLink').addEventListener('click', openCalendar);

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
          <button class="btn ${full ? 'btn--waitlist' : 'btn--primary'}"
                  type="button" data-book="${k.id}">
            ${full
              ? '<span aria-hidden="true">🔔</span> Gabung Waitlist'
              : 'Book Sesi <span aria-hidden="true">→</span>'}
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
      btn.addEventListener('click', () => {
        // Memesan kelas berarti memakai kuota paket, jadi harus ada akun dulu.
        if (!isSignedIn()) {
          toast('Login dulu untuk memesan kelas');
          return;
        }
        openSheet(btn.dataset.book);
      });
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
          <span class="option__title">Gabung Waitlist</span>
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

    /* Data peserta diambil dari akun yang sedang masuk, bukan dari CUSTOMER
       yang cuma data contoh. Tombol pemesanan sudah menolak membuka sheet
       kalau belum login, jadi di sini praktis selalu ada; penjaganya tetap
       ditulis supaya tidak melempar error kalau aturannya berubah. */
    const peserta = signedInUser();

    return `
      ${stepsBar()}
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel__head"><span class="panel__title">Data Peserta</span>
          <span class="tag tag--level">Tersimpan</span>
        </div>
        <div class="panel__body">
          <dl style="margin:0;">
            <div class="kv"><dt>Nama lengkap</dt><dd>${peserta ? peserta.name : '—'}</dd></div>
            <div class="kv"><dt>Email</dt><dd>${(peserta && peserta.email) || '—'}</dd></div>
            <div class="kv"><dt>No. WhatsApp</dt><dd>${peserta ? formatTelepon(peserta.phone) : '—'}</dd></div>
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
                : state.payMode === 'waitlist' ? 'Gabung Waitlist' : 'Konfirmasi &amp; Potong Kuota'}
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
     Tidak ada pendaftaran. Satu alur saja: nomor WhatsApp → OTP → nama
     (khusus nomor baru) → aplikasi. Server membuatkan akunnya begitu
     kode OTP terverifikasi.
     ====================================================================== */
  const authScreen = $('#authScreen');
  const appShell   = $('#appShell');
  const KEY        = 'tbp.auth';
  const KEY_USER   = 'tbp.user';
  const KEY_TOKEN  = 'tbp.token';

  const formLogin = $('#formLogin');
  const formOtp   = $('#formOtp');
  const formName  = $('#formName');

  const AUTH_FORMS = { login: formLogin, otp: formOtp, name: formName };

  /* ---------- Perpindahan form ---------- */
  let otpTimer   = null;
  let otpPayload = null;             // { phone }

  function setAuthForm(which) {
    const target = AUTH_FORMS[which];
    if (!target) return;

    Object.keys(AUTH_FORMS).forEach(key => { AUTH_FORMS[key].hidden = key !== which; });

    // Ganti layar berarti semua countdown lama tidak berlaku lagi.
    if (which !== 'otp') stopCountdown();

    authScreen.scrollTop = 0;
    const first = target.querySelector('input:not([type="checkbox"])');
    if (first) first.focus();
  }

  $$('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const to = btn.dataset.goto;
      // "Ganti nomor" kembali ke layar awal, dan membatalkan OTP yang jalan.
      if (to === 'back') { otpPayload = null; setAuthForm('login'); return; }
      setAuthForm(to);
    });
  });

  /* ---------- Penyimpanan sesi ---------- */
  function readSession() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch { return null; }
  }

  function saveSession(user, token) {
    const data = { user, token, mode: 'otp', at: new Date().toISOString() };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      localStorage.setItem(KEY_USER, JSON.stringify(user));
      if (token) localStorage.setItem(KEY_TOKEN, token);
    } catch { /* mode privat — abaikan */ }
    return data;
  }

  function clearSession() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY_USER);
      localStorage.removeItem(KEY_TOKEN);
      // Halaman terakhir ikut dihapus: sesi berikutnya adalah sesi baru,
      // jadi harus mulai dari Jadwal, bukan melanjutkan halaman terakhir
      // yang sedang dibuka.
      localStorage.removeItem('tbp.view');
    } catch { /* abaikan */ }

    // WAJIB reset state.view juga, bukan hanya kuncinya di localStorage.
    // state hidup di memori dan bertahan selama tab terbuka. Kalau dibiarkan,
    // gate() akan memanggil switchView(state.view) dengan nilai lama lalu
    // menuliskannya kembali ke localStorage -- sehingga pengguna yang keluar
    // dari Profil lalu login tanpa refresh akan kembali ke Profil.
    state.view = 'schedule';
  }

  function signedInUser() {
    try { return JSON.parse(localStorage.getItem(KEY_USER) || 'null'); }
    catch { return null; }
  }

  /* Mode ?demo=1 purposely leaves localStorage empty — it shows the app without
     a session. So "sudah masuk" means a real session exists, not merely that
     the app shell is visible.

     nameConfirmed wajib, bukan sekadar user.name. Right setelah OTP diverifikasi
     akun sudah ada di database, tapi full_name-nya masih placeholder
     ("Pelanggan 7438") — itu string truthy, sehingga versi lama menganggap
     pengguna sudah masuk dan layar nama dilewati selamanya kalau halaman
     di-refresh di tengah jalan. */
  function isSignedIn() {
    const user = signedInUser();
    return Boolean(user && user.name && user.nameConfirmed);
  }

  /* Sudah punya token tapi nama belum diisi. Ini kondisi antara "belum masuk"
     dan "sudah masuk": akunnya ada, tinggal minta nama. Jangan dipaksa
     mengulang OTP. */
  function awaitingName() {
    const user = signedInUser();
    if (!user || user.nameConfirmed) return false;
    try { return Boolean(localStorage.getItem(KEY_TOKEN)); }
    catch { return false; }
  }

  /** Tampilkan aplikasi atau gerbang auth sesuai status sesi. */
  function gate() {
    const user = signedInUser();

    // ?demo=1 → lewati gerbang auth tanpa menyimpan sesi (dipakai preview.html)
    const forced = new URLSearchParams(location.search).get('demo') === '1';

    if (forced || isSignedIn()) {
      authScreen.hidden = true;
      appShell.hidden = false;
      // Terapkan halaman yang tersimpan ke DOM. Bawaan HTML selalu
      // view-schedule, jadi tanpa ini hasil refresh di halaman lain tidak
      // pernah sampai ke layar meski state.view sudah dipulihkan.
      switchView(state.view);
      // Mode demo sengaja tanpa email, supaya Profil terlihat sama persis
      // dengan akun baru yang belum pernah mengisinya.
      applyUserToProfile(forced ? { name: CUSTOMER.name, email: null,
                                    phone: CUSTOMER.phone, since: CUSTOMER.memberSince } : user);
    } else if (awaitingName()) {
      // Token masih hidup dan akun sudah dibuat — hanya nama yang belum. Kembalikan
      // pengguna ke layar nama, jangan suruh mengulang OTP.
      authScreen.hidden = false;
      appShell.hidden = true;
      document.body.style.overflow = '';
      formLogin.reset();
      formOtp.reset();
      stopCountdown();
      otpPayload = null;
      $('#otpDemo').hidden = true;
      $('#namePhone').textContent = user.phone;
      $('#fullName').value = '';
      setAuthForm('name');
    } else {
      authScreen.hidden = false;
      appShell.hidden = true;
      document.body.style.overflow = '';
      formLogin.reset();
      formOtp.reset();
      formName.reset();
      stopCountdown();
      otpPayload = null;
      $('#otpDemo').hidden = true;
      setAuthForm('login');
    }

    // Di luar cabang if/else: kartu paket dan halaman profil sama-sama
    // bergantung pada sesi, jadi keduanya dihitung ulang setiap kali
    // status masuk berubah — bukan hanya saat masuk. Bar judul juga, karena
    // init() tidak lewat switchView().
    renderPackageCard();
    applyProfileSessionState(isSignedIn());
    appShell.classList.toggle('has-header', state.view === 'schedule');
  }

  /** Tampilkan layar masuk tanpa sempat menutup sesi. */
  function showAuthGate() {
    appShell.hidden = true;
    authScreen.hidden = false;
    document.body.style.overflow = '';
    formLogin.reset();
    setAuthForm('login');
    renderPackageCard();
    applyProfileSessionState(false);
  }

  $('#guestSignInBtn').addEventListener('click', showAuthGate);

  /* Halaman Profil punya dua wajah. Belum masuk tidak ada apa pun yang boleh
     tampil: nomor, tanggal bergabung, dan jumlah paket semuanya data pribadi.
     Yang tetap boleh: tombol Hubungi admin, karena itu cuma tautan ke studio
     dan tidak butuh akun. */
  function applyProfileSessionState(signedIn) {
    $$('#view-profile [data-needs-login]').forEach(el => { el.hidden = !signedIn; });
    $('#profileGuest').hidden = signedIn;
    $('#profileTitle').textContent = signedIn ? 'Profil Saya' : 'Profil';
    $('#profileSubtitle').textContent = signedIn
      ? 'Akun & status keanggotaan'
      : 'Login untuk melihat data kamu';
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

    // Email tidak pernah diisi otomatis. Kalau kosong, katakan begitu —
    // menampilkan alamatdefault akan menyesatkan.
    const emailEl = $('#profileEmail');
    if (emailEl) {
      const ada = Boolean(user.email);
      emailEl.textContent = ada ? user.email : 'Email belum diisi';
      emailEl.classList.toggle('profile-email--empty', !ada);
    }

    const phoneEl = $('#profilePhone');
    if (phoneEl) phoneEl.textContent = formatTelepon(user.phone || CUSTOMER.phone);

    // Tanggal bergabung = hari akun dibuat
    const sinceEl = $('#profileSince');
    if (sinceEl && user.since) sinceEl.textContent = user.since;

    // Nama di sheet pemesanan
    $$('#sheetBody .kv').forEach(row => {
      const dt = row.querySelector('dt');
      const dd = row.querySelector('dd');
      if (!dt || !dd) return;
      if (dt.textContent.trim() === 'Nama lengkap') dd.textContent = user.name;
      if (dt.textContent.trim() === 'Email') {
        dd.textContent = user.email || '—';
      }
    });
  }

/* ---------- Validasi ---------- */
  const RE_PHONE = /^628[0-9]{10}$/;
  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

  /** Buang spasi dan tanda hubung supaya validasi tidak repot-repot soal spasi. */
  const digits = value => value.replace(/[\s\-().]/g, '');

  /* Normalisasi ke bentuk yang sama seperti di serve.js, lalu uji dengan
     aturan yang sama juga. Kalau aturannya berbeda di sini dan di sana, user
     bisa lolos dari validasi lalu kena error database yang tidak enak dibaca. */
  function toE164(raw) {
    let d = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

    if (d.startsWith('+62') || d.startsWith('62')) d = '62' + d.replace(/^\+?62/, '');
    else if (d.startsWith('0')) d = '62' + d.slice(1);
    else d = '62' + d;

    return RE_PHONE.test(d) ? d : null;
  }

  function checkPhone(inputId, errId, label) {
    const raw = digits($('#' + inputId).value);
    if (!raw) return setError(inputId, errId, label + ' wajib diisi.');

    if (!toE164(raw)) return setError(inputId, errId,
      'Nomor tidak valid. Contoh: 0812-3456-7890');
    return true;
  }

  /* ---------- Panggil API ----------
     token diisi untuk endpoint yang butuh sesi, yaitu /api/auth/profile. */
  async function api(path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    } catch {
      throw new Error('Tidak bisa menghubungi server. Pastikan "node serve.js" sedang berjalan.');
    }

    let data = {};
    try { data = await res.json(); } catch { /* respons non-JSON */ }

    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan (' + res.status + ')');
    return data;
  }

  /** Tampilkan status memuat pada tombol selama promise berjalan. */
  async function withLoading(btn, label, action) {
    const target = btn || $('button[type="submit"]', authScreen);
    const original = target.textContent;
    target.disabled = true;
    target.textContent = label;

    try {
      await action();
    } finally {
      target.disabled = false;
      target.textContent = original;
    }
  }

  /* ---------- Countdown & kirim ulang ---------- */
  function stopCountdown() {
    if (otpTimer) { clearInterval(otpTimer); otpTimer = null; }
    const resend = $('#otpResend');
    if (resend) resend.disabled = true;
  }

  function startCountdown(seconds) {
    stopCountdown();

    let left = seconds;
    const resend = $('#otpResend');
    const label  = $('#otpCountdown');

    // Kirim ulang harus dinonaktifkan di sisi klien juga, supaya kode tidak
    // terkirim terlalu sering walau tombol sudah disabled.
    resend.disabled = true;

    const tick = () => {
      const m = Math.floor(left / 60);
      const s = left % 60;
      label.textContent = 'Berlaku ' + m + ':' + String(s).padStart(2, '0');

      if (left <= 0) {
        clearInterval(otpTimer);
        otpTimer = null;
        resend.disabled = false;
        label.textContent = 'Kode kadaluarsa';
        return;
      }
      left -= 1;
    };

    tick();
    otpTimer = setInterval(tick, 1000);
  }

  /* ---------- Login: nomor → OTP ---------- */
  formLogin.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(formLogin);

    if (!checkPhone('loginPhone', 'errLoginPhone', 'No. WhatsApp')) return;

    const phone = toE164(digits($('#loginPhone').value));

    await withLoading(e.submitter, 'Mengirim kode…', async () => {
      try {
        const res = await api('/api/auth/otp/request', { phone });
        showOtpScreen({ phone }, res);
      } catch (err) {
        setError('loginPhone', 'errLoginPhone', err.message);
      }
    });
  });

  /* ---------- Tampilkan layar OTP ---------- */
  function showOtpScreen(payload, res) {
    otpPayload = payload;

    $('#otpPhone').textContent = res.phone || payload.phone;
    $('#otpCode').value = '';
    $('#errOtpCode').textContent = '';
    $('#otpCode').closest('.field').classList.remove('is-invalid');

    const demo = $('#otpDemo');
    if (res.demo && res.demo.code) {
      $('#otpDemoCode').textContent = res.demo.code;
      demo.hidden = false;
    } else {
      demo.hidden = true;
    }

    setAuthForm('otp');
    startCountdown(res.ttl || 300);
  }

  /* ---------- Verifikasi OTP ---------- */
  formOtp.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(formOtp);

    const code = $('#otpCode').value.replace(/\D/g, '');

    if (!code) {
      setError('otpCode', 'errOtpCode', 'Kode OTP wajib diisi.');
      return;
    }
    if (code.length !== 6) {
      setError('otpCode', 'errOtpCode', 'Kode OTP terdiri dari 6 angka.');
      return;
    }
    if (!otpPayload) {
      setError('otpCode', 'errOtpCode', 'Minta kode OTP dulu.');
      return;
    }

    await withLoading(e.submitter, 'Memverifikasi…', async () => {
      try {
        const res = await api('/api/auth/otp/verify',
          Object.assign({}, otpPayload, { code }));

        // Token disimpan dulu supaya layar nama bisa mengirim profil.
        saveSession(res.user, res.token);
        stopCountdown();
        otpPayload = null;

        // Nomor baru belum punya nama asli — minta sekali, lalu selesai.
        if (res.needsName) {
          $('#namePhone').textContent = res.user.phone;
          $('#fullName').value = '';
          setAuthForm('name');
          return;
        }

        gate();
        toast('Selamat datang kembali, ' + res.user.name.split(' ')[0]);
      } catch (err) {
        setError('otpCode', 'errOtpCode', err.message);
      }
    });
  });

  /* ---------- Nama lengkap (sekali saja) ---------- */
  formName.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(formName);

    const name = $('#fullName').value.trim();

    if (!name) {
      setError('fullName', 'errFullName', 'Nama lengkap wajib diisi.');
      return;
    }
    if (name.length < 3) {
      setError('fullName', 'errFullName', 'Nama terlalu pendek.');
      return;
    }

    const token = localStorage.getItem(KEY_TOKEN);
    if (!token) {
      clearSession();
      gate();
      return;
    }

    await withLoading(e.submitter, 'Menyimpan…', async () => {
      try {
        const res = await api('/api/auth/profile', { name }, token);
        saveSession(res.user, token);
        gate();
        toast('Selamat datang, ' + res.user.name.split(' ')[0]);
      } catch (err) {
        setError('fullName', 'errFullName', err.message);
      }
    });
  });

  /* ---------- Kirim ulang ---------- */
  $('#otpResend').addEventListener('click', async function () {
    if (!otpPayload) return;

    this.disabled = true;
    try {
      const res = await api('/api/auth/otp/request', { phone: otpPayload.phone });

      showOtpScreen(otpPayload, res);
      toast('Kode baru telah dikirim');
    } catch (err) {
      // Server menolak karena jeda belum habis — hitung ulang sisasannya.
      const wait = parseInt((err.message.match(/\d+/) || [0])[0], 10);
      startCountdown(wait || 60);
      toast(err.message);
    }
  });

  /* ---------- Input OTP: hanya angka, lengkap otomatis ---------- */
  $('#otpCode').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  /* ---------- Keluar ---------- */
  $('#logoutBtn').addEventListener('click', () => {
    clearSession();
    gate();
    toast('Anda telah keluar');
  });

  /* ======================================================================
     UBAH DATA PROFIL — ikon pensil di kartu Profil
     ====================================================================== */
  const profileSheet = $('#profileSheet');

  function openProfileSheet() {
    const user = signedInUser() || {};

    $('#editName').value  = user.name || '';
    $('#editEmail').value = user.email || '';
    // Nomor dikunci jadi tidak bisa diubah, tapi tetap ditata supaya bentuknya
  // sama dengan yang tampil di Profil.
  $('#editPhone').value = formatTelepon(user.phone);

    // Buka ulang harus bersih: pesan dan border merah dari percobaan sebelumnya
    // tidak boleh ikut terbawa.
    ['errEditName', 'errEditEmail'].forEach(id => {
      $('#' + id).textContent = '';
      $('#' + id).previousElementSibling.classList.remove('is-invalid');
    });

    profileSheet.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      profileSheet.classList.add('is-open');
    });
    document.body.style.overflow = 'hidden';
    $('#editName').focus();
  }

  function closeProfileSheet() {
    backdrop.classList.remove('is-open');
    profileSheet.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { profileSheet.hidden = true; }, 280);
  }

  $('#editProfileBtn').addEventListener('click', openProfileSheet);
  $('#editCancelBtn').addEventListener('click', closeProfileSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && profileSheet.classList.contains('is-open')) closeProfileSheet();
  });

  $('#editSaveBtn').addEventListener('click', async function () {
    const name  = $('#editName').value.trim();
    const email = $('#editEmail').value.trim();

    let ok = true;
    if (!name) {
      ok = setError('editName', 'errEditName', 'Nama lengkap wajib diisi.');
    } else if (name.length < 3) {
      ok = setError('editName', 'errEditName', 'Nama terlalu pendek.');
    }

    // Email boleh kosong, tapi kalau diisi harus benar.
    if (email && !RE_EMAIL.test(email)) {
      ok = setError('editEmail', 'errEditEmail', 'Format email tidak valid.');
    }

    if (!ok) return;

    const token = localStorage.getItem(KEY_TOKEN);
    if (!token) { clearSession(); gate(); return; }

    const btn = this;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';

    try {
      // Email selalu ikut dikirim, termasuk string kosong, supaya pengguna
      // bisa menghapus email yang pernah diisi.
      const res = await api('/api/auth/profile', { name, email }, token);
      saveSession(res.user, token);
      applyUserToProfile(res.user);
      closeProfileSheet();
      toast('Data profil diperbarui');
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
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
