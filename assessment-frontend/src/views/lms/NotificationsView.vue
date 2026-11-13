<script setup>
import { computed, onMounted, ref } from "vue";
import PageTitle from "../../components/ui/PageTitle.vue";
import Icon from "../../components/ui/Icon.vue";
import MotionButton from "../../components/motion/MotionButton.vue";
import MotionList from "../../components/motion/MotionList.vue";
import { useLmsStore } from "../../stores/lmsStore.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useUiStore } from "../../stores/uiStore.js";
import { useTabContentMotion } from "../../composables/useLmsMotion.js";
import { date } from "../../utils/format.js";

const lms = useLmsStore();
const auth = useAuthStore();
const ui = useUiStore();
const filterUnread = ref(false);
const listContainer = ref(null);

const visibleNotifications = computed(() =>
  filterUnread.value
    ? lms.notifications.filter((n) => !n.is_read)
    : lms.notifications,
);

const { stop: stopFilterMotion } = useTabContentMotion(listContainer, filterUnread);

onMounted(() => {
  lms.loadNotifications().catch(() => {});
});

async function handleMarkRead(item) {
  if (item.is_read) return;
  try {
    await lms.markNotificationRead(item.id);
    ui.toast("Notifikasi ditandai sudah dibaca.");
  } catch {
    ui.toast("Gagal memperbarui notifikasi.", true);
  }
}

async function handleMarkAllRead() {
  try {
    await lms.markAllNotificationsRead();
    ui.toast("Semua notifikasi ditandai sudah dibaca.");
  } catch {
    ui.toast("Gagal memperbarui notifikasi.", true);
  }
}
</script>

<template>
  <PageTitle title="Notifikasi LMS">
    <MotionButton
      variant="soft"
      :disabled="lms.unreadCount === 0"
      @click="handleMarkAllRead"
    >
      <Icon name="checkCircle" />
      Tandai semua dibaca ({{ lms.unreadCount }})
    </MotionButton>
  </PageTitle>

  <div class="lms-stack">
    <p v-if="!auth.apiConnected" class="notice">
      Masuk dengan akun terhubung API Backend untuk melihat notifikasi pengumuman, tugas, dan kuis terbaru.
    </p>

    <section class="panel" aria-label="Daftar notifikasi">
      <div class="filters">
        <div class="tabs" aria-label="Filter notifikasi">
          <button type="button" class="tab" :class="{ active: !filterUnread }" @click="filterUnread = false">
            Semua ({{ lms.notifications.length }})
          </button>
          <button type="button" class="tab" :class="{ active: filterUnread }" @click="filterUnread = true">
            Belum dibaca ({{ lms.unreadCount }})
          </button>
        </div>
      </div>

      <div
        ref="listContainer"
        class="lms-tab-body"
        @pointerdown="stopFilterMotion"
        @focusin="stopFilterMotion"
      >
        <div v-if="!visibleNotifications.length" class="empty">
          Tidak ada notifikasi untuk ditampilkan.
        </div>
        <MotionList v-else as="ul" class="lms-notif-list" :item-keys="visibleNotifications.map((n) => n.id)">
          <li
            v-for="item in visibleNotifications"
            :key="item.id"
            :data-motion-key="item.id"
            class="lms-notif-item"
            :class="{ unread: !item.is_read }"
          >
            <div>
              <div class="action-row">
                <strong>{{ item.title }}</strong>
                <span class="lms-pill" :class="item.is_read ? '' : 'is-dark'">
                  {{ item.is_read ? "Dibaca" : "Baru" }}
                </span>
              </div>
              <p class="lms-item-desc">{{ item.message }}</p>
              <p class="lms-item-meta">
                <span v-if="item.class_name">{{ item.class_name }} · </span>
                <span>{{ item.created_at ? date(item.created_at) : "" }}</span>
              </p>
            </div>
            <button
              v-if="!item.is_read"
              type="button"
              class="btn primary small"
              @click="handleMarkRead(item)"
            >
              <Icon name="check" />
              Tandai dibaca
            </button>
          </li>
        </MotionList>
      </div>
    </section>
  </div>
</template>
