import { createContext, useContext } from 'react'

export const schoolFallback = {
  name: 'SMK Bhakti Praja Batang', short_name: 'SMK Bhakti Praja', npsn: '20322714',
  sources: [], programs: [],
  curriculum_note: 'Kurikulum referensi belum disahkan sekolah. Lengkapi KOSP dan alokasi JP sebelum digunakan.',
}
export const SchoolContext = createContext(schoolFallback)
export function useSchool() { return useContext(SchoolContext) }
