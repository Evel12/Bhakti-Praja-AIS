# EXAMNIA liquid motion

Status: **fase 3 — reusable primitives siap review**, 27 Oktober 2026. Penerapan ke komponen utama, profiling penuh, dan panel tuning global menunggu fase berikutnya.

## Satu sumber nilai

`src/motion/tokens.css` adalah sumber tunggal nilai. File ini diimpor oleh stylesheet utama. `src/motion/tokens.js` membaca computed properties dan menghasilkan snapshot immutable; tidak menyimpan salinan angka default di JavaScript.

CSS cubic-bezier adalah fallback, bukan simulasi pegas. Primitive pada fase 3 akan memakai preset fisika JS berikut dari snapshot CSS:

| Preset | Stiffness | Damping | Mass | Pemakaian yang dituju                           |
| ------ | --------: | ------: | ---: | ----------------------------------------------- |
| snappy |       420 |      34 |    1 | Press release, navigasi, selection              |
| smooth |       260 |      30 |    1 | Panels, popovers, dialog, layout                |
| bouncy |       280 |      22 |    1 | Aksen sukses terbatas; bukan default seluruh UI |
| gentle |       160 |      26 |  1.2 | Reveal dan respons dekoratif ringan             |

Durasi fallback: fast 160 ms, base 240 ms, slow 360 ms, fade 120 ms. Durasi spring dibatasi 1600 ms; cap bukan durasi paksa. Stagger 40 ms per item dengan cap 200 ms. Squash awal: X 1.025, Y 0.955. Overshoot limit 0.08 adalah rasio amplitudo gerak untuk primitive mendatang, bukan persentase viewport.

Token mencakup easing, durasi, stagger, scale, jarak pixel, toleransi settle, concurrency, dan capability flags. Angka dokumentasi ini menjelaskan default; edit nilai implementasi hanya di tokens.css.

## API untuk fase primitive

```js
import {
  readMotionTokens,
  resolveMotionProfile,
  getStaggerDelay,
} from "./motion/tokens.js";

const tokens = readMotionTokens(element); // setelah mount dan stylesheet termuat
const profile = resolveMotionProfile("snappy", tokens);
const delay = getStaggerDelay(index, tokens);
// profile.kind: 'spring', 'fade', atau 'off'.
// Adapter primitive harus mematuhi kind dan allowedProperties.
```

`SPRING_PRESETS` mengekspor pemetaan nama preset ke CSS properties. `readSpringPresets(element)` mengembalikan nilai numeriknya. Durasi dibaca sebagai milidetik, jarak sebagai pixel, scale tanpa unit. Pembaca mendukung ms/s dan pixel absolut; jangan gunakan rem/calc untuk token jarak JS.

Satu snapshot melakukan satu panggilan getComputedStyle. Ambil sebelum satu interaction/batch, jangan pada setiap animation frame. Baca ulang pada interaksi baru, perubahan preferensi, breakpoint, atau tuning. Modul aman diimpor tanpa DOM; pembacaan sebelum mount atau token invalid menghasilkan MotionTokenError. Primitive mendatang harus menangkap error, melewati animasi, dan tetap menjalankan aksi pengguna.

## Reduced motion, touch, dan opt-out

- Media query `prefers-reduced-motion: reduce` mengaktifkan mode reduced, menetralkan squash/scale/jarak/stagger/overshoot, dan menonaktifkan hover serta gooey.
- Resolver mengganti semua preset spring menjadi fade 120 ms dengan **opacity saja**. Tidak mengembalikan parameter spring pada mode ini.
- `data-motion="off"` berlaku pada elemen dan subtree, termasuk pseudo-elements. Resolver menghasilkan mode off dengan durasi nol. CSS mematikan transition/animation tanpa mereset static transform atau focus outline.
- Pada layar di bawah 1024 px atau pointer coarse/tanpa hover, budget animasi turun dari 8 ke 3; magnetic/hover dan gooey dimatikan. Penegakan budget runtime dikerjakan bersama primitive/scheduler pada fase berikutnya.
- Belum ada listener, loop RAF, observer, atau will-change permanen dalam fondasi ini.

## Do / don't

- Gunakan preset bernama dan token; jangan hardcode durasi, easing, stiffness, atau damping dalam komponen.
- Animasikan hanya transform, opacity, filter. Jangan tween width, height, top, left, grid-template-columns, border-radius, atau SVG path d.
- Shape morph memakai layer bentuk tetap yang ditransformasi/crossfade; logo, teks, dan hitbox tetap stabil.
- Pertahankan focus-visible, Escape, inert, aria state, dan fokus dialog/drawer.
- Timer ujian, autosave, dan submission harus tetap independen dari penyelesaian animasi.
- Jangan gunakan bouncy pada semua sibling. Bouncy hanya untuk aksen sukses yang memiliki alasan.
- Gooey dibatasi maksimal dua momen dekoratif yang direncanakan: overview dashboard dan receipt sukses; tidak menutupi soal/input.
- Hover tombol selalu diam: tidak ada magnetic pull, lift, atau scale saat hover. Input, touch, disabled control, dan teks panjang juga tidak memakai magnetic hover. Primitive magnetic hanya opt-in untuk objek dekoratif non-tombol.

## Cakupan fase dan pemeriksaan

Fase 2 menambahkan tokens, reader, policy resolver, opt-out, dan tes. Fase 3 menambahkan engine/primitives dan halaman review Motion Lab. Fase 4 menerapkan atoms dan fase 5 menerapkan containers/daftar pada halaman assessment utama. Toast dan aturan sidebar lama menunggu batch overlays/navigasi. Fade reduced-motion pada primitive berjalan lewat JS, sehingga tidak bergantung pada CSS animation yang dimatikan oleh aturan reduced-motion lama.

Batch berikutnya setelah review fase 5: overlays; navigation; media/loaders; page transitions/backgrounds; performance/accessibility dan tuning dev-only. Setiap fase berhenti untuk review. Peringatan dev/lint untuk hardcoded transitions dan panel tuning global belum dipasang.

Uji tokens memeriksa sumber CSS, override dinamis, satu style read, immutable presets, fade-only reduced motion, subtree opt-out, mobile flags, stagger cap, nilai invalid, dan import tanpa DOM. Tes ini belum merupakan pengukuran 60 fps atau visual QA seluruh primitive.

Referensi platform: [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) dan [getComputedStyle](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle).

