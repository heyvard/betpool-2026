import type { NextPage } from 'next'

import { Spinner } from '../components/loading/Spinner'
import React from 'react'
import { UseAllBets } from '../queries/useAllBets'
import { Calculator, Clock, Flag, Info, Sparkles, Star, Trophy, Wallet, Zap } from 'lucide-react'

function Seksjon({ ikon, tittel, children }: { ikon: React.ReactNode; tittel: string; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-xl shadow-sm ring-1 ring-stone-200/70 overflow-hidden">
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

/** Lite framhevet kort for én av de to måtene å score på i en kamp. */
function PoengKort({ tittel, verdi, children }: { tittel: string; verdi: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg ring-1 ring-stone-200/70 p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-stone-900">{tittel}</span>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {verdi}
                </span>
            </div>
            <p className="mt-1 text-stone-600">{children}</p>
        </div>
    )
}

const kampverdier = [
    { runde: 'Gruppespill', verdi: 1 },
    { runde: 'Sekstendelsfinale', verdi: 2 },
    { runde: 'Åttendedelsfinale', verdi: 2 },
    { runde: 'Kvartfinale', verdi: 3 },
    { runde: 'Semifinale', verdi: 3 },
    { runde: 'Bronsefinale', verdi: 3 },
    { runde: 'Finale', verdi: 4 },
]

const Regler: NextPage = () => {
    const { data } = UseAllBets()

    if (!data) {
        return <Spinner />
    }

    const deltakere = data.users.length
    const pot = deltakere * 300
    const premier = [Math.round(pot * 0.5), Math.round(pot * 0.3), Math.round(pot * 0.2)]
    const bonuspott = deltakere * 3

    const premieRader = [
        { medalje: '🥇', plass: '1. plass', andel: '50 %', kr: premier[0] },
        { medalje: '🥈', plass: '2. plass', andel: '30 %', kr: premier[1] },
        { medalje: '🥉', plass: '3. plass', andel: '20 %', kr: premier[2] },
    ]

    return (
        <div className="space-y-3 mb-8">
            <h1 className="text-2xl font-bold text-stone-900 px-1">Regler</h1>

            <Seksjon ikon={<Wallet className="h-4 w-4" />} tittel="Innskudd">
                <p>Det koster 300 kr å delta.</p>
                <p>
                    Beløpet må vippses til <span className="font-semibold text-stone-900">918 65 052</span> før den
                    første kampen starter.
                </p>
            </Seksjon>

            <Seksjon ikon={<Trophy className="h-4 w-4" />} tittel="Premiepott">
                <div className="rounded-lg bg-stone-50 ring-1 ring-stone-200/70 px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Premiepott</p>
                    <p className="text-2xl font-bold text-stone-900">{pot} kr</p>
                    <p className="text-xs text-stone-500">{deltakere} deltakere × 300 kr</p>
                </div>
                <div className="divide-y divide-stone-100">
                    {premieRader.map((rad) => (
                        <div key={rad.plass} className="flex items-center justify-between py-2">
                            <span className="flex items-center gap-2">
                                <span aria-hidden className="text-lg">
                                    {rad.medalje}
                                </span>
                                <span className="font-medium text-stone-900">{rad.plass}</span>
                                <span className="text-xs text-stone-500">{rad.andel}</span>
                            </span>
                            <span className="font-semibold tabular-nums text-stone-900">{rad.kr} kr</span>
                        </div>
                    ))}
                </div>
                <p>
                    Blir det poenglikhet, slås premiene for de aktuelle plassene sammen og deles likt mellom dem som er
                    like.
                </p>
                <p className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">
                    <span className="font-medium text-stone-700">Eksempel:</span> To kommer på delt 2. plass. Premiene
                    for 2. plass (200 kr) og 3. plass (100 kr) slås sammen — begge får 150 kr.
                </p>
            </Seksjon>

            <Seksjon ikon={<Calculator className="h-4 w-4" />} tittel="Slik får du poeng på en kamp">
                <p>For hver kamp kan du tjene poeng på to måter — og de legges sammen:</p>

                <PoengKort tittel="Riktig utfall" verdi="1 × kampverdi">
                    Du traff hvem som vant — eller at det ble uavgjort. Verdien{' '}
                    <span className="font-medium">dobles</span> hvis under 20 % av dem som tippet kampen traff utfallet.
                </PoengKort>

                <PoengKort tittel="Riktig resultat" verdi="1–3 × kampverdi">
                    Du traff den eksakte stillingen. Gir 3 poeng hvis under 15 % traff, 2 poeng hvis under 30 %, ellers
                    1 poeng. Dette kommer <span className="font-medium">i tillegg</span> til poengene for riktig utfall.
                </PoengKort>

                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>Jo færre som treffer, jo mer er tipset ditt verdt.</span>
                </p>

                <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        Kampverdi per runde
                    </p>
                    <div className="divide-y divide-stone-100 rounded-lg ring-1 ring-stone-200/70">
                        {kampverdier.map((k) => (
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
                    <span>
                        I sluttspillet teller stillingen etter 90 minutter (ordinær spilletid med tilleggstid).
                        Ekstraomganger og straffesparkkonkurranse teller ikke — uavgjort er derfor et gyldig tips også i
                        utslagskampene.
                    </span>
                </p>

                <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-stone-600">
                    <p className="font-medium text-stone-700">Regneeksempel</p>
                    <p className="mt-1">Du tipper 2–1 i en gruppekamp (kampverdi 1), og kampen ender 2–1:</p>
                    <ul className="mt-1 space-y-0.5">
                        <li>Riktig utfall: 25 % tippet hjemmeseier → 1 × 1 = 1 poeng</li>
                        <li>Riktig resultat: 10 % tippet akkurat 2–1 → 3 × 1 = 3 poeng</li>
                    </ul>
                    <p className="mt-1 font-medium text-stone-900">Til sammen: 4 poeng.</p>
                    <p className="mt-1">Samme blink i finalen (kampverdi 4) ville gitt 4 + 12 = 16 poeng.</p>
                </div>
            </Seksjon>

            <Seksjon ikon={<Zap className="h-4 w-4" />} tittel="Joker">
                <p>
                    I hver runde kan du sette <span className="font-medium">joker</span> på én kamp du har tippet.
                    Poengene for den kampen — både riktig utfall og riktig resultat —{' '}
                    <span className="font-medium">dobles</span>.
                </p>
                <p>
                    Jokeren velger du på «Mine kamper». Du kan flytte den fritt mellom kampene i runden helt til
                    jokerkampen starter — da låses jokeren for den runden.
                </p>
                <p>
                    Joker finnes i hver runde til og med åttendedelsfinalene — tre gruppespillsrunder, sekstendedels- og
                    åttendedelsfinalene, altså fem jokere. Fra kvartfinalen og utover er det ikke joker.
                </p>
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>Spar jokeren til en kamp du har god magefølelse på — en blink dobler uttellingen.</span>
                </p>
                <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-stone-600">
                    <p className="font-medium text-stone-700">Regneeksempel</p>
                    <p className="mt-1">
                        Du jokrer en åttendedelsfinale (kampverdi 2) og treffer det eksakte resultatet der under 15 %
                        traff:
                    </p>
                    <ul className="mt-1 space-y-0.5">
                        <li>Riktig utfall 2 poeng + riktig resultat 6 poeng = 8 poeng</li>
                        <li>Med joker: 8 × 2 = 16 poeng</li>
                    </ul>
                </div>
            </Seksjon>

            <Seksjon ikon={<Flag className="h-4 w-4" />} tittel="Norge-kamper">
                <p>
                    Kamper der <span className="font-medium">Norge</span> spiller teller dobbelt — alle får automatisk
                    doblet kamppoengene sine, uavhengig av hva de har tippet.
                </p>
                <p>
                    Setter du i tillegg joker på en Norge-kamp, stables doblingene: poengene for den kampen{' '}
                    <span className="font-medium">firedobles</span>.
                </p>
            </Seksjon>

            <Seksjon ikon={<Star className="h-4 w-4" />} tittel="Vinner og toppscorer">
                <p>
                    I tillegg til kamptipsene tipper du på hvem som vinner VM, og hvem som blir turneringens toppscorer.
                </p>
                <p>Begge kan endres så lenge den første gruppespillsrunden pågår. Når andre runde starter, låses de.</p>
                <p>
                    For hvert av de to spørsmålene finnes en pott på antall deltakere × 3 poeng — akkurat nå{' '}
                    <span className="font-semibold text-stone-900">{bonuspott} poeng</span>. Potten deles på alle som
                    gjettet riktig (rundet opp), men ingen får mer enn 15 poeng.
                </p>
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>Gjetter få riktig, blir hvert tips mye verdt — opp til taket på 15 poeng.</span>
                </p>
                <p className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">
                    <span className="font-medium text-stone-700">Eksempel:</span> 30 deltakere gir en pott på 90 poeng.
                    Gjettet 6 riktig vinner → 15 poeng hver. Gjettet 20 riktig → 5 poeng hver (90 ÷ 20, rundet opp).
                </p>
            </Seksjon>

            <Seksjon ikon={<Clock className="h-4 w-4" />} tittel="Frister">
                <p>
                    <span className="font-medium text-stone-900">Kamptips</span> kan endres helt frem til kampstart.
                    Tips som sendes inn etter avspark, blir ikke lagret.
                </p>
                <p>
                    <span className="font-medium text-stone-900">Vinner og toppscorer</span> låses når den andre
                    gruppespillsrunden starter.
                </p>
            </Seksjon>
        </div>
    )
}

export default Regler
