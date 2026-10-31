import { useEffect, useState } from 'react'
import { errorText, financeApi } from '../finance/finance'

export const academicSections = {
  grades: { title: 'Nilai Akademik', description: 'Nilai pembelajaran yang telah tersedia untuk dilihat oleh wali.' },
  attendance: { title: 'Absensi', description: 'Riwayat dan informasi kehadiran anak.' },
  assignments: { title: 'Tugas', description: 'Tugas, tenggat, dan status pengumpulan yang tersedia.' },
  progress: { title: 'Perkembangan Akademik', description: 'Pantau perkembangan belajar melalui informasi akademik yang tersedia.' },
}
export const studentStatuses = { active: 'Aktif', inactive: 'Nonaktif', graduated: 'Lulus', transferred: 'Pindah' }
export const days = { monday: 'Senin', tuesday: 'Selasa', wednesday: 'Rabu', thursday: 'Kamis', friday: 'Jumat', saturday: 'Sabtu', sunday: 'Minggu' }
export function parentLink(path = '', studentId) {
  return `/parent${path ? `/${path}` : ''}${studentId ? `?student_id=${encodeURIComponent(studentId)}` : ''}`
}

export function useParentChildren() {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    let active = true
    async function load() {
      const children = []
      let page = 1, last = 1
      do {
        const response = await financeApi.get(`parent/children?page=${page}&per_page=100`)
        children.push(...response.data)
        last = response.meta.last_page
        page++
      } while (page <= last && active)
      return { data: children }
    }
    load().then(data => { if (active) setResult({ revision, data }) })
      .catch(error => { if (active) setResult({ revision, error: errorText(error) }) })
    return () => { active = false }
  }, [revision])
  const current = result?.revision === revision ? result : null
  return { loading: !current, data: current?.data, error: current?.error, reload: () => setRevision(n => n + 1) }
}