## Hasil verifikasi fase 2

27 Oktober 2026: 25 tes lulus (17 regresi + 8 tes fondasi motion), build produksi berhasil. Browser pada build produksi memuat token desktop dan mobile dengan benar: budget 8/3, hover/gooey nonaktif pada lebar 390 px, tanpa error console atau overflow dashboard. Serialisasi hasil build seperti `.24s`, `0s`, dan `0px` sesuai format parser. Reduced-motion dan subtree opt-out diuji pada policy dan deklarasi stylesheet; preferensi reduced-motion sistem operasi belum diuji secara visual di browser sesi ini.

## Primitive fase 3

Buka `#/motion-lab` untuk review. Halaman di-load secara lazy dan tidak menambah menu pada alur pengajar/peserta. Mode review, pilihan preset, dan daftar contoh tidak menulis data assessment. Pilihan Reduced hanya mengurangi gerak; tidak dapat menonaktifkan preferensi reduced-motion OS. Counter klik adalah indikator aksi pengguna, bukan timer animasi.

| Primitive / API                        | Opsi utama                                            | Perilaku dan fallback                                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| createMotionScope(root, options)       | selector, preset, press/hover/magnetic/ripple, engine | Event delegation meliputi kontrol baru. Pointermove dibatasi satu update per frame; keyboard tidak dicegah. Off tidak diberi efek.                                      |
| MotionButton                           | variant, type, disabled, attrs/events                 | Hitbox dan focus ring berada pada button tetap; hanya visual surface di dalamnya yang bergerak.                                                                         |
| pointerRipple(surface, event, options) | tokens, engine                                        | Origin dari pointer, dimensi ditempatkan sekali. Reduced memakai overlay fade tanpa ekspansi. Node dibuang setelah selesai/cancel.                                      |
| animatePresence / MotionPresence       | direction, preset, index, appear                      | Enter/exit spring, stagger dari token, done hook selalu diselesaikan saat cancel. Reduced hanya opacity.                                                                |
| MotionShape                            | active, preset                                        | Crossfade/scale dua layer dengan border-radius tetap. Bukan interpolasi radius/path. Teks dan hitbox tidak dimorph.                                                     |
| LiquidGoo                              | active                                                | feGaussianBlur + feColorMatrix dari token. Filter hanya pada dua blob dekoratif. Mobile/reduced/off memakai bentuk statis/gradient tanpa filter. Tidak ada idle loop.   |
| flipLayout(elements, update, options)  | preset, tokens, signal, engine                        | Before/after geometry dibaca dalam batch; update tepat sekali; animasi translate saja. Reduced menggunakan fade; cleanup lewat AbortSignal.                             |
| observeReveals(root, options)          | selector, once, preset, engine                        | IntersectionObserver; konten tidak disembunyikan jika API gagal/tidak ada. Fokus membuka panel segera; callback stale tidak menyembunyikannya lagi.                     |
| transitionRoute(update, options)       | target wajib, preset, native, signal, engine          | View Transitions API dengan fallback enter/fade. Snapshot error tidak mengulang update. Error update asli tetap diteruskan. Belum dipasang sebagai router guard global. |

```js
const scope = createMotionScope(container);
// ...kontrol di dalam scope otomatis memakai interaksi yang sama.
scope.dispose(); // saat unmount

const handle = animatePresence(panel, { preset: "smooth", index });
await handle.finished; // selalu settle: finished / cancelled / skipped

await flipLayout(
  items,
  async () => {
    reorderItems();
    await nextTick();
  },
  { signal: abortController.signal },
);
```

### Engine dan lifecycle

`engine.js` memakai satu scheduler RAF dan solusi analitik damped oscillator dari `spring.js`. Retarget menggunakan posisi serta velocity frame terakhir. Frame yang terlambat dihitung dari waktu absolut, bukan Euler integration. Durasi/koefisien tetap berasal dari tokens. `--motion-frame-step` hanya mengatur sampling spring untuk snapshot native; scheduler biasa mengikuti RAF layar.

Engine hanya menerima pose x/y/scaleX/scaleY/rotate/opacity/blur dan menulis transform/opacity/filter. Width/height/left/top pada ripple diposisikan sekali, tidak ditween. Will-change ditambahkan hanya ketika job aktif dan dipulihkan setelah finish/cancel. Wrapper visual tidak boleh menjadi penentu hitbox/layout. `retain:true` dipakai untuk state hover/shape yang menetap; pemiliknya wajib memanggil `engine.reset(element)` saat cleanup.

Budget global berasal dari token 8 desktop/3 mobile. Job berlebih langsung mencapai state akhir agar konten tidak tertinggal invisible. Dua snapshot native juga mereservasi budget yang sama. RAF berhenti saat tidak ada job. Exit dan enter snapshot normal sama-sama disampling dari spring; reduced memakai durasi/easing fade token. Interpolasi native hanya menghubungkan sampel fisika.

Policy observer menanggapi reduced-motion, breakpoint/pointer, data-motion pada ancestor, dan visibility halaman. Cancel selalu menyelesaikan promise, memulihkan inline style, dan melepas will-change. Scope/komponen membersihkan listener, MutationObserver, IntersectionObserver, pointer RAF, ripple nodes, dan animasi pada unmount. Fallback tidak boleh menunda atau mengulang business action.

CSS View Transitions menonaktifkan interpolasi ukuran default dari browser. `view-transition-name` serta atribut scope dipulihkan. Transform snapshot/opacity saja yang digerakkan; route transaction tetap dijalankan saat animasi dilewati.

### File fase 3

| Kelompok         | File                                                                                                                     | Perubahan                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Fisika/scheduler | src/motion/spring.js, src/motion/engine.js                                                                               | Analytic spring, retarget, cap global, promise/cancel, transient will-change. |
| Policy/token     | src/motion/policy.js, src/motion/tokens.css, src/motion/tokens.js                                                        | Observer preferensi/ancestor, token efek tambahan dan validasinya.            |
| Primitive        | src/motion/interactions.js, src/motion/presence.js, src/motion/layout.js, src/motion/reveal.js, src/motion/route.js      | Sembilan primitive visual/interaksi beserta fallback.                         |
| Vue/lifecycle    | src/motion/useMotionScope.js; src/components/motion/MotionButton.vue, MotionPresence.vue, MotionShape.vue, LiquidGoo.vue | Wrapper dan cleanup reusable.                                                 |
| Styling          | src/motion/primitives.css, src/styles/main.css                                                                           | Gaya wrapper/lab dan snapshot scoped; import stylesheet.                      |
| Review           | src/views/MotionLabView.vue, src/router/index.js                                                                         | Route lazy /motion-lab dan tujuh area demo.                                   |
| Tes              | tests/components/motion-fixture.js, motion-engine.test.js, motion-primitives.test.js                                     | Fixture dari CSS canonical; physics, budget, a11y, cleanup, native/fallback.  |
| Dokumentasi      | MOTION.md                                                                                                                | API, cara review, hasil dan batas fase.                                       |

