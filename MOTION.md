# EXAMNIA liquid motion

Status: **fase 2 — fondasi tokens**, 27 Oktober 2026. Primitive, penerapan komponen, profiling, dan panel tuning menunggu review fase berikutnya.

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
- Jangan memberi magnetic hover pada input, touch, disabled control, atau teks panjang.

## Cakupan fase dan pemeriksaan

Fase ini menambahkan tokens, reader, policy resolver, opt-out, dan tes. Ia belum menggerakkan UI atau memperbaiki toast; aturan sidebar lama tetap ada sampai batch navigasi menggantinya dengan FLIP/spring. Aturan reduced-motion lama masih mematikan CSS animations/transitions; primitive fade mendatang harus diintegrasikan secara eksplisit dan diuji.

Batch berikutnya: primitive bersama; atoms; containers; overlays; navigation; media/loaders; page transitions/backgrounds; performance/accessibility dan tuning dev-only. Setiap fase berhenti untuk review. Peringatan dev/lint untuk hardcoded transitions serta panel tuning belum dipasang pada fase 2.

Uji tokens memeriksa sumber CSS, override dinamis, satu style read, immutable presets, fade-only reduced motion, subtree opt-out, mobile flags, stagger cap, nilai invalid, dan import tanpa DOM. Tes ini belum merupakan pengukuran 60 fps atau visual QA seluruh primitive.

Referensi platform: [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) dan [getComputedStyle](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle).

## Hasil verifikasi fase 2

27 Oktober 2026: 25 tes lulus (17 regresi + 8 tes fondasi motion), build produksi berhasil. Browser pada build produksi memuat token desktop dan mobile dengan benar: budget 8/3, hover/gooey nonaktif pada lebar 390 px, tanpa error console atau overflow dashboard. Serialisasi hasil build seperti `.24s`, `0s`, dan `0px` sesuai format parser. Reduced-motion dan subtree opt-out diuji pada policy dan deklarasi stylesheet; preferensi reduced-motion sistem operasi belum diuji secara visual di browser sesi ini.
