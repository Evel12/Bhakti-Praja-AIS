import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, me } from "../api";
import { errorText } from '../finance/finance';
import {
    BookOpen,
    CheckCircle2,
    ExternalLink,
    Eye,
    EyeOff,
    Globe,
    GraduationCap,
    Pencil,
    RotateCcw,
    ShieldCheck,
} from 'lucide-react';
import { useSchool } from '../school-context';
import {
    clearStoredAssessmentUrl,
    getStoredAssessmentUrl,
    saveStoredAssessmentUrl,
} from '../webTargets';

export default function Login({ onLogin, notice = '' }) {
    const school = useSchool();
    const navigate = useNavigate();

    const [assessmentTarget, setAssessmentTarget] = useState(() => getStoredAssessmentUrl());
    const [editingUrl, setEditingUrl] = useState(false);
    const [urlDraft, setUrlDraft] = useState('');
    const [urlError, setUrlError] = useState('');
    const [urlNotice, setUrlNotice] = useState('');
    const [redirecting, setRedirecting] = useState(false);

    const assessmentUrl = assessmentTarget.url;
    const isCustomUrl = assessmentTarget.isCustom;

    const [form, setForm] = useState({
        email: "",
        password: "",
        portal: "ais",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(notice);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.addEventListener) {
            return undefined;
        }
        const handlePageShow = () => setRedirecting(false);
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    }

    function handleStayOnAis() {
        setEditingUrl(false);
        setUrlError('');
        setUrlNotice('');
    }

    function handleStartEditUrl() {
        setUrlDraft(assessmentUrl);
        setUrlError('');
        setUrlNotice('');
        setEditingUrl(true);
    }

    function handleCancelEditUrl() {
        setUrlDraft(assessmentUrl);
        setUrlError('');
        setEditingUrl(false);
    }

    function handleSaveUrl(e) {
        e.preventDefault();
        const saved = saveStoredAssessmentUrl(urlDraft);
        if (!saved.valid) {
            setUrlError(saved.error);
            return;
        }
        setAssessmentTarget(getStoredAssessmentUrl());
        setUrlDraft(saved.url);
        setUrlError('');
        setEditingUrl(false);
        setUrlNotice('URL tujuan Web Assessment berhasil diperbarui.');
    }

    function handleResetUrl() {
        const defaultUrl = clearStoredAssessmentUrl();
        setAssessmentTarget({ url: defaultUrl, isCustom: false });
        setUrlDraft(defaultUrl);
        setUrlError('');
        setEditingUrl(false);
        setUrlNotice('URL tujuan Web Assessment dikembalikan ke pengaturan default.');
    }

    function handleOpenAssessment() {
        if (redirecting) return;
        setRedirecting(true);
        window.location.assign(assessmentUrl);
    }

    async function handleSubmit(e) {
        e.preventDefault();

        setLoading(true);
        setError("");

        try {
            await login(form);

            const profile = await me();
            const destination = form.portal === 'communication' ? '/communication' : '/';

            if (onLogin) {
                onLogin(profile.data, destination);
            }

            navigate(destination);
        } catch (err) {
            setError(err?.response?.status === 401 ? 'Email atau kata sandi salah.' : errorText(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
            <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
                <div className="hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
                    <div className="flex items-center gap-3 text-sm font-semibold"><GraduationCap size={28} /> {school.name}</div>
                    <div className="my-16"><p className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-teal-200">Core Academic Information System</p><h2 className="text-4xl font-bold leading-tight">Administrasi rapi.<br />Akademik terintegrasi.</h2><p className="mt-6 leading-7 text-teal-100/80">Kelola data sekolah, periode belajar, dan administrasi akademik dari satu ruang kerja.</p></div>
                    <div><p className="flex items-center gap-2 text-sm text-teal-100"><ShieldCheck size={18} /> NPSN {school.npsn}</p><p className="mt-3 text-xs leading-5 text-teal-100/80">{school.address}</p></div>
                </div>
                <div className="p-8 sm:p-12">
                    <div className="mb-7">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                
                            </span>
                            <div className="flex items-center gap-1.5">
                                {isCustomUrl && (
                                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                                        Kustom
                                    </span>
                                )}
                            </div>
                        </div>
                        <div
                            role="group"
                            aria-label="Pilih web tujuan"
                            className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1"
                        >
                            <button
                                type="button"
                                aria-pressed={true}
                                onClick={handleStayOnAis}
                                className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition"
                            >
                                <GraduationCap size={17} />
                                <span>Web AIS</span>
                            </button>
                            <button
                                type="button"
                                aria-pressed={false}
                                disabled={redirecting}
                                onClick={handleOpenAssessment}
                                title={`Langsung buka Web Assessment (${assessmentUrl})`}
                                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-900 hover:shadow-sm disabled:cursor-wait disabled:opacity-60"
                            >
                                <BookOpen size={17} />
                                <span>{redirecting ? 'Mengalihkan...' : 'Web Assessment'}</span>
                                <ExternalLink size={14} className="text-slate-400" />
                            </button>
                        </div>

                        {urlNotice && !editingUrl && (
                            <div role="status" className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
                                {urlNotice}
                            </div>
                        )}

                        {editingUrl && (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-700">Alamat Web Assessment</span>
                                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                        {isCustomUrl ? 'Kustom' : 'Default'}
                                    </span>
                                </div>
                                <form onSubmit={handleSaveUrl} className="space-y-2.5">
                                    <div>
                                        <label htmlFor="assessment-target-url" className="sr-only">
                                            URL Web Assessment
                                        </label>
                                        <input
                                            id="assessment-target-url"
                                            type="text"
                                            inputMode="url"
                                            value={urlDraft}
                                            onChange={(e) => {
                                                setUrlDraft(e.target.value);
                                                setUrlError('');
                                            }}
                                            placeholder="http://127.0.0.1/"
                                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500"
                                        />
                                    </div>
                                    {urlError && (
                                        <p role="alert" className="text-xs font-medium text-red-600">
                                            {urlError}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="submit"
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                                        >
                                            <CheckCircle2 size={14} />
                                            <span>Simpan URL</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelEditUrl}
                                            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                            Batal
                                        </button>
                                        {isCustomUrl && (
                                            <button
                                                type="button"
                                                onClick={handleResetUrl}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                            >
                                                <RotateCcw size={14} />
                                                <span>Reset Default</span>
                                            </button>
                                        )}
                                    </div>
                                </form>
                                <p className="mt-2.5 text-[11px] leading-4 text-slate-500">
                                    Saat tombol <strong>Web Assessment</strong> ditekan, halaman langsung berpindah ke alamat ini.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mb-8">
                        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                            <GraduationCap size={26} />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Selamat datang kembali</h1>

                        <p className="text-gray-500 mt-2">Sistem Akademik {school.name}</p>
                    </div>
                    {error && (
                        <div role="alert" className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="portal" className="block text-sm font-medium text-gray-700 mb-2">Layanan</label>
                            <select id="portal" name="portal" value={form.portal} onChange={handleChange} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-teal-500">
                                <option value="ais">Administrasi akademik</option>
                                <option value="member4">Portal wali dan keuangan pendidikan</option>
                                <option value="communication">Komunikasi sekolah (semua peran)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Email
                            </label>

                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="admin@akademik.test"
                                required
                                autoComplete="email"
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Kata Sandi
                            </label>

                            <div className="relative"><input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="Masukkan kata sandi"
                                required
                                autoComplete="current-password"
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 outline-none focus:border-teal-500"
                            />
                            <button type="button" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? "Memproses..." : "Masuk"}
                        </button>
                    </form>

                    {import.meta.env.DEV && <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-gray-600">
                        <p className="font-medium text-gray-700">
                            Akun demo admin
                        </p>
                        <p>Email: admin@akademik.test</p>
                        <p>Kata sandi: admin123</p>
                    </div>}
                </div>
            </div>
        </div>
    );
}