### Verifikasi dan batas fase 3

46 tes lulus (25 sebelumnya + 21 baru), termasuk solusi under/critical/overdamped, retarget, cap dengan native reservations, DOM removal, fade-only/off, pointer/keyboard, magnetic hitbox, reveal fokus, error navigasi, dan cleanup. Browser memverifikasi klik pointer/Enter, toggle cepat, stagger/FLIP, shape, blob, native View Transitions dan fallback, reduced/off, serta reveal fokus. Pada 360/390/768/1024/1440 px tidak ditemukan overflow; di ponsel filter gooey bernilai none dan budget 3. Setelah settle, tidak ada will-change tertinggal; tidak ada error console dalam alur uji.

Belum dilakukan klaim pengukuran 60 fps pada perangkat low-end atau audit aksesibilitas menyeluruh. Preferensi reduced OS diuji lewat policy/media fixture; mode review reduced diverifikasi di browser. Tahap performance akhir masih perlu profiling perangkat nyata, degradasi low-end, guard hardcoded transitions, dan tuning dev-only global. Primitive belum dipasang massal ke halaman assessment.

Referensi: [startViewTransition](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition), [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate), [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

## Penerapan fase 4 · Interactive atoms

Tombol tidak mengikuti kursor. Default `createMotionScope` kini `hover:false` dan `magnetic:false`; hover tidak mengubah transform, membaca bounding rect, atau menjadwalkan RAF. Squash hanya saat pointer/Enter/Space ditekan, lalu kembali dengan preset `snappy`. Ripple memakai opacity dari token, bukan nilai awal penuh. Magnetic primitive tetap tersedia sebagai opt-in untuk objek dekoratif non-tombol.

`createAtomMotionScope` dipasang sekali pada app dan memakai event delegation. Tombol/link baru, kontrol pada dialog, serta halaman teacher/student otomatis tercakup tanpa listener per komponen. Tombol native tetap native: type submit, disabled, click, RouterLink, download, fokus, dan form validation tidak diambil alih atau ditunda. Button-like link memakai press/ripple; text link hanya opacity dan Enter, sehingga Space tetap menggulir halaman. Tombol existing memakai transform pada kontrolnya saat press (layout tidak berubah); MotionButton menyediakan inner surface jika hitbox press perlu benar-benar tetap.

`MotionField` membungkus 20 deklarasi input/select/textarea di pencarian, role switch, builder, editor soal, pengaturan jadwal, dan penilaian. Hanya opacity ring dekoratif yang digerakkan dengan preset `gentle`; input, teks, caret, native date/select popup, dan layout tidak digerakkan. Ring `aria-hidden`/pointer-events none; outline native focus-visible tetap 3 px. Checkbox/radio mempertahankan indikator, label, dan interaksi native.

```vue
<MotionField>
  <input v-model="title" class="input" required />
</MotionField>
<button class="btn primary" type="submit">Simpan</button>
```

Untuk input baru gunakan wrapper ini; tidak perlu handler motion. Untuk satu subtree gunakan `data-motion="off"`. Reduced motion hanya opacity, termasuk ripple tanpa ekspansi. CSS tidak menambah transition baru. Native input/keyboard tidak pernah di-preventDefault oleh motion.

Navigasi/sidebar, tabs, nomor soal, step navigation, dan Motion Lab dikecualikan dari scope atoms agar batch berikutnya tidak berubah lebih dulu atau mendapat efek ganda. Lab memakai scope sendiri dengan default hover diam yang sama. Container, overlay, route transition global, media, dan gooey baru belum diterapkan pada fase ini. Tidak ada efek blob tambahan.

Lifecycle mencakup pointerup di luar tombol, pointercancel, blur, kontrol yang dihapus/dinonaktifkan, perubahan policy, tab tersembunyi, dan unmount. Ripple dibuang, style/will-change dipulihkan, listener dan observer dilepas. Ring aktif tidak memulai animasi ulang ketika tab tersembunyi. Semua efek memakai budget engine bersama (8 desktop/3 mobile), tanpa mengunci aksi saat budget habis.

### File yang diubah pada fase 4

| File                                         | Perubahan                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| src/App.vue                                  | Memasang/melepas satu scope atoms untuk aplikasi.                                                     |
| src/motion/atoms.js                          | Delegasi native button/link dan fokus ring, pengecualian batch, cleanup.                              |
| src/motion/interactions.js                   | Default hover diam, opsi per kontrol/filter/spatialPress, Enter link, disabled cleanup, token ripple. |
| src/motion/primitives.css                    | Surface ripple dan ring dekoratif tanpa mengubah layout/hit testing input.                            |
| src/components/motion/MotionField.vue        | Wrapper fokus reusable; konten tetap dimiliki Vue.                                                    |
| src/layouts/AppShell.vue                     | Wrapper select peran.                                                                                 |
| src/components/assessment/IdentityStep.vue   | Wrapper judul, jenis, mata kuliah, kelas, deskripsi.                                                  |
| src/components/assessment/ContentStep.vue    | Wrapper instruksi.                                                                                    |
| src/components/assessment/SettingsStep.vue   | Wrapper tanggal, durasi, rilis nilai.                                                                 |
| src/components/assessment/QuestionEditor.vue | Wrapper pertanyaan, opsi, poin, pembahasan.                                                           |
| src/views/teacher/AssessmentListView.vue     | Wrapper pencarian assessment.                                                                         |
| src/views/teacher/QuestionBankView.vue       | Wrapper pencarian dan mata kuliah dalam dialog.                                                       |
| src/views/teacher/AssignmentGradeView.vue    | Wrapper nilai dan umpan balik.                                                                        |
| src/views/MotionLabView.vue                  | Scope lokal dan teks review hover diam/fase 4.                                                        |
| tests/components/motion-atoms.test.js        | Sepuluh tes integrasi atoms/lifecycle/semantik native.                                                |
| tests/components/motion-primitives.test.js   | Magnetic opt-in diuji pada dekorasi non-tombol.                                                       |
| MOTION.md                                    | Pedoman, file, hasil dan batas fase 4.                                                                |

### Verifikasi fase 4

27 Oktober 2026: 56 tes lulus (46 regresi + 10 baru), build produksi berhasil. Tes memastikan hover tombol tidak mengubah transform, membaca geometry atau membuat RAF; kontrol dinamis; press/release di luar; form submit tepat sekali; input/select/checkbox tetap reaktif; text link tidak menghalangi Space/navigation; reduced/off; disabled/removal; visibility dan cleanup.

Browser build produksi memverifikasi pencarian DNS menghasilkan satu soal dan kembali ke enam; dialog editor menerima textarea, input opsi, radio dan select lalu Batal mengembalikan fokus; builder mempertahankan nilai draft dan label native. Semua input yang diperiksa memiliki transform none, outline fokus 3 px. Tidak ditemukan overflow pada 360/390/768/1024/1440 px. Tidak ada error/warning console pada alur yang diuji. Data soal uji dialog dibatalkan, tidak disimpan.

Belum dilakukan pengukuran 60 fps pada perangkat low-end atau audit aksesibilitas seluruh situs. Reduced/off dan tab hidden diuji melalui fixture/policy; preferensi OS nyata belum diubah. Panel tuning dev-only, guard hardcoded transitions, profiling akhir, dan batch containers berikutnya menunggu review fase ini.

## Penerapan fase 5 · Containers dan daftar

Panel/kartu kini masuk dengan spring `gentle` dan stagger dari token. Scope `createContainerMotionScope` dipasang sekali di app dan menemukan `.panel`, `.bank-card`, `.help-card` baru secara otomatis. IntersectionObserver hanya memulai efek saat elemen terlihat; konten tidak disembunyikan selama menunggu observer. Fokus keyboard langsung menampilkan container dan menghentikan efeknya. Konten tetap terlihat saat API observer tidak tersedia atau gagal.

Scope menghindari container bertumpuk, sidebar, dialog, Motion Lab, dan `.exam-shell`. Panel yang memuat MotionList juga tidak dianimasikan bersamaan dengan barisnya. Hover kartu dan tombol tetap diam. Timer, area soal/jawaban saat ujian, serta upload tugas tidak mendapat motion container.

`MotionList` adalah wrapper Vue untuk daftar berkunci. Wrapper dapat merender `div` atau `tbody`, sehingga struktur tabel tetap `table > tbody > tr`. Daftar bank soal, assessment pengajar/dashboard, assessment peserta, ringkasan hasil, pengumpulan peserta, dan hasil peserta memakainya. Hanya perubahan urutan/isi `itemKeys` yang mengambil snapshot; perubahan teks input, nilai, feedback, dan timer tidak memulai FLIP.

```vue
<MotionList class="bank-grid" :item-keys="questions.map((q) => q.id)">
  <article v-for="q in questions" :key="q.id" :data-motion-key="q.id" class="bank-card">
    <!-- konten dan tombol native -->
  </article>
</MotionList>
```

Gunakan key unik/stabil yang sama untuk Vue, itemKeys, dan data-motion-key. Elemen yang bertahan menggunakan FLIP translate `smooth`; elemen baru masuk melalui observer/stagger. Elemen yang tidak berpindah tidak diberi tween. Opacity asli dipertahankan. Elemen yang sedang memegang fokus tidak dipindahkan oleh FLIP.

Elemen yang terhapus langsung keluar dari DOM/data asli. Exit memakai salinan visual `aria-hidden`, `inert`, pointer-events none, tanpa ID, href, autofocus, atau tab stop. Salinan tidak menahan aksi, form, hitungan hasil, atau navigasi. Tabel mempertahankan bentuk tabel dan lebar kolom hasil snapshot. Salinan di luar viewport atau yang memuat input/media tidak dibuat. Kapasitas exit mengikuti sisa budget global, bukan antrean tanpa batas. Scroll, resize, perubahan policy, update cepat, dan unmount membuang salinan lama; tidak ada salinan yang disimpan sebagai data.

Geometry dan base-style dibaca per batch sebelum transform/opacity ditulis. Posisi/ukuran exit ditempatkan sekali sebagai snapshot, bukan ditween. Efek hanya mengubah transform/opacity; tidak ada animasi width, height, top, left, radius atau grid. Will-change dilepas setelah settle. Parent container tidak ditumpuk dengan motion daftar di dalamnya. Semua job berbagi batas 8 desktop/3 mobile dengan atoms dan primitive yang sudah ada.

Reduced motion (termasuk override per item) memakai opacity saja. `data-motion="off"` melewati efek; daftar tetap berubah seketika. Kontrol yang mendapat fokus membatalkan gerak daftar agar hitbox/fokus kembali stabil. Scope/komponen membersihkan IO, MutationObserver, media/visibility/scroll/resize/focus listener, snapshot, ghost dan RAF miliknya pada unmount. Tidak ada durasi/easing/spring numerik baru di komponen dan tidak ada dependensi baru.

### File yang diubah pada fase 5

| File                                          | Perubahan                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| src/App.vue                                   | Mount/cleanup scope container global.                                                          |
| src/motion/containers.js                      | Selektor, pengecualian dan reveal bertahap panel/kartu baru.                                   |
| src/motion/reveal.js                          | Registrasi dinamis/add, filter, stagger, pilihan tidak pre-hide, batch base reads dan cleanup. |
| src/motion/layout.js                          | animateLayout dari snapshot pre-patch; skip item diam/off dan pertahankan opacity/policy.      |
| src/motion/lists.js                           | Capture/update daftar, retained FLIP, exit ghost inert, budget dan lifecycle.                  |
| src/components/motion/MotionList.vue          | Wrapper div/tbody berkunci dengan lifecycle Vue.                                               |
| src/motion/primitives.css                     | Exit layer tetap di viewport dengan hit testing nonaktif.                                      |
| src/components/assessment/AssessmentTable.vue | MotionList tbody, termasuk tabel di dashboard.                                                 |
| src/views/teacher/QuestionBankView.vue        | MotionList bank soal dan filter.                                                               |
| src/views/teacher/ResultsView.vue             | MotionList ringkasan hasil dan tbody pengumpulan.                                              |
| src/views/student/StudentAssessmentView.vue   | MotionList kartu peserta.                                                                      |
| src/views/student/MyResultsView.vue           | MotionList tbody hasil peserta.                                                                |
| src/views/MotionLabView.vue                   | Label review fase 5; hover tombol tetap diam.                                                  |
| tests/components/motion-containers.test.js    | Dua belas tes container/FLIP/ghost/semantik/state/policy.                                      |
| MOTION.md                                     | API, perilaku, file dan batas fase 5.                                                          |

### Verifikasi dan batas fase 5

27 Oktober 2026: 68 tes lulus (56 regresi + 12 baru), build produksi berhasil. Tes mencakup scope dinamis/once/exclusions, budget bersama, konten visible tanpa IO, fokus saat animasi, batch read/write, skip item diam/off, removed DOM langsung, inert/ID-free ghost, rapid update/scroll/policy/unmount, reduced/off/per-item reduced, tabel, dan input state/identity yang bertahan. Tes fase 4 tetap memverifikasi hover tombol tidak membaca geometry atau menggerakkan transform/RAF.

Browser pada build produksi memverifikasi bank soal 6 → DNS 1 → kosong 0 → 6, fokus pencarian tetap, detail soal dapat dibuka dan Escape mengembalikan fokus. Ghost exit tidak masuk accessibility tree, inert dan tanpa ID; sesudah settle ghost/will-change berjumlah 0. Filter assessment SQL menampilkan satu baris nyata dalam tbody, peran peserta menampilkan 7 kartu pada data browser uji dan halaman hasil peserta tetap memakai tabel native. Dashboard/role/route tetap berfungsi. Tidak ada overflow dokumen pada 360/390/768/1024/1440 px; tidak ada error/warning console pada alur yang diuji. Tidak ada data assessment baru atau perubahan nilai yang disimpan saat QA.

Pengujian ini bukan pengukuran 60 fps pada perangkat low-end. Reduced/off, policy dan cleanup diuji melalui fixture; preferensi OS nyata belum diubah. Exit snapshot sengaja dibatasi item terlihat tanpa form/media. Animasi overlays/toast, navigasi, media/loaders, transisi halaman global/background, guard hardcoded transitions dan tuning dev-only menunggu batch berikutnya. Fase 6 (overlays) belum dimulai; berhenti untuk review fase 5.

## Penerapan fase 6 · Dialog dan notifikasi

28 Oktober 2026. `createOverlayMotion` memakai primitive presence dengan preset `smooth` dan token bersama. Enter/exit hanya mengubah transform/opacity; reduced motion fade-only, `data-motion="off"` dan tab hidden melewati efek. Budget global 8 desktop/3 mobile tetap berlaku. Tombol tidak mengikuti kursor dan tidak bergerak saat hover.

`AppDialog` mempertahankan native showModal, top layer, backdrop, Escape dan fokus modal. ID judul unik memakai Vue useId. Penutupan tidak menunggu spring: dialog asli segera ditutup, fokus kembali ke pembuka yang masih terhubung. Snapshot visual sebelum slot dibersihkan mengisi animasi exit; salinan inert/aria-hidden, tanpa ID, name, href, autofocus, live region atau tab stop. Nilai form yang belum disimpan disalin untuk tampilan saja. Tidak ada submit/aksi yang ditunda. Buka-tutup cepat dan unmount membatalkan pekerjaan tertunda.

`AppToast` memperbaiki class .toast yang sebelumnya hilang, menyediakan live region permanen (polite/atomic), pesan berulang melalui sequence, ID unik, tombol Tutup notifikasi, serta fokus kembali setelah dismissal keyboard. Notifikasi memakai posisi fixed responsif. Waktu baca 5 detik adalah perilaku produk, terpisah dari durasi motion: pointer/fokus menghentikan timer, keluar memberi waktu baca penuh kembali. Timer lama dan timer store dibersihkan saat diganti/dismiss/dispose. Preview Motion Lab bersifat manual-dismiss dan tidak mengubah assessment.

Overlay berhenti bergerak saat pointerdown, keyboard atau fokus berpindah di dalamnya, agar kontrol mudah ditarget. Resize/scroll/policy/unmount membersihkan snapshot, listener dan RAF; will-change dilepas setelah settle. Geometry snapshot ditulis sekali, tidak ditween. Backdrop native tetap statis; tidak ada filter/gooey tambahan. Dropdown native tetap mengikuti browser. Popover dan tooltip sidebar dikerjakan bersama navigasi pada fase 7 agar state/fokusnya ditangani dalam satu batch.

### File fase 6

| File | Perubahan |
| --- | --- |
| src/motion/overlays.js | Controller enter/exit, snapshot inert, budget, policy dan cleanup. |
| src/components/ui/AppDialog.vue | Integrasi modal native, unique label, fokus, race/unmount guard. |
| src/components/ui/AppToast.vue | Toast reusable, live announcement, keyboard dismissal dan pause/resume. |
| src/App.vue | Pasang AppToast global. |
| src/stores/uiStore.js | Sequence notifikasi, dismiss, pause/resume dan disposal timer. |
| src/motion/primitives.css | Layer snapshot dan aksesibilitas tombol toast. |
| src/styles/design-system.css | Surface snapshot dialog dan ukuran toast responsif. |
| src/styles/main.css | Style dialog juga berlaku pada snapshot visual. |
| src/views/MotionLabView.vue | Preview dialog/toast pada mode system/reduced/off. |
| tests/components/motion-overlays.test.js | Delapan tes overlay, semantik, fokus, lifecycle dan timer. |
| MOTION.md | Dokumentasi fase, daftar file dan batas pengujian. |

### Verifikasi dan batas fase 6

76 tes lulus (68 regresi + 8 overlay), build produksi berhasil. Tes mencakup snapshot inert/ID-free dan nilai form, reduced/off, budget/hidden, scroll/policy/reopen/dispose, label unik, native open/close dan fokus, race unmount, live region persisten serta timer notifikasi. Browser memverifikasi Escape, penutupan toast via keyboard, mode reduced pada Motion Lab, form bank soal yang dapat diisi dan dibatalkan tanpa menyimpan, fokus kembali ke Tambah soal dan enam soal tetap tersedia. Pada viewport 390 px dialog berada dalam layar dan tidak ada overflow; console alur uji tanpa error/warning.

Ini bukan pengukuran 60 fps pada perangkat low-end atau uji screen reader nyata. Preferensi reduced diuji melalui token/policy fixture dan mode review, bukan mengubah OS. Audit performa seluruh situs, guard hardcoded transitions dan tuning panel tetap fase berikutnya. Berhenti untuk review fase 6 sebelum navigasi (fase 7).

## Penerapan fase 7 · Navigasi

29 Oktober 2026. Sidebar, submenu/popover, tooltip dan indikator menu aktif kini memakai engine/token bersama. Hover tombol/link tetap diam tanpa magnetic pull. Scope navigasi global juga mencakup kontrol baru di nav/.tabs, dengan press opacity saja sehingga hitbox tidak berubah; link native, Enter dan Space tetap mengikuti browser. Area ujian dan scope lokal Motion Lab dikecualikan.

Transisi CSS grid-template-columns dan drawer linear dihapus. Layout desktop berpindah sekali ke lebar 248/80 px lalu konten melakukan FLIP translate smooth; elemen yang memegang fokus dilewati. Submenu menganimasikan enter/exit melalui controller overlay, sementara link saudara yang bergeser memakai FLIP. Drawer mobile masuk dengan spring smooth dari sisi kiri memakai transform dan opacity. Penutupan melepas modal/inert/body lock langsung; exit hanya salinan visual inert. Keyboard/pointer, resize, policy dan unmount membatalkan pekerjaan terkait. Reduced motion memakai fade saja; off melewati animasi.

Tooltip rail memakai enter opacity gentle dari token. Fokus keyboard dan pointer dapat menampilkannya, Escape menutupnya sampai entry berikutnya; transform link tidak berubah. Indikator aktif adalah span dekoratif aria-hidden dengan gentle opacity/scale token. aria-current dan label link tetap pada kontrol asli. Semua listener dan pekerjaan engine dibersihkan saat scope/komponen dibongkar. Tidak ada dependency baru, tween ukuran/grid, loop idle, atau will-change permanen.

### File fase 7

| File | Perubahan |
| --- | --- |
| src/motion/navigation.js | Scope press/tooltip dan controller FLIP navigasi reusable. |
| src/components/motion/MotionActiveIndicator.vue | Indikator aktif dekoratif dengan policy/cleanup. |
| src/components/navigation/SidebarItem.vue | Indikator untuk link aktif. |
| src/components/navigation/AppSidebar.vue | Spring drawer, submenu/popover, FLIP, fokus dan race guard. |
| src/layouts/AppShell.vue | FLIP konten saat collapse desktop. |
| src/App.vue | Mount/dispose scope navigasi global. |
| src/styles/main.css | Hapus tween grid/drawer; visibilitas tooltip terkendali. |
| src/styles/design-system.css | Hapus transisi drawer lama. |
| src/motion/primitives.css | Layer indikator aktif. |
| src/views/MotionLabView.vue | Label review fase 7. |
| tests/components/motion-navigation.test.js | Tes tooltip, native link, reduced/off, FLIP, compact dan mobile drawer. |
| MOTION.md | API/perilaku, daftar file dan batas verifikasi. |

### Verifikasi dan batas fase 7

Tes regresi, tes navigasi dan build produksi dijalankan. Cakupan meliputi Escape tooltip, hover link statis, perilaku keyboard native, reduced/off, FLIP hanya pada surface tanpa fokus, pembatalan saat keyboard, compact popover/aria-current/fokus, mobile Escape/inert/body lock serta buka-tutup cepat. Pemeriksaan visual browser belum dilakukan: tool browser sesi sebelumnya tidak tersedia; percobaan membaca UI aplikasi ChatGPT ditolak automatic approval review karena dapat membuka percakapan lain. Tidak dilakukan pembacaan alternatif untuk melewati penolakan tersebut. Tidak ada klaim pengukuran 60 fps atau uji screen reader nyata.

Fase 7 berhenti untuk review. Media/loaders, transisi halaman/background global dan audit performa/tuning akhir tetap batch berikutnya.

## Penerapan fase 8 · Media, ikon dan loading

29 Oktober 2026. `createMediaScope` dipasang sekali di App dan mencakup media/indikator baru melalui load/error capture dan MutationObserver terbatas. Semua feedback fase ini memakai opacity dengan preset spring gentle, token stagger bersama, budget global dan reduced/off. Tidak ada durasi/easing baru di komponen, dependency tambahan atau loop RAF idle.

Gambar biasa mendapat satu entrance setelah load atau saat sudah cached (complete/naturalWidth). Konten tidak pre-hide dan tidak menunggu decode; ukuran, alt dan native load/error tetap milik elemen asli. Sumber yang sama tidak diputar ulang pada event load duplikat. Gambar gagal tetap menampilkan fallback browser/alt. Logo Tut Wuri Handayani, gambar area ujian dan entrance gambar di dalam panel/kartu/daftar dikecualikan agar identitas tetap stabil dan motion tidak bertumpuk.

Icon.vue menandai nama ikon melalui data-liquid-icon. Hanya perubahan nama yang memulai fade spring; ikon awal dan hover tidak memulai efek. SVG tetap aria-hidden untuk ikon dekoratif. Grafik nilai dashboard memakai data-media-key dari ID/nilai peserta; perubahan data nyata memulai opacity saja, tanpa tween titik/polyline/path. Label grafik tetap role=img dan aria-label.

AppLoading adalah status reusable dengan label terbaca dan tiga titik aria-hidden. Titik masuk satu kali dengan stagger, lalu diam selama pekerjaan berlangsung; tidak ada spinner loop, fake percentage, minimum waiting time atau penundaan aksi. Label upload berkas memiliki aria-busy dan AppLoading hanya muncul ketika FileReader/persist sedang bekerja, mengikuti ref uploading yang sudah ada. Validasi jenis/ukuran, error, simpan dan submit tetap memakai alur sebelumnya. Preview loading dan pergantian ikon tersedia di Motion Lab; preview harus diselesaikan secara manual agar tidak mengarang proses backend.

Perubahan data-motion/visibility membatalkan pekerjaan; elemen terhapus dan scope dispose melepas handle, observer, load/error/media/visibility listener serta will-change. Pembacaan base opacity dibatch sebelum write animasi. Scope tidak menggerakkan transform, filter, dimensi atau posisi media. Gunakan data-media-key stabil yang berubah hanya bersama konten grafik/media; jangan hubungkan ke timer ujian. Untuk status baru gunakan AppLoading dan kondisi pending sebenarnya. Native video/audio tidak autoplay atau diberi gerak dekoratif.

### File fase 8

| File | Perubahan |
| --- | --- |
| src/motion/media.js | Scope media cached/load/error, perubahan SVG key, finite loader, budget/policy/cleanup. |
| src/components/ui/AppLoading.vue | Label status live polite/atomic dan titik dekoratif. |
| src/components/ui/Icon.vue | Penanda nama ikon untuk perubahan state. |
| src/App.vue | Mount/dispose scope media global. |
| src/views/teacher/DashboardView.vue | Key grafik berdasarkan data nilai sebenarnya. |
| src/views/student/AttemptView.vue | Status penyimpanan berkas dan aria-busy. |
| src/views/MotionLabView.vue | Preview loading/ikon dan label fase 8. |
| src/motion/primitives.css | Tata letak status dan titik berukuran tetap. |
| tests/components/motion-media.test.js | Delapan tes media/loading, accessibility attributes dan lifecycle. |
| MOTION.md | API/perilaku, daftar file dan batas verifikasi. |

### Verifikasi dan batas fase 8

91 tes lulus (83 regresi + 8 baru; 11 Node + 80 Vitest), build produksi berhasil. Tes mencakup cached image sekali tanpa decode gate, alt/dimensi stabil, gambar gagal/removal, pengecualian logo/exam/nested container, perubahan ikon/grafik dan label, reduced/off, label status/titik dekoratif, nol RAF setelah settle, budget bersama, policy dan disposal. Keberhasilan ini bukan uji screen reader nyata, pengukuran 60 fps, atau verifikasi visual browser.

Tool browser sesi lama tidak tersedia. Pemeriksaan visual fase ini belum dilakukan; pembacaan jendela ChatGPT pada fase sebelumnya ditolak automatic approval review karena dapat membuka percakapan lain dan tidak diulang sebagai jalan pintas. Tidak ada screenshot baru yang diklaim sebagai hasil fase 8.

Berhenti untuk review fase 8 sebelum transisi halaman/background global (fase 9). Guard hardcoded motion, audit performa akhir dan tuning global tetap batch penutup.

## Penerapan fase 9 · Halaman dan background

29 Oktober 2026. `installPageTransitions` menambahkan enhancement visual pada router.afterEach setelah navigasi sukses. Hook tidak mengembalikan promise animasi, tidak mengubah URL/data, dan tidak memblokir guard/submit. DOM patch ditunggu melalui nextTick. Browser dengan View Transitions memakai snapshot + keyframe spring dari token; browser tanpa API atau snapshot yang gagal memakai presence fallback. Karena efek dimulai setelah konfirmasi router, snapshot native adalah enhancement visual state yang dirender saat browser mengambil snapshot, bukan jaminan snapshot halaman sebelum URL berubah.

Target hanya #route-scene di AppShell: sidebar, topbar, footer dan toast tidak ikut digeser. Initial load, perubahan query/hash pada path sama, navigasi gagal, halaman lokal Motion Lab, serta perpindahan dari/ke meta.exam dilewati. Fokus shell tetap menuju main-content sesuai perilaku sebelumnya. Pointer/keyboard atau fokus masuk ke kontrol halaman membatalkan efek agar hitbox stabil. Navigasi cepat membatalkan run sebelumnya dan tidak memutar fallback lama setelah DOM patch tertunda. Hook/listener/signal dan atribut snapshot/penanda dibersihkan pada settle atau dispose. Kegagalan visual tidak membatalkan route yang sudah dikonfirmasi.

Saat penanda data-liquid-page-motion aktif, entrance container dan item daftar baru dilewati agar page spring tidak bertumpuk dengan reveal anak. Konten tetap visible dan perubahan data tetap langsung. Budget native snapshot memakai dua slot bersama engine; overflow budget melewati efek. Reduced motion fade-only; off/hidden melewati efek. CSS menonaktifkan interpolasi ukuran snapshot bawaan; pseudo-element tidak menangkap pointer. Efek hanya transform/opacity, tidak ada tween width, height, top, left, grid atau radius.

PageAtmosphere memakai LiquidGoo hanya di /dashboard dan /student. Bersama demo Motion Lab, ada tiga konteks gooey yang dibatasi. Lapisan dekoratif aria-hidden/inert, tanpa teks/tautan, pointer-events none dan dibatasi area header kanan. Konten berada pada lapisan tersendiri dan tidak terkena SVG filter. Gerak gentle sekali saat mount, tanpa loop; filter nonaktif pada mobile/coarse/reduced/off. Policy saat tab hidden kini mereset blob tanpa memulai animasi baru. Logo dan hover tombol tetap diam.

### File fase 9

| File | Perubahan |
| --- | --- |
| src/motion/pages.js | afterEach enhancement, pengecualian route, interaction/rapid cancel dan lifecycle. |
| src/motion/route.js | Cancellation state mencegah stale fallback/native replay. |
| src/components/motion/PageAtmosphere.vue | Wrapper background dekoratif inert. |
| src/components/motion/LiquidGoo.vue | Tidak memulai RAF baru saat dokumen hidden. |
| src/layouts/AppShell.vue | Scene stabil dan background terbatas dua halaman. |
| src/App.vue | Install/dispose page transitions dengan nextTick Vue. |
| src/motion/containers.js | Hindari nested reveal selama page motion. |
| src/motion/lists.js | Hindari entrance item baru selama page motion. |
| src/motion/primitives.css | Layer background/scene dan pointer fallback snapshot. |
| src/views/MotionLabView.vue | Label fase 9. |
| tests/components/motion-pages.test.js | Delapan tes route, cancellation, policy dan dekorasi. |
| MOTION.md | Perilaku, daftar file dan batas verifikasi. |

### Verifikasi dan batas fase 9

99 tes lulus (91 regresi + 8 baru; 11 Node + 88 Vitest), build produksi berhasil. Tes memastikan navigation resolve saat promise motion masih pending, skip initial/query/exam/Lab/failed, fokus shell tidak membatalkan gerak tetapi fokus kontrol membatalkan, rapid navigation/keydown, rejection visual tidak rollback path, disposal hook, reduced/off tanpa transform, stale fallback tidak berjalan, serta background inert dan filter off pada reduced. Tes primitive native/snapshot rejection, budget/cleanup dan alur assessment tetap lulus.

Belum ada pemeriksaan visual browser, uji screen reader nyata, atau profiling 60 fps/perangkat low-end; tool browser tidak tersedia di sesi ini. Tidak ada screenshot baru yang diklaim sebagai fase 9. Perlu review visual untuk menilai skala rasa gerak, posisi dekorasi dan perilaku View Transitions pada browser nyata.

Berhenti untuk review fase 9. Batch penutup berikutnya mencakup guard hardcoded motion, audit aksesibilitas/performa, degradasi low-end dan konfigurasi tuning global dev-only.

## Fase 10 · Audit kode, fallback perangkat dan tuning development

29 Oktober 2026. Implementasi penutup menambahkan deteksi konservatif hardwareConcurrency/deviceMemory yang positif dan <=4, atau Save-Data. Hint tidak tersedia/invalid tidak dianggap nol. Root data-motion-tier=lite memaksa mode fade-only, menonaktifkan gooey/magnetic/hover spatial melalui snapshot token, dan membatasi budget bersama ke --motion-lite-concurrent (2). Off dan preferensi reduced tetap berlaku; tidak ada UA sniff, request jaringan atau penyimpanan preferensi baru. Listener Save-Data dan atribut sebelumnya dipulihkan saat dispose.

`npm run check:motion` sekarang dijalankan paling awal oleh `npm run check`. Guard memeriksa sumber css/js/vue, menolak CSS motion selain none, literal numeric duration/stiffness/damping/mass/delay pada properti objek UI/motion, literal easing dan permanent will-change. Nilai canonical di tokens.css dan durasi assessment pada domain/fixtures dikecualikan. Ini scanner pola, bukan parser/linter AST penuh; penulisan dinamis/alias tetap membutuhkan code review. Engine tetap membatasi properti runtime ke transform/opacity/filter dan menolak ukuran/posisi layout.

### Tuning khusus development

Di `npm run dev`, buka console browser dan gunakan:

```js
examniaMotion.inspect() // settings, snapshot token saat ini, active/peak/raf engine
examniaMotion.set({ stiffnessFactor: 1.1, dampingFactor: 1.1, staggerMs: 30, overshoot: 0.04 })
examniaMotion.reset()
```

Faktor diterapkan bersama ke empat preset dari baseline CSS yang dibaca saat install, bukan mengalikan hasil tuning sebelumnya. Mass dan relasi preset dipertahankan. Perubahan memakai CSS variables global; policy membatalkan animasi lama agar tidak bercampur dengan token baru. Opsi divalidasi seluruhnya sebelum write: faktor positif <=4, stagger 0..stagger cap, overshoot 0..1; key tak dikenal dan NaN ditolak. Reset/dispose mengembalikan inline override dan API lama. Tidak ada persistence, perubahan data assessment atau cara mengaktifkan hover magnetic dari tuning. Import berada di cabang import.meta.env.DEV; HMR membersihkan API dan guard race dynamic import. Bundle produksi diperiksa tidak mengandung examniaMotion/stiffnessFactor/dampingFactor.

### Konsistensi dan pedoman

| Kebutuhan | Pilihan bersama | Alasan |
| --- | --- | --- |
| Press/release | snappy | Respons kontrol singkat; hover tetap diam. |
| Enter container, ikon/media, indikator | gentle | Hierarki tenang dan tidak mengambil fokus. |
| FLIP, overlay, drawer, halaman | smooth | Perubahan ruang terhubung tanpa penundaan aksi. |
| Bouncy | Eksplorasi Motion Lab | Bukan default semua elemen. |
| Reduced/lite | opacity saja | Transform/filter spatial dilewati oleh engine. |
| Gooey | Dashboard, halaman peserta, demo Lab | Maksimal tiga konteks; tanpa loop dan tanpa memfilter teks. |

Untuk elemen baru, pakai scope/wrapper bersama sebelum menambah listener per komponen. Jangan membuat duration/easing/spring lokal, tween ukuran/grid/path, will-change permanen, spinner loop atau progress palsu. Pertahankan ukuran/alt media, hitbox, native form semantics dan focus-visible. Pakai data-motion=off untuk opt-out; jangan reset transform statis. Cleanup observer/listener/RAF pada unmount; kegagalan motion tidak boleh menunda transaksi atau navigasi.

### File fase 10

| File | Perubahan |
| --- | --- |
| src/motion/capabilities.js | Hint low-end/Save-Data, restore policy dan listener. |
| src/motion/tuning.js | API dev-only global, validasi atomik, baseline/reset/dispose. |
| src/motion/tokens.css | Token canonical budget lite. |
| src/motion/tokens.js | Lite memaksa fade-only dan budget minimum bersama. |
| src/motion/policy.js | Batalkan job saat tier atau tuning berubah. |
| src/App.vue | Install/cleanup kemampuan perangkat. |
| src/main.js | Import tuning hanya DEV dan cleanup HMR. |
| scripts/check-motion.mjs | Guard pola source motion yang dapat dijalankan di CI. |
| package.json | check:motion dan integrasi pada check. |
| tests/components/motion-final.test.js | Tujuh tes perangkat, tuning, policy, burst/read-write dan guard. |
| MOTION-AUDIT.md | Temuan audit, bukti dan keterbatasan. |
| MOTION.md | Panduan akhir, tuning, konsistensi dan daftar file. |

### Verifikasi akhir dan batas

106 tes lulus (11 Node + 95 Vitest), motion guard lulus dan build produksi berhasil. Tes tambahan memastikan hint hilang aman, perubahan Save-Data/disposal, lite opacity-only/budget dua, scaling preset seragam, input tuning invalid tidak meninggalkan write parsial, pemulihan override/API, notifikasi policy, burst 20 elemen dibatasi dua job, nol getComputedStyle/getBoundingClientRect selama RAF flush setelah prepare, serta nol job/RAF/will-change setelah settle. Bundle produksi tidak membawa API tuning. Tes ini tidak mengukur durasi frame nyata.

Audit kode dan automated regression selesai; QA visual browser, screen reader nyata, pengukuran kontras menyeluruh dan profiling FPS pada perangkat fisik belum dilakukan karena tool browser tidak tersedia. Target 60 fps belum terverifikasi. Tidak ada screenshot baru fase ini. Lihat MOTION-AUDIT.md untuk bukti dan batas setiap kesimpulan.
