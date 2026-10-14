import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import { useSurveyStore } from '../store/survey'
import { B, ACCENT, CompassRose } from '../components/bureau/BureauComponents'
import type { Party, PartyPosition } from '../types'

import partiesData from '../data/parties.json'
import questionsData from '../data/questions.json'
import voteMappings from '../data/vote_mappings.json'
import platformSources from '../data/platform_sources.json'

const positionFiles = import.meta.glob('../data/positions/*.json', { eager: true }) as Record<string, { default?: { positions: PartyPosition[] }; positions?: PartyPosition[] }>

const parties = partiesData as Party[]
const sources = platformSources as Record<string, { label: string; url: string }[]>

type VotedWithBasis = { basis?: 'mk' | 'leaders' | 'faction' | 'manual' }

function positionsFor(partyId: string): PartyPosition[] {
  const entry = positionFiles[`../data/positions/${partyId}.json`]
  return (entry?.default?.positions ?? entry?.positions ?? []) as PartyPosition[]
}

const h2: React.CSSProperties = { fontSize: 16, fontWeight: 800, color: B.ink, margin: '32px 0 10px' }
const p: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.75, color: B.inkSoft, margin: '0 0 10px' }
const card: React.CSSProperties = {
  background: B.white, border: `1px solid ${B.border}`, borderRadius: B.radiusLg, padding: '14px 16px', marginBottom: 12,
}
const th: React.CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: B.inkFaint, textAlign: 'start', whiteSpace: 'nowrap', borderBottom: `1px solid ${B.border}` }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: B.ink, borderBottom: `1px solid ${B.bg}`, whiteSpace: 'nowrap' }

