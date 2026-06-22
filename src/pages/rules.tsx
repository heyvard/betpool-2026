import type { NextPage } from 'next'

import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseAllBets } from '../queries/useAllBets'
import { Calculator, ChevronDown, Clock, Flag, Info, Sparkles, Star, Trophy, Wallet, Zap } from 'lucide-react'
import { Medalje } from '../components/ui/medalje'
import { useLanguage } from '../i18n/LanguageContext'
import { tx } from '../i18n/interpolate'
import { HOVEDLIGA_PRIS } from '../utils/hovedliga'

function Seksjon({ ikon, tittel, children }: { ikon: React.ReactNode; tittel: string; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-xl shadow-xs ring-1 ring-stone-200/70 overflow-hidden">
            <header className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-stone-100">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    {ikon}
                </span>
                <h2 className="text-base font-semibold text-stone-900">{tittel}</h2>
            </header>
            <div className="px-4 py-4 text-sm leading-relaxed text-stone-700 space-y-3">{children}</div>
        </section>
    )
}

function Detaljer({ tittel, children }: { tittel: string; children: React.ReactNode }) {
    return (
        <details className="group rounded-lg ring-1 ring-stone-200/70 [&_summary]:list-none">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2.5 font-medium text-stone-900">
                <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-stone-400" />
                    {tittel}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 px-3 pb-3 text-stone-600">{children}</div>
        </details>
    )
}

function PoengKort({ tittel, verdi, children }: { tittel: string; verdi: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg ring-1 ring-stone-200/70 p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-stone-900">{tittel}</span>
                <span className="bp-chip-gold shrink-0">{verdi}</span>
            </div>
            <p className="mt-1 text-stone-600">{children}</p>
        </div>
    )
}

