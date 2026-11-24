'use client';

import React from 'react';
import { ArrowLeft, X, Clock, CheckCircle, FileText, Plus, Upload, Crown } from 'lucide-react';
import { isMentorProfession, normalizeExpertGroupName } from '@/lib/expert-roles';
import { EXPERT_SUBSCRIPTION_MONTHLY_UZS, formatUzs } from '@/lib/subscription';

export type ProfileExpertModalProps = {
    t: (...args: any[]) => string;
    verifiedStatus: 'none' | 'pending' | 'approved' | 'rejected';
    onClose: () => void;
    profession: string;
    setProfession: (v: string) => void;
    professionRef: React.RefObject<HTMLSelectElement | null>;
    specializationDetails: string;
    setSpecializationDetails: (v: string) => void;
    specializationRef: React.RefObject<HTMLInputElement | null>;
    expertErrors: {
        profession?: string;
        specialization?: string;
        resume?: string;
        groups?: string;
    };
    expertFormPh: { direction: string; listing: string; [k: string]: string };
    resumeRef: React.RefObject<HTMLInputElement | null>;
    resumeUrl: string;
    handleDocumentUpload: (key: string, file: File) => void;
    serviceLanguages: string;
    setServiceLanguages: (v: string) => void;
    availableGroupsLoading: boolean;
    newGroupName: string;
    setNewGroupName: (v: string) => void;
    expertGroups: { id: string; name: string; time: string; chatId?: string }[];
    setExpertGroups: (v: { id: string; name: string; time: string; chatId?: string }[]) => void;
    availableGroups: { id: string; name: string; time: string; chatId?: string }[];
    specialtyDesc: string;
    setSpecialtyDesc: (v: string) => void;
    bioExpert: string;
    setBioExpert: (v: string) => void;
    onSave: () => void;
};

/* Web Sozlamalar oynasi bilan bir xil uslub (ProfileViewer → renderSettings). */
const fieldCls = (hasError?: string) =>
    `w-full bg-transparent rounded-xl py-3 px-3.5 text-[15px] text-white placeholder:text-[#6d7f8f] focus:outline-none border transition-colors ${
        hasError ? 'border-[#e53935]' : 'border-white/[0.12] hover:border-white/25 focus:border-[#8774e1]'
    }`;

const labelCls = 'block text-[13px] text-[#6d7f8f] mb-1.5';

/** Telegram uslubidagi bo'lim: binafsha sarlavha + kontent */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="px-5 pt-3 pb-4">
            <p className="pb-3 text-[14px] font-medium text-[#8774e1]">{title}</p>
            {children}
        </section>
    );
}

const SectionGap = () => <div className="h-3 bg-[#0f0f0f]" />;

function FieldError({ text }: { text?: string }) {
    if (!text) return null;
    return <p className="mt-1.5 text-[13px] text-[#e53935]">{text}</p>;
}

/**
 * Mutaxassis profili (web).
 * Xizmat har doim onlayn; diplom va tajriba alohida so'ralmaydi — ular rezyumeda.
 * Rezyume majburiy. Oylik obuna narxi ko'rsatiladi.
 */
