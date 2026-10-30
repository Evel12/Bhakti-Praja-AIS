import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, me } from "../api";
import { GraduationCap, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useSchool } from '../school-context';

export default function Login({ onLogin }) {
    const school = useSchool();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();

        setLoading(true);
        setError("");

        try {
            await login(form.email, form.password);

            const profile = await me();

            if (onLogin) {
                onLogin(profile.data);
            }

            navigate("/");
        } catch (err) {
            const backendErrors = err?.response?.data?.errors;
            const firstError = backendErrors
                ? Object.values(backendErrors).flat()[0]
                : null;

            setError(
                firstError ||
                    err?.response?.data?.message ||
                    "Masuk gagal. Periksa email dan kata sandi."
            );
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
                    <div className="mb-8">
                        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><GraduationCap size={26} /></div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Selamat datang kembali
                        </h1>

                        <p className="text-gray-500 mt-2">
                            Sistem Akademik {school.name}
                        </p>
                    </div>

                    {error && (
                        <div role="alert" className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
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
