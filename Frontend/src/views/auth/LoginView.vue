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
        <span class="eyebrow">Autentikasi Akun</span>
        <h1 id="login-heading">Masuk ke EXAMNIA</h1>
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
        <label class="auth-field">
          <span class="auth-field-label">Email</span>
          <input
            ref="emailInput"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="teacher@example.test"
            required
          />
        </label>

        <label class="auth-field">
          <div class="auth-field-row">
            <span class="auth-field-label">Kata Sandi</span>
            <RouterLink to="/reset-password" class="auth-inline-link">
              Lupa kata sandi?
            </RouterLink>
          </div>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Masukkan kata sandi"
            required
          />
        </label>

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
  min-height: calc(100dvh - 4rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
}

.auth-unified-card {
  width: 100%;
  max-width: 440px;
  padding: 2rem;
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
  font-size: 1.45rem;
}

.auth-form-header p {
  margin: 0;
  font-size: 0.86rem;
  color: var(--muted);
}

.auth-alert {
  padding: 0.75rem 0.95rem;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
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
  min-height: 44px;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid #1b365d;
  background: #1b365d;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.88rem;
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
  font-size: 0.72rem;
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
  gap: 0.85rem;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.auth-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.auth-field-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.auth-inline-link {
  font-size: 0.78rem;
  font-weight: 600;
  color: #1f6b4f;
  text-decoration: underline;
}

.auth-submit-btn {
  width: 100%;
  justify-content: center;
}

.auth-quick-demo {
  padding-top: 0.75rem;
  border-top: 1px dashed #dce2d5;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.auth-quick-label {
  font-size: 0.72rem;
  color: var(--muted);
}

.auth-quick-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.auth-quick-pill {
  border: 1px solid #dce2d5;
  background: #f1f2eb;
  color: var(--muted);
  padding: 0.32rem 0.65rem;
  border-radius: 99px;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
}

.auth-quick-pill:hover {
  border-color: #1f6b4f;
  color: #1f6b4f;
  background: #e6f4ec;
}

.auth-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.65rem;
  border-top: 1px solid #dce2d5;
  font-size: 0.78rem;
}

.auth-back-link {
  color: var(--muted);
  font-weight: 600;
  text-decoration: none;
}

.auth-back-link:hover {
  color: var(--ink);
  text-decoration: underline;
}

.auth-logout-link {
  border: none;
  background: transparent;
  color: #b42318;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}
</style>