export function ProfileExpertModal({
    t,
    verifiedStatus,
    onClose,
    profession,
    setProfession,
    professionRef,
    specializationDetails,
    setSpecializationDetails,
    specializationRef,
    expertErrors,
    expertFormPh,
    resumeRef,
    resumeUrl,
    handleDocumentUpload,
    serviceLanguages,
    setServiceLanguages,
    availableGroupsLoading,
    newGroupName,
    setNewGroupName,
    expertGroups,
    setExpertGroups,
    availableGroups,
    specialtyDesc,
    setSpecialtyDesc,
    bioExpert,
    setBioExpert,
    onSave,
}: ProfileExpertModalProps) {
    return (
        <div
            className="absolute inset-0 z-[110] flex items-center justify-center lg:p-4"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="expert-profile-title"
                className="w-full h-full lg:h-auto lg:max-w-[420px] flex flex-col lg:max-h-[85vh] overflow-hidden rounded-none lg:rounded-2xl bg-[#212121] text-white shadow-[0_2px_16px_rgba(0,0,0,0.45)] border border-white/[0.06] animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — Sozlamalar ichki sahifasi kabi: orqaga + sarlavha + yopish */}
                <div className="flex min-h-12 items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => onClose()}
                        className="p-2.5 min-h-[44px] min-w-[44px] rounded-full text-[#aaaaaa] hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center"
                        aria-label={t('back')}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h2 id="expert-profile-title" className="min-w-0 flex-1 truncate font-medium text-[20px]">
                        {t('specialist_profile')}
                    </h2>
                    <button
                        type="button"
                        onClick={() => onClose()}
                        className="p-2.5 min-h-[44px] min-w-[44px] rounded-full text-[#aaaaaa] hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center"
                        aria-label={t('cancel')}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {/* Holat yoki qisqa izoh */}
                    {verifiedStatus === 'pending' || verifiedStatus === 'approved' ? (
                        <div
                            className={`mx-5 mb-3 px-3 py-2.5 rounded-xl flex items-start gap-2.5 ${
                                verifiedStatus === 'pending'
                                    ? 'bg-amber-500/10 border border-amber-500/20'
                                    : 'bg-emerald-500/10 border border-emerald-500/20'
                            }`}
                        >
                            {verifiedStatus === 'pending' ? (
                                <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                            ) : (
                                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                                <p className={`text-[14px] font-medium ${verifiedStatus === 'pending' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {verifiedStatus === 'pending' ? t('wait_admin_generic') : t('verified')}
                                </p>
                                {verifiedStatus === 'pending' && (
                                    <p className="text-[13px] text-[#6d7f8f] mt-0.5">{t('expert_pending_desc')}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="px-5 pb-3 text-[14px] text-[#6d7f8f] leading-relaxed">{t('expert_form_intro')}</p>
                    )}

                    <SectionGap />

                    {/* Yo'nalish */}
                    <Section title={t('expert_section_main')}>
                        <div className="space-y-3">
                            <div>
                                <label className={labelCls}>{t('profession_type')}</label>
                                <select
                                    ref={professionRef}
                                    value={profession}
                                    onChange={(e) => setProfession(e.target.value)}
                                    className={`${fieldCls(expertErrors.profession)} appearance-none`}
                                >
                                    <option value="" className="bg-[#212121]">
                                        {t('select')}...
                                    </option>
                                    <optgroup label="Ta'lim va Mentorlik" className="bg-[#212121]">
                                        <option value="O'qituvchi">O&apos;qituvchi (Mentor)</option>
                                        <option value="Mentor">Mentor (Biznes/Shaxsiy)</option>
                                        <option value="Startap mentori">Startap mentori</option>
                                        <option value="Dasturchi mentor">Dasturchi mentor</option>
                                    </optgroup>
                                    <optgroup label="Huquq sohasi" className="bg-[#212121]">
                                        <option value="Advokat">Advokat</option>
                                        <option value="Yurist">Yurist</option>
                                        <option value="Notarius maslahatchi">Notarius maslahatchi</option>
                                        <option value="Soliq maslahatchisi">Soliq maslahatchisi</option>
                                        <option value="Mehnat huquqi eksperti">Mehnat huquqi eksperti</option>
                                        <option value="Migratsiya maslahatchisi">Migratsiya maslahatchisi</option>
                                    </optgroup>
                                    <optgroup label="Psixologiya" className="bg-[#212121]">
                                        <option value="Klinik psixolog">Klinik psixolog</option>
                                        <option value="Oila psixologi">Oila psixologi</option>
                                        <option value="Bolalar psixologi">Bolalar psixologi</option>
                                        <option value="Psixoterapevt">Psixoterapevt</option>
                                        <option value="Stress / depressiya mutaxassisi">Stress / depressiya mutaxassisi</option>
                                        <option value="Career coach">Career coach</option>
                                    </optgroup>
                                    <optgroup label="Biznes va moliya" className="bg-[#212121]">
                                        <option value="Biznes konsultant">Biznes konsultant</option>
                                        <option value="Marketing strateg">Marketing strateg</option>
                                        <option value="SMM mutaxassis">SMM mutaxassis</option>
                                        <option value="Moliyaviy maslahatchi">Moliyaviy maslahatchi</option>
                                        <option value="Investitsiya eksperti">Investitsiya eksperti</option>
                                    </optgroup>
                                    <option value="Other" className="bg-[#212121]">
                                        Boshqa
                                    </option>
                                </select>
                                <FieldError text={expertErrors.profession} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('specialization_req')}</label>
                                <input
                                    ref={specializationRef}
                                    value={specializationDetails}
                                    onChange={(e) => setSpecializationDetails(e.target.value)}
                                    placeholder={expertFormPh.direction}
                                    className={fieldCls(expertErrors.specialization)}
                                />
                                <FieldError text={expertErrors.specialization} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('languages')}</label>
                                <input
                                    value={serviceLanguages}
                                    onChange={(e) => setServiceLanguages(e.target.value)}
                                    placeholder={t('languages_list')}
                                    className={fieldCls()}
                                />
                            </div>
                        </div>
                    </Section>

                    <SectionGap />

                    {/* Rezyume — majburiy */}
                    <Section title={t('expert_section_resume')}>
                        <button
                            type="button"
                            onClick={() => resumeRef.current?.click()}
                            className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl border border-dashed transition-colors text-left ${
                                expertErrors.resume
                                    ? 'border-[#e53935] bg-[#e53935]/5'
                                    : resumeUrl
                                      ? 'bg-emerald-500/[0.08] border-emerald-500/40'
                                      : 'border-white/[0.15] hover:border-[#8774e1] hover:bg-white/[0.03]'
                            }`}
                        >
                            <span
                                className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${
                                    expertErrors.resume
                                        ? 'bg-red-500/15 text-red-400'
                                        : resumeUrl
                                          ? 'bg-emerald-500/15 text-emerald-400'
                                          : 'bg-[#8774e1]/15 text-[#8774e1]'
                                }`}
                            >
                                {resumeUrl ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className={`block text-[15px] font-medium ${resumeUrl ? 'text-emerald-400' : 'text-white'}`}>
                                    {resumeUrl ? t('expert_resume_uploaded') : t('expert_resume_upload')}
                                </span>
                                <span className="block text-[13px] text-[#6d7f8f] mt-0.5">
                                    {resumeUrl ? t('expert_resume_replace') : 'PDF'}
                                </span>
                            </span>
                        </button>
                        <input
                            type="file"
                            ref={resumeRef as React.RefObject<HTMLInputElement>}
                            className="hidden"
                            accept=".pdf"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleDocumentUpload('resume', file);
                            }}
                        />
                        <FieldError text={expertErrors.resume} />
                        <p className="mt-2 text-[13px] text-[#6d7f8f] leading-snug">{t('expert_resume_hint')}</p>
                    </Section>

                    <SectionGap />

                    {/* Mentor guruhlari */}
                    {isMentorProfession(profession) && (
                        <section className="px-5 pt-3 pb-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-[14px] font-medium text-[#8774e1]">
                                    {t('mentor_groups_title')}
                                </h4>
                                {availableGroupsLoading && (
                                    <span className="text-[10px] text-[#b3a6f5]">{t('loading')}</span>
                                )}
                            </div>

                            <div className="flex gap-1.5">
                                <input
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder={t('add_group_placeholder')}
                                    className={`${fieldCls()} flex-1`}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter') return;
                                        e.preventDefault();
                                        const name = newGroupName.trim();
                                        if (!name) return;
                                        const key = normalizeExpertGroupName(name);
                                        if (
                                            expertGroups.some(
                                                (g) => normalizeExpertGroupName(g.name) === key
                                            )
                                        ) {
                                            setNewGroupName('');
                                            return;
                                        }
                                        const existing = availableGroups.find(
                                            (ag) => normalizeExpertGroupName(ag.name) === key
                                        );
                                        setExpertGroups([
                                            ...expertGroups,
                                            existing
                                                ? {
                                                      id: String(existing.chatId || existing.id),
                                                      name: existing.name,
                                                      time: existing.time || '',
                                                      chatId: String(existing.chatId || existing.id),
                                                  }
                                                : {
                                                      id: Date.now().toString(),
                                                      name,
                                                      time: '',
                                                  },
                                        ]);
                                        setNewGroupName('');
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const name = newGroupName.trim();
                                        if (!name) return;
                                        const key = normalizeExpertGroupName(name);
                                        if (
                                            expertGroups.some(
                                                (g) => normalizeExpertGroupName(g.name) === key
                                            )
                                        ) {
                                            setNewGroupName('');
                                            return;
                                        }
                                        const existing = availableGroups.find(
                                            (ag) => normalizeExpertGroupName(ag.name) === key
                                        );
                                        setExpertGroups([
                                            ...expertGroups,
                                            existing
                                                ? {
                                                      id: String(existing.chatId || existing.id),
                                                      name: existing.name,
                                                      time: existing.time || '',
                                                      chatId: String(existing.chatId || existing.id),
                                                  }
                                                : {
                                                      id: Date.now().toString(),
                                                      name,
                                                      time: '',
                                                  },
                                        ]);
                                        setNewGroupName('');
                                    }}
                                    className="bg-[#8774e1]/15 text-[#8774e1] hover:bg-[#8774e1] hover:text-white px-3.5 rounded-xl border border-[#8774e1]/30 transition-all shrink-0"
                                    aria-label={t('add')}
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-1">
                                {expertGroups.map((g) => (
                                    <div
                                        key={g.id}
                                        className="flex items-center justify-between px-3.5 py-2.5 border border-white/[0.12] rounded-xl"
                                    >
                                        <span className="text-sm font-medium text-white truncate">{g.name}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpertGroups(expertGroups.filter((x) => x.id !== g.id))
                                            }
                                            className="text-red-400/50 hover:text-red-400 p-1"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {expertGroups.length === 0 && (
                                    <div className="text-center py-3 text-[13px] text-[#6d7f8f] border border-dashed border-white/[0.12] rounded-xl">
                                        {t('at_least_one_group')}
                                    </div>
                                )}
                            </div>

                            {availableGroups.length > 0 && (
                                <div className="space-y-1 pt-2">
                                    <p className="text-[13px] text-[#6d7f8f]">{t('add_from_existing')}</p>
                                    {availableGroups
                                        .filter(
                                            (ag) =>
                                                !expertGroups.some(
                                                    (g) => g.chatId === ag.chatId || g.id === ag.id
                                                )
                                        )
                                        .map((ag) => (
                                            <button
                                                key={ag.id}
                                                type="button"
                                                onClick={() => {
                                                    setExpertGroups([
                                                        ...expertGroups,
                                                        {
                                                            id: ag.id,
                                                            name: ag.name,
                                                            time: '',
                                                            chatId: ag.chatId || ag.id,
                                                        },
                                                    ]);
                                                }}
                                                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/[0.12] hover:bg-white/[0.04] hover:border-[#8774e1]/50 transition-all"
                                            >
                                                <span className="text-sm text-white truncate">{ag.name}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8774e1]/20 text-[#b3a6f5] font-semibold">
                                                    {t('add')}
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </section>
                    )}
                    {isMentorProfession(profession) && <SectionGap />}

                    {/* Siz haqingizda */}
                    <Section title={t('expert_section_about')}>
                        <div className="space-y-3">
                            <div>
                                <label className={labelCls}>{t('specialty_offer_label')}</label>
                                <textarea
                                    value={specialtyDesc}
                                    onChange={(e) => setSpecialtyDesc(e.target.value)}
                                    placeholder={expertFormPh.listing}
                                    rows={3}
                                    className={`${fieldCls()} min-h-[84px] resize-y`}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>{t('bio')}</label>
                                <textarea
                                    value={bioExpert}
                                    onChange={(e) => setBioExpert(e.target.value)}
                                    placeholder={t('bio_expert_placeholder')}
                                    rows={2}
                                    className={`${fieldCls()} min-h-[64px] resize-y`}
                                />
                            </div>
                        </div>
                    </Section>

                    <SectionGap />

                    {/* Obuna — Sozlamalar qatori uslubida */}
                    <div className="flex items-center gap-4 px-5 py-3.5">
                        <Crown className="h-5 w-5 text-[#8774e1] shrink-0 ml-1" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[16px] text-white">{t('expert_subscription_title')}</p>
                            <p className="text-[13px] text-[#6d7f8f] mt-0.5 leading-snug">{t('expert_subscription_desc')}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[16px] font-medium text-white tabular-nums">
                                {formatUzs(EXPERT_SUBSCRIPTION_MONTHLY_UZS)}
                            </p>
                            <p className="text-[12px] text-[#6d7f8f]">{t('expert_subscription_period')}</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/[0.06]">
                    <button
                        type="button"
                        onClick={onSave}
                        className="w-full py-3 rounded-xl text-[16px] font-medium text-white bg-[#8774e1] hover:bg-[#7a67d4] transition-colors"
                    >
                        {t('send')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProfileExpertModal;