export function MethodologyPage() {
  const navigate = useNavigate()
  const { lang } = useSurveyStore()
  const L = (he: string, en: string) => (lang === 'he' ? he : en)

  const coverage = useMemo(() => parties.map(party => {
    const pos = positionsFor(party.id)
    const count = { mk: 0, leaders: 0, faction: 0, manual: 0, none: 0 }
    for (const x of pos) {
      const v = x.voted_position as (VotedWithBasis & object) | undefined
      if (!v) count.none++
      else count[(v.basis ?? 'manual') as keyof typeof count]++
    }
    return { party, stated: pos.length, ...count }
  }), [])

  const questionRows = useMemo(() => (questionsData as { id: string; text_he: string; text_en: string }[]).map(q => {
    const m = (voteMappings as Record<string, { votes?: { vote_id: number; knesset: number; direction: string; note: string }[]; manual_k25?: { note?: string } | null; proxy_note?: string }>)[q.id]
    return { q, votes: m?.votes ?? [], manual: m?.manual_k25?.note ?? null, proxy: m?.proxy_note ?? null }
  }), [])

  return (
    <div style={{ minHeight: '100dvh', background: B.bg, fontFamily: B.font }}>
      <header style={{ background: `${B.bg}f5`, backdropFilter: 'blur(8px)', borderBottom: `1px solid ${B.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} aria-label="back"
            style={{ border: 'none', background: 'transparent', fontSize: 18, color: B.inkFaint, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
            {lang === 'he' ? '→' : '←'}
          </button>
          <CompassRose size={20} accent={ACCENT} lang={lang} />
          <h1 style={{ flex: 1, fontSize: 15, fontWeight: 700, color: B.ink, margin: 0 }}>{L('שקיפות: מקורות ושיטה', 'Transparency: sources & method')}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '8px 20px 64px' }}>

        <h2 style={h2}>{L('הדבר החשוב ביותר: מה נעשה על ידי AI ומה לא', 'The most important thing: what was done by AI, and what was not')}</h2>
        <div style={{ ...card, borderColor: '#f59e0b', background: '#fffbeb' }}>
          <p style={{ ...p, color: B.ink }}>
            <b>{L('"עמדות מוצהרות" נאספו בעזרת מודל AI (Claude של Anthropic).', '"Stated positions" were compiled with the help of an AI model (Anthropic\'s Claude).')}</b>{' '}
            {L(
              'המודל קרא מצעים פומביים, אתרי מפלגות וכתבות, והציע לכל מפלגה ציון בין ‎-2 ל-‎+2 לכל שאלה, יחד עם הערת מקור. הציונים הם שיפוט פרשני, לא מדידה, ולא עברו בדיקה אנושית עצמאית לכל רשומה. כשמצע שותק בנושא, הציון הוא 0 או הסקה מהצהרות ומהיסטוריה של המנהיגים, וההערה אומרת זאת.',
              'The model read public platforms, party sites and news coverage, and proposed a score from -2 to +2 for each party on each question, with a source note. The scores are interpretive judgments, not measurements, and each entry has not been independently fact-checked by a human. Where a platform is silent, the score is 0 or an inference from leaders\' statements and history, and the note says so.'
            )}
          </p>
          <p style={{ ...p, margin: 0 }}>
            {L(
              'לכן: אל תסתמכו על ציון בודד. כל ציון מוצג עם הערת המקור שלו (לחצו על מפלגה ואז על נושא), ואפשר לבדוק אותה מול האתר של המפלגה בטבלה למטה. ראיתם טעות? כפתור המשוב בפינה פתוח, ואני מתקן.',
              'So: don\'t rely on any single score. Every score is shown with its source note (tap a party, then a topic), and can be checked against the party\'s own site in the table below. Spotted a mistake? The feedback button is open and it gets fixed.'
            )}
          </p>
        </div>
        <div style={card}>
          <p style={{ ...p, margin: 0 }}>
            <b>{L('מה לא נעשה על ידי AI:', 'What AI did not do:')}</b>{' '}
            {L(
              'סקרי המנדטים מחושבים אוטומטית מטבלת הסקרים של themadad.com, וציוני ההצבעות בעמודה "הצבעות חברי הכנסת" (ובעמודות ראשי הרשימה והסיעה הקודמת) מחושבים אוטומטית מרישומי ההצבעה של הכנסת דרך oknesset.org. אבל שני דברים שם הם כן שיפוט: הבחירה אילו הצבעות מתאימות לאיזו שאלה (רשומה בגלוי למטה), ועמודת "קידוד ידני" בטבלה, שבה ציוני מפלגות הוקלדו ידנית, בעזרת AI, על סמך תוצאות הצבעה שדווחו, ולא חושבו מרישום ההצבעה של כל חבר כנסת.',
              'Seat polls are computed mechanically from themadad.com\'s poll table, and the scores in the "MK roll-calls" column (and the leaders\' and prior-faction columns) are computed mechanically from the Knesset\'s roll-call records via oknesset.org. Two things there are judgment, though: the choice of which votes map to which question (listed openly below), and the "Manual encoding" column in the table, where party scores were typed in by hand, with AI help, from reported vote outcomes rather than computed from each MK\'s recorded vote.'
            )}
          </p>
        </div>

        <h2 style={h2}>{L('מקורות הנתונים', 'Data sources')}</h2>
        <div style={{ overflowX: 'auto', ...card, padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>{L('נתון', 'Data')}</th><th style={th}>{L('מקור', 'Source')}</th><th style={th}>{L('איך', 'How')}</th>
            </tr></thead>
            <tbody>
              <tr><td style={td}>{L('עמדות מוצהרות', 'Stated positions')}</td><td style={td}>{L('מצעים ואתרי מפלגות, כתבות', 'Party platforms & sites, news')}</td><td style={{ ...td, whiteSpace: 'normal' }}>{L('איסוף בעזרת AI, ציון ‎-2..+2 לכל שאלה', 'AI-assisted collection, -2..+2 per question')}</td></tr>
              <tr><td style={td}>{L('הצבעות בפועל', 'Actual votes')}</td><td style={td}>oknesset.org ({L('רישומי הכנסת', 'Knesset records')})</td><td style={{ ...td, whiteSpace: 'normal' }}>{L('חישוב אוטומטי, ראו "איך מחושבות ההצבעות"', 'Automatic; see "How votes are computed"')}</td></tr>
              <tr><td style={td}>{L('מנדטים בסקרים', 'Poll seats')}</td><td style={td}>themadad.com</td><td style={{ ...td, whiteSpace: 'normal' }}>{L('חציון 30 הימים האחרונים, ללא ערוץ 14', 'Median of the last 30 days, excluding Channel 14')}</td></tr>
              <tr><td style={td}>{L('חברי כנסת', 'MKs')}</td><td style={td}>oknesset.org, Knesset OData</td><td style={{ ...td, whiteSpace: 'normal' }}>{L('נוכחות והצעות חוק; ציון הצבעות לפי חבר כנסת', 'Attendance and bills; per-MK vote scores')}</td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ ...p, fontSize: 12 }}>
          {L(
            'הערה על ערוץ 14: הוא מוחרג כי בסקריו הליכוד גבוה בעקביות בכ-10 מנדטים מכל שאר הגופים, כלומר סטייה שיטתית ולא רעש סטטיסטי. זו החלטה שיפוטית שלי, ואפשר לחלוק עליה.',
            'Why Channel 14 is excluded: its polls put Likud consistently ~10 seats above every other pollster, a systematic offset rather than sampling noise. That is a judgment call, and a debatable one.'
          )}
        </p>

        <h2 style={h2}>{L('איך מחושבת ההתאמה שלכם', 'How your match is computed')}</h2>
        <div style={card}>
          <ol style={{ ...p, paddingInlineStart: 20, margin: 0 }}>
            <li>{L('כל תשובה שלכם היא מספר: מסכים מאוד = ‎+2, מסכים = ‎+1, ניטרלי = 0, לא מסכים = ‎-1, לא מסכים בכלל = ‎-2. שאלה שדילגתם עליה לא נספרת.', 'Each answer becomes a number: strongly agree +2, agree +1, neutral 0, disagree -1, strongly disagree -2. Skipped questions are not counted.')}</li>
            <li>{L('לכל שאלה: ציון הסכמה = 1 פחות (המרחק בין תשובתכם לציון המפלגה, חלקי 4). זהות מלאה = 100%, קצוות הפוכים = 0%.', 'Per question: agreement = 1 minus (distance between your answer and the party score, divided by 4). Identical = 100%, opposite extremes = 0%.')}</li>
            <li>{L('בכל תחום (ביטחון, דת ומדינה, כלכלה, שלטון החוק, מיעוטים, ממשל): ממוצע ציוני ההסכמה של השאלות שענית עליהן ושיש עליהן נתון למפלגה.', 'Per topic (security, religion & state, economy, rule of law, minorities, governance): the average agreement over the questions you answered and the party has data for.')}</li>
            <li>{L('ההתאמה הכוללת: ממוצע משוקלל של התחומים לפי החשיבות שסימנתם במסך העדיפויות.', 'Overall match: the weighted average of the topics, using the importance you set on the priorities screen.')}</li>
            <li>{L('במצב "הצבעות": שאלה שאין עליה נתון הצבעה למפלגה לא נכנסת לחישוב ומסומנת "אין נתוני הצבעה". היא לא מוחלפת בעמדה המוצהרת.', 'In "votes" mode: a question with no vote data for the party is left out and marked "no vote data". It is not replaced by the stated position.')}</li>
          </ol>
        </div>

        <h2 style={h2}>{L('איך מחושבות ההצבעות', 'How votes are computed')}</h2>
        <div style={card}>
          <ol style={{ ...p, paddingInlineStart: 20, margin: 0 }}>
            <li>{L('בחרתי ידנית אילו הצבעות במליאה קשורות לכל שאלה, וקבעתי לכל אחת אם "בעד" מסכים עם השאלה או מתנגד לה. הרשימה המלאה בסעיף "הצבעות לפי שאלה" למטה.', 'I chose by hand which plenary votes relate to each question, and whether voting "for" agrees or disagrees with it. The full list is under "Votes by question" below.')}</li>
            <li>{L('לכל חבר כנסת: בעד = ‎+2, נגד = ‎-2, נמנע = 0 (הפוך אם "בעד" מתנגד לשאלה). ציון השאלה שלו הוא הממוצע על ההצבעות שהשתתף בהן. חבר כנסת שלא הצביע לא נכלל.', 'Per MK: for = +2, against = -2, abstain = 0 (reversed if "for" disagrees with the question). Their score for the question is the average over the votes they took part in. An MK who did not vote is excluded.')}</li>
            <li>{L('ציון המפלגה לשאלה הוא ממוצע ציוני חברי הכנסת שלה, כפי שיושבים בכנסת ה-25. אין שקלול לפי נוכחות או משמעת קואליציונית.', 'A party\'s score for a question is the average of its MKs\' scores in the 25th Knesset. There is no weighting for attendance or coalition discipline.')}</li>
          </ol>
        </div>
        <p style={p}><b>{L('מפלגות שלא היו קיימות בכנסת ה-25', 'Parties that did not exist in the 25th Knesset')}</b></p>
        <p style={p}>
          {L(
            'לרשימות חדשות אין היסטוריית הצבעות משלהן, אז הציון נגזר ממי שישב בכנסת: קודם ההצבעות האישיות של ראשי הרשימה (למשל איזנקוט וכהנא בישר!), ואם אין, הסיעה שבה ישבו. "ביחד" נשענת על רישום ההצבעות של יש עתיד. כל זה מסומן בעמודות הטבלה הבאה. לרשימות בלי חברי כנסת בכלל (המילואימניקים–הכלכלית, עמך ישראל) אין נתוני הצבעה ואין להם ציון.',
            'New lists have no voting history of their own, so the score is derived from whoever sat in the Knesset: first the leaders\' own votes (e.g. Eisenkot and Kahana for Yashar), then the faction they sat with. Beyachad relies on Yesh Atid\'s record. Each of these is marked in the table columns below. Lists with no sitting MKs at all (HaMiluimnikim–HaKalkalit, Amcha Yisrael) have no vote data and no score.'
          )}
        </p>

        <h2 style={h2}>{L('כיסוי נתונים לכל מפלגה (חי, מחושב מהנתונים באתר)', 'Data coverage per party (live, computed from the site\'s data)')}</h2>
        <div style={{ overflowX: 'auto', ...card, padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>{L('מפלגה', 'Party')}</th>
              <th style={th}>{L('הצבעות חברי הכנסת', 'MK roll-calls')}</th>
              <th style={th}>{L('הצבעות ראשי הרשימה', 'Leaders\' own votes')}</th>
              <th style={th}>{L('סיעה קודמת', 'Prior faction')}</th>
              <th style={th}>{L('קידוד ידני', 'Manual encoding')}</th>
              <th style={th}>{L('אין נתון', 'No data')}</th>
              <th style={th}>{L('אתר המצע', 'Platform site')}</th>
            </tr></thead>
            <tbody>
              {coverage.map(r => (
                <tr key={r.party.id}>
                  <td style={{ ...td, fontWeight: 700, color: r.party.color }}>{lang === 'he' ? r.party.name_he : r.party.name_en}</td>
                  <td style={td}>{r.mk}</td><td style={td}>{r.leaders}</td><td style={td}>{r.faction}</td><td style={td}>{r.manual}</td>
                  <td style={{ ...td, color: r.none > 15 ? '#dc2626' : B.ink, fontWeight: r.none > 15 ? 700 : 400 }}>{r.none}</td>
                  <td style={td}>
                    {(sources[r.party.id] ?? []).length === 0
                      ? <span style={{ color: B.inkHint }}>{L('לא נמצא אתר מצע רשמי', 'no official platform found')}</span>
                      : (sources[r.party.id] ?? []).map((s, i) => (
                          <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>{s.label}</a></span>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...p, fontSize: 12 }}>
          {L('מתוך 30 שאלות לכל מפלגה. "קידוד ידני" = ציון שהוקלד ידנית (בעזרת AI) על סמך תוצאת הצבעה ספציפית, בלי נתון אישי לכל חבר כנסת. זו השורה החלשה ביותר בנתוני ההצבעות, וההצבעה מצוטטת בהערת המקור של כל ציון כזה.', 'Out of 30 questions per party. "Manual encoding" = a score typed in by hand (with AI help) from a specific vote outcome, without per-MK data. It is the weakest layer of the vote data, and the vote is quoted in the source note of each such score.')}
        </p>

        <h2 style={h2}>{L('הצבעות לפי שאלה', 'Votes by question')}</h2>
        <p style={p}>{L('כל ההצבעות שמזינות כל שאלה. שאלה בלי הצבעות ובלי קידוד ידני אין עליה כלל נתון הצבעה.', 'Every vote feeding each question. A question with neither votes nor manual encoding has no vote data at all.')}</p>
        <div style={{ ...card, padding: 0 }}>
          {questionRows.map(({ q, votes, manual, proxy }) => (
            <details key={q.id} style={{ borderBottom: `1px solid ${B.bg}`, padding: '10px 16px' }}>
              <summary style={{ fontSize: 13, color: B.ink, cursor: 'pointer', lineHeight: 1.5 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: B.inkHint }}>{q.id}</span>{' '}
                {lang === 'he' ? q.text_he : q.text_en}{' '}
                <span style={{ fontSize: 11, color: votes.length || manual ? B.inkFaint : '#dc2626' }}>
                  ({votes.length || manual ? `${votes.length} ${L('הצבעות', 'votes')}${manual ? ' + ' + L('קידוד ידני', 'manual') : ''}` : L('אין נתוני הצבעה', 'no vote data')})
                </span>
                {proxy && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}> · {L('הצבעה קרובה, לא זהה', 'proxy vote')}</span>}
              </summary>
              <div style={{ marginTop: 8, fontSize: 12, color: B.inkSoft, lineHeight: 1.6 }}>
                {proxy && <p style={{ margin: '0 0 6px', color: '#b45309' }}>{proxy}</p>}
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {votes.map(v => (
                    <li key={v.vote_id}>
                      <span style={{ fontFamily: 'ui-monospace, monospace' }}>#{v.vote_id}</span>
                      {v.knesset !== 25 && <span> (K{v.knesset})</span>} · {v.direction === 'for_means_agree' ? L('"בעד" = מסכים', '"for" = agrees') : L('"בעד" = מתנגד', '"for" = disagrees')} — {v.note}
                    </li>
                  ))}
                  {manual && <li>{L('קידוד ידני', 'Manual encoding')}: {manual}</li>}
                </ul>
              </div>
            </details>
          ))}
        </div>

        <h2 style={h2}>{L('מגבלות מוכרות', 'Known limitations')}</h2>
        <div style={card}>
          <ul style={{ ...p, paddingInlineStart: 20, margin: 0 }}>
            <li>{L('הצבעה אינה אמונה. סיעות קואליציה מצביעות במשמעת, ולכן הצבעות חושפות קואליציה ואופוזיציה יותר מאשר השקפה.', 'A vote is not a belief. Coalition factions vote under discipline, so votes reveal coalition vs. opposition at least as much as conviction.')}</li>
            <li>{L('ההצבעות הן של הכנסת ה-25 בלבד (כנסת שהסתיימה). מפלגות חדשות נשענות על שיוך קודם של ראשיהן, וזה קירוב.', 'Votes are from the 25th Knesset only (now ended). New lists rely on their leaders\' prior affiliation, which is an approximation.')}</li>
            <li>{L('הכיסוי משתנה בין מפלגות (ראו הטבלה): בחלק מהן, בעיקר עוצמה יהודית והציונות הדתית, אין נתוני הצבעה לכמחצית מהשאלות, ושאלה כזו מוצגת "אין נתוני הצבעה" ואינה נספרת. חלק גדול מהכיסוי של שאר המפלגות הוא קידוד ידני.', 'Coverage varies by party (see the table): for some, notably Otzma Yehudit and Religious Zionism, about half the questions have no vote data, and such a question shows "no vote data" and is not counted. For the other parties, a large share of the coverage is manual encoding.')}</li>
            <li>{L('חלק מההצבעות הן קירוב לשאלה ולא התאמה מלאה (מסומן "הצבעה קרובה, לא זהה"). למשל, שאלת המדינה הפלסטינית נשענת על הצבעה על הכרה, שמזלזלת בתמיכה בשתי מדינות בהסכם.', 'Some votes only approximate their question (marked "proxy vote"). E.g. the Palestinian-state question rests on a vote about recognition, which understates support for two states in an agreement.')}</li>
            <li>{L('לעמדות המוצהרות אין קישור לכל רשומה, רק הערת מקור בטקסט. לכן הוספתי קישורים לאתרי המצע בטבלה. לרע"מ, יהדות התורה, עוצמה יהודית ועמך ישראל לא מצאתי אתר מצע רשמי שאפשר להסתמך עליו.', 'Stated positions carry a text source note per entry, not a link per entry. I added links to the party platform sites in the table. For Ra\'am, UTJ, Otzma Yehudit and Amcha Yisrael I could not find an official platform site I\'d rely on.')}</li>
            <li>{L('רשימות משתנות: הנתונים נבדקו לאחרונה לפני הבחירות ב-27 באוקטובר 2026, ורשימות שמתחברות או פורשות עלולות לדרוש עדכון.', 'Lists change: data was last checked ahead of the 27 October 2026 election, and lists that merge or withdraw may need updating.')}</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
