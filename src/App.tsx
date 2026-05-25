import { useState, useMemo } from 'react'
import Papa from 'papaparse'
import './App.css'

interface Tweet {
  date: string
  text: string
  impressions: number
  likes: number
  retweets: number
  replies: number
  bookmarks: number
}

type Tone = 'study' | 'mind' | 'casual' | 'data'

function parseCsvRow(row: Record<string, string>): Tweet | null {
  const text = row['Post text'] || row['Tweet text'] || row['텍스트'] || row['트윗'] || row['text'] || ''
  if (!text) return null
  const date = row['Date'] || row['date'] || row['날짜'] || row['Created at'] || row['time'] || ''
  const impressions = parseInt(row['Impressions'] || row['impressions'] || row['노출수'] || row['노출'] || '0') || 0
  const likes = parseInt(row['Likes'] || row['likes'] || row['좋아요'] || '0') || 0
  const retweets = parseInt(row['Retweets'] || row['retweets'] || row['리트윗'] || '0') || 0
  const replies = parseInt(row['Replies'] || row['replies'] || row['답글'] || '0') || 0
  const bookmarks = parseInt(row['Bookmarks'] || row['bookmarks'] || row['북마크'] || '0') || 0
  return { date, text, impressions, likes, retweets, replies, bookmarks }
}

