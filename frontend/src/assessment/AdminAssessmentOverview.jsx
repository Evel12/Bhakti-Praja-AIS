import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw, ArrowLeftRight } from 'lucide-react'
import api, { getToken } from '../api'
import { apiClient, getStoredSession, getStoredToken } from '@assessment/services/apiClient.js'

function resolveAssessmentApiBase() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  if (env?.VITE_ASSESSMENT_API_BASE_URL) {
    return String(env.VITE_ASSESSMENT_API_BASE_URL).trim().replace(/\/+$/, '')
  }
  return '/assessment-api'
}

export default function AdminAssessmentOverview({ user }) {
  const [grades, setGrades] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [sourceType, setSourceType] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadGrades = useCallback(async (targetPage = page, targetType = sourceType) => {
    setLoading(true)
    setError('')
    try {
      const params = { page: targetPage, per_page: 15 }
      if (targetType) params.source_type = targetType
      const res = await api.get('/assessment-grades', { params })
      setGrades(Array.isArray(res.data?.data) ? res.data.data : [])
      setMeta(res.data?.meta || { current_page: 1, last_page: 1, total: 0 })
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat rekap nilai assessment.')
    } finally {
      setLoading(false)
    }
  }, [page, sourceType])

  useEffect(() => {
    let active = true
    const params = { page, per_page: 15 }
    if (sourceType) params.source_type = sourceType
    api.get('/assessment-grades', { params })
      .then((res) => {
        if (!active) return
        setGrades(Array.isArray(res.data?.data) ? res.data.data : [])
        setMeta(res.data?.meta || { current_page: 1, last_page: 1, total: 0 })
        setError('')
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.message || 'Gagal memuat rekap nilai assessment.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [page, sourceType])

  async function ensureAssessmentSession() {
    const base = resolveAssessmentApiBase()
    if (base) apiClient.setBaseUrl?.(base)
    const token = getStoredToken()
    const session = getStoredSession()
    if (token && !String(token).startsWith('local-') && session?.user?.email === user.email) {
      return
    }
    const aisToken = getToken()
    if (!aisToken) throw new Error('Token AIS tidak tersedia.')
    globalThis.__AIS_COMBINED_SHELL__ = true
    try {
      const exchanged = await apiClient.exchangeAisSession({
        ais_token: aisToken,
        device_name: 'ais-admin-sync',
      })
      if (exchanged?.token && exchanged?.user) {
        apiClient.setToken(exchanged.token)
        apiClient.setSession({
          user: { ...exchanged.user, aisRole: user.role },
          authMethod: 'ais-sso',
          apiConnected: true,
        })
      }
    } finally {
      delete globalThis.__AIS_COMBINED_SHELL__
    }
  }

  async function handleSyncRoster() {
    setSyncing('roster')
    setError('')
    setNotice('')
    try {
      await ensureAssessmentSession()
      const res = await apiClient.syncAisRoster()
      if (res?.synced === false) {
        setError('Tabel AIS belum tersedia di database layanan assessment.')
      } else {
        setNotice(
          `Sinkronisasi roster selesai: ${res?.classes_synced ?? 0} kelas dan ${res?.memberships_synced ?? 0} keanggotaan diperbarui.`,
        )
      }
    } catch (err) {
      setError(err?.message || 'Gagal menyinkronkan roster AIS ke layanan assessment.')
    } finally {
      setSyncing('')
    }
  }

  async function handleExportGrades() {
    setSyncing('grades')
    setError('')
    setNotice('')
    try {
      await ensureAssessmentSession()
      const res = await apiClient.exportAisGrades()
      setNotice(`Ekspor nilai selesai: ${res?.exported_count ?? 0} nilai dirilis diperbarui ke AIS.`)
      await loadGrades(1, sourceType)
      setPage(1)
    } catch (err) {
      setError(err?.message || 'Gagal mengekspor nilai dari layanan assessment.')
    } finally {
      setSyncing('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            MODE ASSESSMENT · ADMINISTRATOR
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Integrasi & Rekap Nilai Assessment
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Sinkronkan beban mengajar dan anggota kelas AIS ke ruang Assessment/LMS guru, lalu pantau nilai yang sudah dirilis. Pembuatan soal dan penilaian kelas tetap dikelola oleh akun Guru.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={syncing !== ''}
            onClick={handleSyncRoster}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowLeftRight size={16} />
            {syncing === 'roster' ? 'Menyinkronkan...' : 'Sinkronkan Roster AIS'}
          </button>
          <button
            type="button"
            disabled={syncing !== ''}
            onClick={handleExportGrades}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={16} />
            {syncing === 'grades' ? 'Mengekspor...' : 'Ekspor Nilai Rilis'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nilai Assessment Tersinkron</h2>
            <p className="text-xs text-slate-500">{meta.total} data nilai dirilis</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter jenis assessment"
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Semua jenis</option>
              <option value="quiz">Kuis</option>
              <option value="assignment">Tugas</option>
            </select>
            <button
              type="button"
              onClick={() => loadGrades(page, sourceType)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={15} />
              Muat ulang
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Memuat rekap nilai...</p>
        ) : !grades.length ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Belum ada nilai assessment dirilis yang tersinkron ke AIS.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-3">Siswa</th>
                  <th className="px-3 py-3">Kelas & Mapel</th>
                  <th className="px-3 py-3">Assessment</th>
                  <th className="px-3 py-3">Jenis</th>
                  <th className="px-3 py-3">Nilai</th>
                  <th className="px-3 py-3">Dirilis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grades.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{row.student?.name || '-'}</p>
                      <p className="text-xs text-slate-500">{row.student?.student_number || ''}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-slate-800">{row.classroom?.name || '-'}</p>
                      <p className="text-xs text-slate-500">{row.subject?.name || '-'}</p>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.title}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {row.source_type === 'assignment' ? 'Tugas' : 'Kuis'}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {row.score} / {row.max_score}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {row.released_at ? new Date(row.released_at).toLocaleString('id-ID') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.last_page > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
            <span className="text-slate-500">
              Halaman {meta.current_page} dari {meta.last_page}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={page >= meta.last_page || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