const Regler: NextPage = () => {
    const { data } = UseAllBets()
    const { t } = useLanguage()
    const r = t.regler

    if (!data) {
        return <Spinner />
    }

    const deltakere = data.users.filter((u) => u.i_hovedliga !== false && u.paid).length
    const pot = deltakere * HOVEDLIGA_PRIS
    const premier = [Math.round(pot * 0.5), Math.round(pot * 0.3), Math.round(pot * 0.2)]
    const eksempelLabel = t.nav.regler === 'Regler' ? 'Eksempel:' : 'Exemple :'

    return (
        <div className="space-y-3 mb-8">
            <h1 className="text-2xl font-bold text-stone-900 px-1">{r.tittel}</h1>

            <Seksjon ikon={<Wallet className="h-4 w-4" />} tittel={r.innskuddTittel}>
                <p>{r.innskuddTekst}</p>
                <p>
                    {r.innskuddVipps.split('{{nummer}}').map((part, i, arr) =>
                        i < arr.length - 1 ? (
                            <React.Fragment key={i}>
                                {part}
                                <span className="font-semibold text-stone-900">918 65 052</span>
                            </React.Fragment>
                        ) : (
                            part
                        ),
                    )}
                </p>
            </Seksjon>

            <Seksjon ikon={<Trophy className="h-4 w-4" />} tittel={r.premiepottTittel}>
                <div className="rounded-lg bg-stone-50 ring-1 ring-stone-200/70 px-4 py-3 text-center">
                    <p className="bp-overline">{r.premiepott}</p>
                    <p className="text-2xl font-bold text-stone-900">
                        {pot} {t.felles.kr}
                    </p>
                    <p className="text-xs text-stone-500">{tx(r.deltakere, { antall: deltakere })}</p>
                </div>
                <div className="divide-y divide-stone-100">
                    {r.premierader.map((rad, i) => (
                        <div key={rad.plass} className="flex items-center justify-between py-2">
                            <span className="flex items-center gap-2">
                                <Medalje plass={rad.plass} size={24} />
                                <span className="font-medium text-stone-900">{rad.label}</span>
                                <span className="text-xs text-stone-500">{rad.andel}</span>
                            </span>
                            <span className="bp-tabular font-semibold text-stone-900">
                                {premier[i]} {t.felles.kr}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="text-sm text-amber-700 font-medium">{r.pottVokser}</p>
                <p>{r.poenglikhet}</p>
                <p className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">
                    <span className="font-medium text-stone-700">{eksempelLabel}</span> {r.poenglikhetsEksempel}
                </p>
            </Seksjon>

            <Seksjon ikon={<Calculator className="h-4 w-4" />} tittel={r.slikFaarDuPoengTittel}>
                <p>{r.slikFaarDuPoengIntro}</p>

                <PoengKort tittel={r.riktigUtfallTittel} verdi={r.riktigUtfallVerdi}>
                    {r.riktigUtfallTekst}
                </PoengKort>

                <PoengKort tittel={r.riktigResultatTittel} verdi={r.riktigResultatVerdi}>
                    {r.riktigResultatTekst1} <span className="font-medium">{r.riktigResultatITillegg}</span>{' '}
                    {r.riktigResultatTekst2}
                </PoengKort>

                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>{r.sjeldenhetsTips}</span>
                </p>

                <div>
                    <p className="bp-overline mb-1.5">{r.kampverdiPerRunde}</p>
                    <div className="divide-y divide-stone-100 rounded-lg ring-1 ring-stone-200/70">
                        {r.kampverdier.map((k) => (
                            <div key={k.runde} className="flex items-center justify-between px-3 py-2">
                                <span className="text-stone-700">{k.runde}</span>
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                                    × {k.verdi}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2 text-stone-600">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                    <span>{r.sluttspillInfo}</span>
                </p>

                <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-stone-600">
                    <p className="font-medium text-stone-700">{r.regneeksempelTittel}</p>
                    <p className="mt-1">{r.regneeksempelTekst}</p>
                    <ul className="mt-1 space-y-0.5">
                        <li>{r.regneeksempelRiktigUtfall}</li>
                        <li>{r.regneeksempelRiktigResultat}</li>
                    </ul>
                    <p className="mt-1 font-medium text-stone-900">{r.regneeksempelSum}</p>
                    <p className="mt-1">{r.regneeksempelFinale}</p>
                </div>
            </Seksjon>

            <Seksjon ikon={<Zap className="h-4 w-4" />} tittel={r.jokerTittel}>
                <p>{r.jokerTekst1}</p>
                <p>{r.jokerTekst2}</p>
                <p>{r.jokerTekst3}</p>
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>{r.jokerTips}</span>
                </p>
                <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-stone-600">
                    <p className="font-medium text-stone-700">{r.jokerEksempelTittel}</p>
                    <p className="mt-1">{r.jokerEksempelTekst}</p>
                    <ul className="mt-1 space-y-0.5">
                        <li>{r.jokerEksempelLinje1}</li>
                        <li>{r.jokerEksempelLinje2}</li>
                    </ul>
                </div>
            </Seksjon>

            <Seksjon ikon={<Flag className="h-4 w-4" />} tittel={r.norgeKamperTittel}>
                <p>{r.norgeKamperTekst1}</p>
                <p>{r.norgeKamperTekst2}</p>
            </Seksjon>

            <Seksjon ikon={<Star className="h-4 w-4" />} tittel={r.vinnerToppscorerTittel}>
                <p>{r.vinnerToppscorerTekst1}</p>
                <p>{r.vinnerToppscorerTekst2}</p>
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>{r.vinnerToppscorerTekst2AndreRunde}</span>
                </p>
                <Detaljer tittel={r.byttetDetaljerTittel}>
                    <p>{r.byttetDetaljerHalvering}</p>
                    <p>{r.byttetDetaljerPott}</p>
                    <p>{r.byttetDetaljerEffekt}</p>
                    <p className="rounded-lg bg-stone-50 px-3 py-2">
                        <span className="font-medium text-stone-700">{eksempelLabel}</span> {r.byttetDetaljerEksempel}
                    </p>
                </Detaljer>
                <p>{r.vinnerToppscorerTekst3}</p>
                <div className="divide-y divide-stone-100 rounded-lg ring-1 ring-stone-200/70">
                    {r.bonustrapper.map((rad) => (
                        <div key={rad.terskel} className="flex items-center justify-between px-3 py-2">
                            <span className="text-stone-700">{rad.terskel}</span>
                            <span className="bp-chip-gold shrink-0">
                                {rad.poeng} {t.felles.poeng}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>{r.vinnerToppscorerTips}</span>
                </p>
                <p className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">
                    <span className="font-medium text-stone-700">{eksempelLabel}</span> {r.vinnerToppscorerEksempel}
                </p>
            </Seksjon>

            <Seksjon ikon={<Clock className="h-4 w-4" />} tittel={r.fristerTittel}>
                <p>
                    <span className="font-medium text-stone-900">{r.fristerKamptips}</span> {r.fristerKamptipsTekst}
                </p>
                <p>
                    <span className="font-medium text-stone-900">{r.fristerVinnerTopps}</span>{' '}
                    {r.fristerVinnerToppsTekst}
                </p>
                <p>{r.fristerVinnerToppsAndresjanse}</p>
            </Seksjon>
        </div>
    )
}

export default Regler
