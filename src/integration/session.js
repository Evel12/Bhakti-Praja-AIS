// The original standalone workspace remains available. Embedded mode always
// verifies the existing AIS token; query parameters never determine a role.
export const embedded = import.meta.env.BASE_URL === '/assessment-app/' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embedded') === '1');
export let sessionUser = null;
export async function initializeSession() {
  if (!embedded) return;
  const token = localStorage.getItem('ais_token');
  if (!token) throw new Error('Silakan masuk melalui aplikasi utama terlebih dahulu.');
  const response = await fetch('/api/auth/me', { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sesi telah berakhir. Silakan masuk kembali.' : 'Akun belum dapat diperiksa. Muat ulang untuk mencoba kembali.');
  const payload = await response.json();
  if (!payload.success || !['admin', 'guru', 'murid'].includes(payload.data?.role) || payload.data?.status !== 'active') throw new Error('Akun Anda tidak memiliki akses ke assessment.');
  sessionUser = payload.data;
  const expire = () => {
    if (localStorage.getItem('ais_token') !== token) window.location.reload();
  };
  window.addEventListener('storage', expire);
  window.addEventListener('focus', expire);
}
export function assessmentRouteAllowed(route) {
  if (!embedded) return true;
  if (!sessionUser) return false;
  return sessionUser.role === 'murid' ? !!route.meta.student : !route.meta.student && route.path !== '/motion-lab';
}
export const assessmentHome = () => sessionUser?.role === 'murid' ? '/student' : '/dashboard';
