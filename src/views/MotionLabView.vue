<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useMotionScope } from "../motion/useMotionScope.js";
import { motionEngine } from "../motion/engine.js";
import { safeTokens, observeMotionPolicy } from "../motion/policy.js";
import { observeReveals } from "../motion/reveal.js";
import { flipLayout } from "../motion/layout.js";
import { transitionRoute } from "../motion/route.js";
import { animatePresence } from "../motion/presence.js";
import MotionButton from "../components/motion/MotionButton.vue";
import MotionPresence from "../components/motion/MotionPresence.vue";
import MotionShape from "../components/motion/MotionShape.vue";
import LiquidGoo from "../components/motion/LiquidGoo.vue";
import PageTitle from "../components/ui/PageTitle.vue";
import AppDialog from "../components/ui/AppDialog.vue";
import AppToast from "../components/ui/AppToast.vue";
import AppLoading from "../components/ui/AppLoading.vue";
import Icon from "../components/ui/Icon.vue";
const mediaPending = ref(false),
  mediaIcon = ref(false);
const overlayOpen = ref(false),
  overlayMessage = ref(""),
  overlaySequence = ref(0);
const root = ref(),
  tiles = ref(),
  routeTarget = ref(),
  revealRoot = ref(),
  mode = ref("system"),
  preset = ref("smooth"),
  show = ref(true),
  shape = ref(false),
  goo = ref(false),
  items = ref([1, 2, 3, 4, 5, 6]),
  clicks = ref(0),
  routeScene = ref(0),
  routeStatus = ref("Belum dijalankan"),
  busy = ref(false),
  policy = ref(null);
const controller = new AbortController();
let reveals, stopPolicy;
const scope = useMotionScope(root),
  description = computed(() =>
    policy.value?.mode === "reduced"
      ? "Fade-only aktif"
      : policy.value?.mode === "off"
        ? "Seluruh motion nonaktif"
        : "Spring physics aktif",
  );
