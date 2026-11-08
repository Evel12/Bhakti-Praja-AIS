<script setup>
import { ref } from "vue";
import AppBrand from "../../components/brand/AppBrand.vue";
import { useAuthStore } from "../../stores/authStore.js";

const authStore = useAuthStore();

const step = ref("request");
const email = ref(authStore.user?.email || "teacher@example.test");
const resetToken = ref("");
const password = ref("");
const passwordConfirmation = ref("");

async function handleRequestReset() {
  const res = await authStore.requestPasswordReset(email.value);
  if (res.ok) {
    step.value = "confirm";
  }
}

async function handleConfirmReset() {
  await authStore.confirmPasswordReset({
    email: email.value,
    resetToken: resetToken.value,
    password: password.value,
    passwordConfirmation: passwordConfirmation.value,
  });
}
</script>

<template>
  <div class="reset-page-shell">
    <section class="reset-card panel">
      <AppBrand />

      <div class="reset-header">
        <span class="eyebrow">SRS-02 &bull; Password Recovery</span>
        <h1>Reset Kata Sandi</h1>
        <p>
          Untuk akun <strong>SSO Institusi</strong>, pemulihan kata sandi dikelola melalui Helpdesk TI Sekolah.
          Untuk akun <strong>Email Akademik</strong>, kirim tautan pemulihan di bawah ini.
        </p>
      </div>

      <div v-if="authStore.error" class="reset-alert is-error" role="alert">
        {{ authStore.error }}
      </div>
      <div v-if="authStore.notice" class="reset-alert is-success" role="status">
        {{ authStore.notice }}
      </div>

      <div class="reset-mode-switch">
        <button
          type="button"
          class="reset-mode-btn"
          :class="{ 'is-active': step === 'request' }"
          @click="step = 'request'"
        >
          1. Minta Token Reset
        </button>
        <button
          type="button"
          class="reset-mode-btn"
          :class="{ 'is-active': step === 'confirm' }"
          @click="step = 'confirm'"
        >
          2. Masukkan Kata Sandi Baru
        </button>
      </div>

      <form v-if="step === 'request'" class="reset-form" @submit.prevent="handleRequestReset">
        <label class="reset-field">
          <span>Email Terdaftar</span>
          <input v-model="email" class="input reset-input" type="email" autocomplete="email" required />
        </label>

        <button type="submit" class="btn primary reset-submit-btn" :disabled="authStore.loading">
          {{ authStore.loading ? "Mengirim..." : "Kirim Tautan Pemulihan" }}
        </button>
      </form>

      <form v-else class="reset-form" @submit.prevent="handleConfirmReset">
        <label class="reset-field">
          <span>Email Terdaftar</span>
          <input v-model="email" class="input reset-input" type="email" autocomplete="email" required />
        </label>

        <label class="reset-field">
          <span>Token Reset Kata Sandi</span>
          <input v-model="resetToken" class="input reset-input" type="text" autocomplete="one-time-code" placeholder="Tempel token dari email" required />
        </label>

        <label class="reset-field">
          <span>Kata Sandi Baru (Min. 8 karakter)</span>
          <input v-model="password" class="input reset-input" type="password" autocomplete="new-password" required />
        </label>

        <label class="reset-field">
          <span>Konfirmasi Kata Sandi Baru</span>
          <input v-model="passwordConfirmation" class="input reset-input" type="password" autocomplete="new-password" required />
        </label>

        <button type="submit" class="btn primary reset-submit-btn" :disabled="authStore.loading">
          {{ authStore.loading ? "Menyimpan..." : "Simpan Kata Sandi Baru" }}
        </button>
      </form>

      <div class="reset-footer">
        <RouterLink to="/login" class="btn reset-back-btn">
          &larr; Kembali ke Halaman Masuk
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.reset-page-shell {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(1.25rem, env(safe-area-inset-top))
    1rem
    max(1.5rem, env(safe-area-inset-bottom));
}

.reset-card {
  width: 100%;
  max-width: 500px;
  padding: clamp(1.25rem, 5vw, 2rem);
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.reset-header h1 {
  font-size: clamp(1.35rem, 1.15rem + 1vw, 1.55rem);
  margin: 0.25rem 0;
}

.reset-header p {
  margin: 0;
  font-family: var(--font-content);
  font-size: 0.875rem;
  color: var(--muted);
}

.reset-alert {
  padding: 0.75rem 0.95rem;
  border-radius: 10px;
  font-family: var(--font-content);
  font-size: 0.8125rem;
  font-weight: 500;
}

.reset-alert.is-error {
  background: #fdeceb;
  color: #b42318;
  border: 1px solid #f2b8b5;
}

.reset-alert.is-success {
  background: #e6f4ec;
  color: #1f6b4f;
  border: 1px solid #a6d9be;
}

.reset-mode-switch {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 175px), 1fr));
  gap: 0.4rem;
  background: #f1f2eb;
  padding: 0.3rem;
  border-radius: 12px;
}

.reset-mode-btn {
  min-height: 44px;
  border: none;
  background: transparent;
  padding: 0.55rem 0.75rem;
  border-radius: 9px;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--muted);
  cursor: pointer;
}

.reset-mode-btn.is-active {
  background: #fffefa;
  color: var(--ink);
  box-shadow: 0 2px 6px #26332012;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.reset-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
}

.reset-input {
  min-height: 48px;
  padding: 11px 14px;
}

.reset-submit-btn,
.reset-back-btn {
  width: 100%;
  min-height: 48px;
  justify-content: center;
}

.reset-footer {
  display: flex;
  justify-content: stretch;
  border-top: 1px solid #dce2d5;
  padding-top: 0.85rem;
}
</style>