function weekStartIso(dateStr: string): string {
  const d = new Date(dateStr)
  if (!Number.isFinite(d.getTime())) return ''
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TONE_TEMPLATES: Record<Tone, { label: string; emoji: string; examples: string[] }> = {
  study: {
    label: '학습',
    emoji: '📚',
    examples: [
      '명사형 · 비유 · X→O 대조',
      '예: "공부 = 노트 정리 X / 안 보고 떠올리기 O"',
      '구조: 흔한 오해 → 진짜 원리 → 1줄 액션',
    ],
  },
  mind: {
    label: '심리',
    emoji: '🧠',
    examples: [
      '공감 → 인지 분리 → 회복 액션',
      '예: "그 생각은 네가 아니야, 신경계가 만든 신호야"',
      '구조: 흔한 자책 → 신경학적 설명 → 작게 시작',
    ],
  },
  casual: {
    label: '캐주얼',
    emoji: '💬',
    examples: [
      'araha 톤 — 짧고 솔직',
      '예: "결국 일은 미루다 한 게 다였음"',
      '구조: 솔직한 한 줄 → 공감 유도',
    ],
  },
  data: {
    label: '데이터',
    emoji: '📊',
    examples: [
      '숫자 + 인사이트 한 줄',
      '예: "3주 만에 1000명. D+7 잔존 74%. 광고비 0원"',
      '구조: 충격 숫자 → 비교 기준 → 의미',
    ],
  },
}

export default function App() {
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [cpmUsd, setCpmUsd] = useState(0.3)
  const [premiumShare, setPremiumShare] = useState(20)
  const [usdToKrw, setUsdToKrw] = useState(1380)
  const [targetKrw, setTargetKrw] = useState(100000)
  const [sortKey, setSortKey] = useState<'impressions' | 'likes' | 'retweets' | 'bookmarks' | 'date'>('impressions')
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'analytics' | 'generator' | 'goal'>('analytics')
  const [tone, setTone] = useState<Tone>('study')
  const [genTopic, setGenTopic] = useState('')

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map(parseCsvRow).filter((t): t is Tweet => t !== null)
        if (parsed.length === 0) {
          setError('파싱된 트윗 없음. CSV 컬럼명 확인 (Date, Post text, Impressions, Likes, Retweets, Replies, Bookmarks)')
          return
        }
        setTweets(parsed)
      },
      error: (err) => setError('CSV 파싱 실패: ' + err.message),
    })
  }

  function calcEarningsUSD(impressions: number): number {
    const premiumImps = impressions * (premiumShare / 100)
    return (premiumImps / 1000) * cpmUsd
  }
  function calcEarningsKRW(impressions: number): number {
    return calcEarningsUSD(impressions) * usdToKrw
  }

  const sortedTweets = useMemo(() => {
    return [...tweets].sort((a, b) => {
      if (sortKey === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime()
      return (b[sortKey] || 0) - (a[sortKey] || 0)
    })
  }, [tweets, sortKey])

  const weekStats = useMemo(() => {
    const byWeek = new Map<string, Tweet[]>()
    for (const t of tweets) {
      const wk = weekStartIso(t.date)
      if (!wk) continue
      const arr = byWeek.get(wk) || []
      arr.push(t)
      byWeek.set(wk, arr)
    }
    return [...byWeek.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([wk, twts]) => {
        const totalImp = twts.reduce((s, t) => s + t.impressions, 0)
        return {
          weekStart: wk,
          count: twts.length,
          totalImpressions: totalImp,
          totalLikes: twts.reduce((s, t) => s + t.likes, 0),
          totalRetweets: twts.reduce((s, t) => s + t.retweets, 0),
          totalBookmarks: twts.reduce((s, t) => s + t.bookmarks, 0),
          earningsKRW: calcEarningsKRW(totalImp),
        }
      })
  }, [tweets, cpmUsd, premiumShare, usdToKrw])

  const totalImp = tweets.reduce((s, t) => s + t.impressions, 0)
  const totalEarningsKrw = calcEarningsKRW(totalImp)

  // 목표 역산 — targetKrw 채우려면 필요 노출수 + 트윗 수
  const goalCalc = useMemo(() => {
    if (tweets.length === 0) return null
    const usdPerImp = (premiumShare / 100) * cpmUsd / 1000
    const krwPerImp = usdPerImp * usdToKrw
    const requiredImp = krwPerImp > 0 ? targetKrw / krwPerImp : 0
    const avgImpPerTweet = tweets.length > 0 ? totalImp / tweets.length : 0
    const requiredTweets = avgImpPerTweet > 0 ? requiredImp / avgImpPerTweet : 0
    const topTweetImp = sortedTweets[0]?.impressions || 0
    const requiredTopTweets = topTweetImp > 0 ? requiredImp / topTweetImp : 0
    return {
      requiredImp,
      requiredTweets,
      avgImpPerTweet,
      topTweetImp,
      requiredTopTweets,
      krwPerImp,
    }
  }, [targetKrw, premiumShare, cpmUsd, usdToKrw, tweets, totalImp, sortedTweets])

  return (
    <div className="app">
      <header>
        <h1>🐦 트위터 분석기</h1>
        <p>X analytics CSV 업로드 → 트윗별 메트릭 + 주별 합계 + 수익 추정 + 목표 역산 + 트윗 톤 가이드</p>
      </header>

      {tweets.length === 0 ? (
        <div className="upload-card">
          <h2>📤 CSV 업로드</h2>
          <p>X analytics 에서 받은 CSV 파일 업로드</p>
          <input type="file" accept=".csv" onChange={handleUpload} />
          {error && <div className="error">{error}</div>}
          <details>
            <summary>X CSV 받는 법</summary>
            <ol>
              <li>analytics.x.com 또는 X 앱 → 분석</li>
              <li>기간 선택 → CSV 내보내기</li>
              <li>받은 파일 위에 드래그</li>
            </ol>
          </details>
        </div>
      ) : (
        <>
          <nav className="tab-nav">
            {([
              { key: 'analytics', label: '📊 분석', emoji: '📊' },
              { key: 'goal', label: '🎯 목표 역산', emoji: '🎯' },
              { key: 'generator', label: '✏️ 트윗 톤 가이드', emoji: '✏️' },
            ] as const).map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={activeTab === t.key ? 'active' : ''}>
                {t.label}
              </button>
            ))}
          </nav>

          {activeTab === 'analytics' && (
            <>
              <section className="summary-card">
                <h2>📊 전체 요약 ({tweets.length}개 트윗)</h2>
                <div className="metrics">
                  <div className="metric"><div className="num">{totalImp.toLocaleString()}</div><div className="lbl">총 노출수</div></div>
                  <div className="metric"><div className="num">{tweets.reduce((s, t) => s + t.likes, 0).toLocaleString()}</div><div className="lbl">총 좋아요</div></div>
                  <div className="metric"><div className="num">{tweets.reduce((s, t) => s + t.retweets, 0).toLocaleString()}</div><div className="lbl">총 리트윗</div></div>
                  <div className="metric"><div className="num">{tweets.reduce((s, t) => s + t.bookmarks, 0).toLocaleString()}</div><div className="lbl">총 북마크</div></div>
                  <div className="metric earnings"><div className="num">₩{Math.round(totalEarningsKrw).toLocaleString()}</div><div className="lbl">추정 수익</div></div>
                </div>
              </section>

              <section className="earnings-config">
                <h2>💰 수익 추정 공식 (조정 가능)</h2>
                <div className="config-row">
                  <label>
                    Premium 사용자 점유율: <strong>{premiumShare}%</strong>
                    <input type="range" min={5} max={50} step={1} value={premiumShare} onChange={(e) => setPremiumShare(parseInt(e.target.value))} />
                  </label>
                  <label>
                    CPM (1k 노출당 단가): <strong>${cpmUsd.toFixed(2)}</strong>
                    <input type="range" min={0.1} max={2} step={0.05} value={cpmUsd} onChange={(e) => setCpmUsd(parseFloat(e.target.value))} />
                  </label>
                  <label>
                    환율 (USD → KRW): <strong>₩{usdToKrw}</strong>
                    <input type="number" min={1000} max={2000} value={usdToKrw} onChange={(e) => setUsdToKrw(parseInt(e.target.value) || 1380)} />
                  </label>
                </div>
                <p className="note">⚠️ X 공식 공식 비공개. 추정만 가능. 실수익은 X dashboard 의 Estimated Earnings 가 정확.</p>
              </section>

              <section className="weeks">
                <h2>📅 주별 합계 + 추정 주급</h2>
                <table>
                  <thead>
                    <tr>
                      <th>주차</th><th>트윗</th><th>노출수</th><th>좋아요</th><th>리트윗</th><th>북마크</th><th>추정 주급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekStats.map((w) => (
                      <tr key={w.weekStart}>
                        <td>{w.weekStart}</td>
                        <td>{w.count}</td>
                        <td>{w.totalImpressions.toLocaleString()}</td>
                        <td>{w.totalLikes.toLocaleString()}</td>
                        <td>{w.totalRetweets.toLocaleString()}</td>
                        <td>{w.totalBookmarks.toLocaleString()}</td>
                        <td className="earnings">₩{Math.round(w.earningsKRW).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="tweets">
                <h2>📝 트윗별 메트릭</h2>
                <div className="sort-bar">
                  정렬:
                  {(['impressions', 'likes', 'retweets', 'bookmarks', 'date'] as const).map((k) => (
                    <button key={k} onClick={() => setSortKey(k)} className={sortKey === k ? 'active' : ''}>
                      {k === 'impressions' ? '노출' : k === 'likes' ? '좋아요' : k === 'retweets' ? '리트윗' : k === 'bookmarks' ? '북마크' : '날짜'}
                    </button>
                  ))}
                </div>
                <ul className="tweet-list">
                  {sortedTweets.slice(0, 50).map((t, i) => (
                    <li key={i}>
                      <div className="tweet-text">{t.text}</div>
                      <div className="tweet-meta">
                        <span>📅 {t.date.slice(0, 10)}</span>
                        <span>👁 {t.impressions.toLocaleString()}</span>
                        <span>❤️ {t.likes.toLocaleString()}</span>
                        <span>🔁 {t.retweets.toLocaleString()}</span>
                        <span>💬 {t.replies.toLocaleString()}</span>
                        <span>🔖 {t.bookmarks.toLocaleString()}</span>
                        <span className="earnings">₩{Math.round(calcEarningsKRW(t.impressions)).toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {sortedTweets.length > 50 && <p className="note">상위 50개만 표시.</p>}
              </section>
            </>
          )}

          {activeTab === 'goal' && goalCalc && (
            <section className="goal-card">
              <h2>🎯 수익 목표 역산</h2>
              <div className="config-row">
                <label>
                  목표 금액 (KRW): <strong>₩{targetKrw.toLocaleString()}</strong>
                  <input type="range" min={10000} max={1000000} step={10000} value={targetKrw} onChange={(e) => setTargetKrw(parseInt(e.target.value))} />
                </label>
              </div>
              <div className="goal-result">
                <div className="goal-row">
                  <div className="goal-label">필요 총 노출수</div>
                  <div className="goal-num">{Math.round(goalCalc.requiredImp).toLocaleString()}</div>
                </div>
                <div className="goal-row">
                  <div className="goal-label">평균 트윗 기준 (트윗당 {Math.round(goalCalc.avgImpPerTweet).toLocaleString()}회 노출)</div>
                  <div className="goal-num">{Math.ceil(goalCalc.requiredTweets)}개 트윗</div>
                </div>
                <div className="goal-row highlight">
                  <div className="goal-label">베스트 트윗 기준 (트윗당 {goalCalc.topTweetImp.toLocaleString()}회 노출)</div>
                  <div className="goal-num">{Math.ceil(goalCalc.requiredTopTweets)}개 트윗</div>
                </div>
              </div>
              <div className="goal-insight">
                <strong>💡 인사이트</strong>
                <p>1k 노출 당 ₩{Math.round(goalCalc.krwPerImp * 1000).toLocaleString()} 추정. 목표 ₩{targetKrw.toLocaleString()} 채우려면 평균 트윗 {Math.ceil(goalCalc.requiredTweets)}개 또는 베스트 톤 트윗 {Math.ceil(goalCalc.requiredTopTweets)}개 필요.</p>
                <p>→ 베스트 트윗 톤 분석은 트윗 톤 가이드 탭에서.</p>
              </div>
            </section>
          )}

          {activeTab === 'generator' && (
            <section className="generator-card">
              <h2>✏️ 트윗 톤 가이드</h2>
              <p>주제 입력 + 톤 선택 → 구조·예시 안내. (AI 자동 생성은 API 키 필요. 일단 톤 가이드만)</p>
              <div className="tone-tabs">
                {(Object.keys(TONE_TEMPLATES) as Tone[]).map((t) => (
                  <button key={t} onClick={() => setTone(t)} className={tone === t ? 'active' : ''}>
                    {TONE_TEMPLATES[t].emoji} {TONE_TEMPLATES[t].label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="주제 (예: 미루기 극복, 과수면, ADHD 약 시작)"
              />
              <div className="tone-guide">
                <h3>{TONE_TEMPLATES[tone].emoji} {TONE_TEMPLATES[tone].label} 톤 가이드</h3>
                <ul>
                  {TONE_TEMPLATES[tone].examples.map((ex, i) => <li key={i}>{ex}</li>)}
                </ul>
                {genTopic && (
                  <div className="tone-prompt">
                    <strong>📋 트윗 작성 프롬프트</strong>
                    <pre>{`주제: ${genTopic}\n톤: ${TONE_TEMPLATES[tone].label}\n구조:\n${TONE_TEMPLATES[tone].examples.join('\n')}\n\n→ 위 톤·구조로 280자 이내 트윗 작성. araha 의 평소 말투 (반말·솔직·짧음) 유지.`}</pre>
                    <p className="note">위 프롬프트를 ChatGPT·Claude 에 그대로 붙이면 트윗 초안 받음.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          <button className="reset" onClick={() => { setTweets([]); setError(null) }}>다시 업로드</button>
        </>
      )}
    </div>
  )
}
