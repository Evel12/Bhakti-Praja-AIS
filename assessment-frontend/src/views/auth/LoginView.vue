<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import AppBrand from "../../components/brand/AppBrand.vue";
import { useAuthStore } from "../../stores/authStore.js";

const router = useRouter();
const authStore = useAuthStore();

const email = ref(authStore.user?.email || "teacher@example.test");
const password = ref("DemoPassword123!");
const emailInput = ref(null);

function navigateAfterAuth(userRole) {
  if (userRole === "student") {
    router.push("/student");
  } else {
    router.push("/dashboard");
  }
}

async function handleEmailSubmit() {
  const result = await authStore.loginWithEmail({
    email: email.value,
    password: password.value,
  });
  if (result.ok) {
    navigateAfterAuth(result.user?.role || authStore.currentRole);
  }
}

function handleSsoClick() {
  authStore.triggerSsoPlaceholder();
  emailInput.value?.focus();
}

function fillDemoEmail(role) {
  authStore.error = "";
  authStore.notice = "";
  if (role === "student") {
    email.value = "student1@example.test";
    password.value = "DemoPassword123!";
  } else {
    email.value = "teacher@example.test";
    password.value = "DemoPassword123!";
  }
}
</script>

<template>
  <div class="auth-page-shell">
    <section class="auth-unified-card panel" aria-labelledby="login-heading">
      <div class="auth-card-brand">
        <AppBrand />
      </div>

      <div class="auth-form-header">
        <h1 id="login-heading">Masuk ke SMK Bhakti Praja Batang</h1>
        <p>Masukkan alamat email dan kata sandi akun Anda untuk melanjutkan.</p>
      </div>

      <div v-if="authStore.error" class="auth-alert is-error" role="alert">
        {{ authStore.error }}
      </div>
      <div v-if="authStore.notice" class="auth-alert is-success" role="status">
        {{ authStore.notice }}
      </div>

      <!-- Tombol SSO (Tulisan "SSO" saja sesuai spesifikasi Opsi A) -->
      <button
        type="button"
        class="auth-sso-btn"
        :disabled="authStore.loading"
        @click="handleSsoClick"
      >
        SSO
      </button>

      <div class="auth-divider">
        <span>atau masuk dengan email</span>
      </div>

      <!-- Form Login Email -->
      <form class="auth-email-form" @submit.prevent="handleEmailSubmit">
        <div class="auth-field">
          <label for="login-email" class="auth-field-label">Email</label>
          <input
            id="login-email"
            ref="emailInput"
            v-model="email"
            class="input auth-input"
            type="email"
            autocomplete="email"
            placeholder="teacher@example.test"
            required
          />
        </div>

        <div class="auth-field">
          <div class="auth-field-row">
            <label for="login-password" class="auth-field-label">Kata Sandi</label>
            <RouterLink to="/reset-password" class="auth-inline-link">
              Lupa kata sandi?
            </RouterLink>
          </div>
          <input
            id="login-password"
            v-model="password"
            class="input auth-input"
            type="password"
            autocomplete="current-password"
            placeholder="Masukkan kata sandi"
            required
          />
        </div>

        <button
          type="submit"
          class="btn primary auth-submit-btn"
          :disabled="authStore.loading"
        >
          {{ authStore.loading ? "Memproses..." : "Masuk dengan Email" }}
        </button>
      </form>

      <div class="auth-quick-demo">
        <span class="auth-quick-label">Akun Demo Email (`DemoPassword123!`):</span>
        <div class="auth-quick-pills">
          <button
            type="button"
            class="auth-quick-pill"
            @click="fillDemoEmail('teacher')"
          >
            Pengajar (teacher@example.test)
          </button>
          <button
            type="button"
            class="auth-quick-pill"
            @click="fillDemoEmail('student')"
          >
            Peserta (student1@example.test)
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.auth-page-shell {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(1.25rem, env(safe-area-inset-top))
    1rem
    max(1.5rem, env(safe-area-inset-bottom));
}

.auth-unified-card {
  width: 100%;
  max-width: 440px;
  padding: clamp(1.25rem, 5vw, 2rem);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.auth-card-brand {
  display: flex;
  align-items: center;
}

.auth-form-header h1 {
  margin: 0.25rem 0;
  font-size: clamp(1.3rem, 1.1rem + 1vw, 1.5rem);
}

.auth-form-header p {
  margin: 0;
  font-family: var(--font-content);
  font-size: 0.875rem;
  color: var(--muted);
}

.auth-alert {
  padding: 0.75rem 0.95rem;
  border-radius: 10px;
  font-family: var(--font-content);
  font-size: 0.8125rem;
  font-weight: 500;
}

.auth-alert.is-error {
  background: #fdeceb;
  color: #b42318;
  border: 1px solid #f2b8b5;
}

.auth-alert.is-success {
  background: #e6f4ec;
  color: #1f6b4f;
  border: 1px solid #a6d9be;
}

.auth-sso-btn {
  width: 100%;
  min-height: 48px;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid #1b365d;
  background: #1b365d;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-sso-btn:hover {
  background: #132847;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.auth-divider::before,
.auth-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #dce2d5;
}

.auth-email-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.auth-input {
  min-height: 48px;
  padding: 11px 14px;
}

.auth-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.auth-field-label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.auth-inline-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-block: -8px;
  padding-inline: 4px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1f6b4f;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.auth-submit-btn {
  width: 100%;
  min-height: 48px;
  justify-content: center;
  font-size: 0.875rem;
}

.auth-quick-demo {
  padding-top: 0.85rem;
  border-top: 1px dashed #dce2d5;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.auth-quick-label {
  font-size: 0.75rem;
  color: var(--muted);
}

.auth-quick-pills {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}

.auth-quick-pill {
  min-height: 44px;
  border: 1px solid #dce2d5;
  background: #f1f2eb;
  color: var(--ink);
  padding: 0.5rem 0.85rem;
  border-radius: 12px;
  font-family: var(--font-content);
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.auth-quick-pill:hover {
  border-color: #1f6b4f;
  color: #1f6b4f;
  background: #e6f4ec;
}
</style>