function updatePolicy() {
  policy.value = safeTokens(root.value);
}
async function modeChanged() {
  await nextTick();
  scope.refresh();
  updatePolicy();
  resetReveals();
}
function enterTiles() {
  const tokens = safeTokens(root.value);
  for (const [index, el] of [...tiles.value.children].entries())
    animatePresence(el, { index, preset: preset.value, tokens });
}
async function reorder() {
  if (busy.value) return;
  busy.value = true;
  try {
    await flipLayout(
      [...tiles.value.children],
      async () => {
        items.value = [...items.value.slice(1), items.value[0]];
        await nextTick();
      },
      {
        preset: preset.value,
        tokens: safeTokens(root.value),
        signal: controller.signal,
      },
    );
  } finally {
    busy.value = false;
  }
}
async function navigate(native) {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await transitionRoute(
      async () => {
        routeScene.value = 1 - routeScene.value;
        await nextTick();
      },
      {
        target: routeTarget.value,
        preset: preset.value,
        native,
        signal: controller.signal,
      },
    );
    routeStatus.value =
      result.mode === "native"
        ? "View Transitions API"
        : result.mode === "fallback"
          ? "Fallback enter/fade"
          : "Tanpa animasi";
  } finally {
    busy.value = false;
  }
}
function resetReveals() {
  reveals?.dispose();
  reveals = observeReveals(revealRoot.value);
}
onMounted(() => {
  updatePolicy();
  resetReveals();
  stopPolicy = observeMotionPolicy(root.value, updatePolicy);
});
onBeforeUnmount(() => {
  controller.abort();
  stopPolicy?.();
  reveals?.dispose();
  motionEngine.cancelWithin(root.value);
});
</script>
<template>
  <div
    ref="root"
    data-liquid-scope="local"
    :data-motion="mode === 'system' ? undefined : mode"
  >
    <PageTitle
      title="Liquid Motion Lab"
      description="Fase 8 · Media, perubahan ikon dan indikator loading memakai motion bersama. Hover tombol tetap diam."
      ><RouterLink to="/dashboard" class="btn"
        >Kembali ke dashboard</RouterLink
      ></PageTitle
    >
    <div class="liquid-lab-toolbar">
      <label class="field"
        ><span class="field-label">Mode review</span
        ><select v-model="mode" class="input" @change="modeChanged">
          <option value="system">Ikuti sistem</option>
          <option value="reduced">Reduced motion · fade only</option>
          <option value="off">Motion off</option>
        </select></label
      ><label class="field"
        ><span class="field-label">Preset preview</span
        ><select v-model="preset" class="input">
          <option
            v-for="p in ['snappy', 'smooth', 'bouncy', 'gentle']"
            :key="p"
          >
            {{ p }}
          </option>
        </select></label
      >
      <p class="liquid-lab-meta" role="status">
        {{ description }} · budget
        {{ policy?.limits.maxConcurrent ?? "—" }} animasi
      </p>
    </div>
    <div class="liquid-lab-grid">
      <section class="panel">
        <h2>Media · Status & ikon</h2>
        <p>
          Indikator masuk sekali, lalu tetap terlihat sampai proses selesai.
          Preview ini tidak menyimpan data.
        </p>
        <div class="action-row mt">
          <button
            class="btn"
            :aria-pressed="mediaPending"
            @click="mediaPending = !mediaPending"
          >
            {{ mediaPending ? "Selesaikan preview" : "Preview loading" }}
          </button>
          <button class="btn" @click="mediaIcon = !mediaIcon">
            <Icon :name="mediaIcon ? 'check' : 'file'" />Ganti ikon
          </button>
        </div>
        <AppLoading v-if="mediaPending" class="mt" label="Memproses preview…" />
      </section>
      <section class="panel">
        <h2>Overlay · Dialog & notifikasi</h2>
        <p>
          Uji Escape, fokus keyboard, dan mode reduced/off. Preview ini tidak
          mengubah data assessment.
        </p>
        <div class="action-row mt">
          <button class="btn" @click="overlayOpen = true">
            Preview dialog
          </button>
          <button
            class="btn"
            @click="
              overlayMessage = 'Preview notifikasi EXAMNIA';
              overlaySequence++;
            "
          >
            Preview notifikasi
          </button>
        </div>
        <AppDialog
          :open="overlayOpen"
          title="Preview overlay"
          @close="overlayOpen = false"
        >
          <p class="dialog-copy">
            Dialog memakai spring smooth. Tekan Escape atau Tutup untuk kembali
            ke tombol pembuka tanpa menunggu animasi.
          </p>
        </AppDialog>
        <AppToast
          :message="overlayMessage"
          :sequence="overlaySequence"
          @dismiss="overlayMessage = ''"
        />
      </section>
      <section class="panel">
        <h2>01 · Press, hover & ripple</h2>
        <p>
          Tekan dengan pointer atau keyboard. Hover tetap diam, tanpa tarikan
          kursor. Press squash, spring release, dan ripple mengikuti token
          bersama.
        </p>
        <div class="liquid-lab-stage action-row">
          <MotionButton variant="primary" @click="clicks++"
            >Tekan saya</MotionButton
          ><MotionButton @click="clicks = 0">Reset hitungan</MotionButton
          ><MotionButton disabled>Nonaktif</MotionButton>
        </div>
        <p role="status">{{ clicks }} klik berhasil</p>
      </section>
      <section class="panel">
        <h2>02 · Enter & exit</h2>
        <p>
          Spring masuk/keluar dengan pembatalan saat toggle cepat. Aksi tidak
          menunggu animasi.
        </p>
        <MotionButton @click="show = !show" :aria-pressed="show"
          >Tampilkan / sembunyikan</MotionButton
        >
        <div class="liquid-lab-stage">
          <MotionPresence :preset="preset"
            ><div v-if="show" class="liquid-demo-notice">
              Konten tetap jelas, dengan overshoot dan settle yang lembut.
            </div></MotionPresence
          >
        </div>
      </section>
      <section class="panel">
        <h2>03 · Stagger & FLIP reflow</h2>
        <p>
          Urutan berubah melalui transform. Width, height, top, dan left tidak
          ditween.
        </p>
        <div class="liquid-preview-controls">
          <MotionButton @click="enterTiles">Putar stagger</MotionButton
          ><MotionButton @click="reorder" :aria-disabled="busy"
            >Geser urutan</MotionButton
          >
        </div>
        <div ref="tiles" class="liquid-demo-list">
          <div v-for="n in items" :key="n" class="liquid-demo-tile">
            Item {{ n }}
          </div>
        </div>
      </section>
      <section class="panel">
        <h2>04 · Shape morph</h2>
        <p>
          Dua bentuk dengan radius tetap bertukar melalui scale dan opacity.
          Teks tidak didistorsi.
        </p>
        <MotionButton @click="shape = !shape" :aria-pressed="shape"
          >Ubah bentuk</MotionButton
        >
        <div class="liquid-lab-stage">
          <MotionShape :active="shape" :preset="preset"
            ><strong>Satu gerak yang terhubung</strong></MotionShape
          >
        </div>
      </section>
      <section class="panel">
        <h2>05 · Organic gooey background</h2>
        <p>
          Satu momen dekoratif. Filter SVG nonaktif pada ponsel/reduced motion;
          konten utama tidak terkena filter.
        </p>
        <MotionButton @click="goo = !goo" :aria-pressed="goo"
          >Gerakkan blob</MotionButton
        >
        <div class="liquid-lab-stage"><LiquidGoo :active="goo" /></div>
      </section>
      <section class="panel">
        <h2>06 · Route transition</h2>
        <p>
          Preview transaksi navigasi. Coba API native atau fallback; alur
          assessment belum dipasangi transisi global.
        </p>
        <div class="liquid-preview-controls">
          <MotionButton @click="navigate(true)" :aria-disabled="busy"
            >Coba View Transitions</MotionButton
          ><MotionButton @click="navigate(false)" :aria-disabled="busy"
            >Coba fallback</MotionButton
          >
        </div>
        <div ref="routeTarget" class="liquid-route-preview">
          <h3>
            {{
              routeScene ? "Assessment terkirim" : "Assessment siap dikerjakan"
            }}
          </h3>
          <p>
            {{
              routeScene
                ? "Hasil menunggu rilis pengajar."
                : "Semua instruksi dan progres tetap tersedia."
            }}
          </p>
        </div>
        <p class="liquid-lab-meta" role="status">{{ routeStatus }}</p>
      </section>
      <section class="panel liquid-lab-wide">
        <h2>07 · Scroll reveal</h2>
        <p>
          Scroll untuk memunculkan panel. Fokus keyboard langsung menampilkan
          konten. Tanpa IntersectionObserver, konten tetap terlihat.
        </p>
        <MotionButton @click="resetReveals">Ulangi reveal</MotionButton>
        <div ref="revealRoot" class="liquid-reveal-list">
          <article v-for="n in [1, 2, 3]" :key="n" data-liquid-reveal>
            <h3>Panel reveal {{ n }}</h3>
            <p>
              Enter sekali, tanpa loop gerak terus-menerus dan tanpa mengubah
              tata letak.
            </p>
            <a href="#" @click.prevent class="btn small"
              >Uji fokus panel {{ n }}</a
            >
          </article>
        </div>
      </section>
    </div>
    <p class="notice">
      Halaman ini untuk review primitive. Pilihan mode dan preset hanya berlaku
      di Motion Lab; data assessment tidak diubah.
    </p>
  </div>
</template>
