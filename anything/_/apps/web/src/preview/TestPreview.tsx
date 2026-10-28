import React, {useEffect, useState} from 'react';
import BrandLogo from '@/components/BrandLogo';
import {OverviewCards} from '@/components/InvestigationDetail/OverviewCards';
import {addCase,loadCases,type FixtureCase} from './fixtureStore';
const TARGET = 'example.com';
const KEY = 'osintshadow-fixture-cases-v1';
export default function TestPreview() {
 const [cases,setCases]=useState<FixtureCase[]>([]);
 const [view,setView]=useState<'dashboard'|'new'|'details'|'tools'>('dashboard');
 const [selected,setSelected]=useState<FixtureCase|null>(null);
 const [target,setTarget]=useState(TARGET);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{try{setCases(loadCases(localStorage,KEY,TARGET));}catch{setError('Browser test storage is unavailable or invalid. No case was loaded.');}},[]);
 function create(){setError('');try{const next=addCase(localStorage,KEY,TARGET,target);setCases(next);setSelected(next[0]);setView('details');setNotice('Synthetic fixture loaded and saved in this browser. No research was performed.');}catch(e){setError(e instanceof Error?e.message:'Could not save test case.');}}
 function open(row:FixtureCase){setSelected(row);setView('details');setNotice('');}
 return <div style={{minHeight:'100vh',background:'#263043',color:'#e2e8f0',fontFamily:'system-ui',padding:24}}>
  <header style={{maxWidth:1100,margin:'auto',display:'flex',justifyContent:'space-between',alignItems:'center'}}><BrandLogo className="h-8" variant="onDark"/><strong>OSINTShadow</strong><span>Isolated test instance</span></header>
  <main style={{maxWidth:1100,margin:'24px auto'}}>
   <aside role="note" style={{padding:16,background:'#fff3cd',color:'#332700',borderRadius:8}}>FIXTURE TEST MODE — Synthetic results only, not live research. No production database, personal-data collectors, paid providers, or billing. Cases persist only in this browser until its site data is cleared.</aside>
   <nav style={{display:'flex',gap:12,flexWrap:'wrap',margin:'24px 0'}}><button onClick={()=>setView('dashboard')}>Dashboard</button><button onClick={()=>setView('new')}>New Investigation</button><button onClick={()=>setView('tools')}>Collector Status</button></nav>
   {error&&<p role="alert" style={{padding:14,background:'#7f1d1d'}}>{error}</p>}
   {notice&&<p role="status">{notice}</p>}
   {view==='dashboard'&&<section><h1>OSINTShadow Test Dashboard</h1><p>{cases.length} saved fixture case(s). No live credits are used.</p><button onClick={()=>setView('new')}>Start a fixture investigation</button><h2>Investigations</h2>{cases.length===0?<p>No fixture cases yet.</p>:<ul>{cases.map(row=><li key={row.id} style={{padding:16,margin:'12px 0',border:'1px solid #64748b',borderRadius:8}}><button onClick={()=>open(row)}>{row.target}</button> — Fixture ready — {new Date(row.created_at).toLocaleString()}</li>)}</ul>}</section>}
   {view==='new'&&<section><h1>New fixture investigation</h1><p>Only the reserved synthetic fixture below is accepted. All collection options are disabled.</p><label htmlFor="fixture-target">Fixture domain</label><input id="fixture-target" value={target} onChange={e=>setTarget(e.target.value)} style={{display:'block',color:'#0f172a',padding:12,margin:'12px 0',width:'min(100%,400px)'}}/><button onClick={create}>Create fixture investigation</button></section>}
   {view==='details'&&selected&&<section><h1>Fixture investigation</h1><p>{selected.id} · Fixture ready</p><OverviewCards investigation={{...selected,target_value:selected.target,target_type:'domain'}} ai={{risk_score:null}} summaryPreview="Fixture-only preview. AI was not called." anomaliesPreviewItems={['NOT CHECKED — Live collectors are disabled']} parseSeverity={()=>'unknown'} chipClasses={()=>'text-slate-200'} riskColor={()=>'text-slate-300'} onOpenAITab={()=>{setView('tools');setNotice('AI unavailable in fixture mode. No provider was called.');}}/>
   <h2>Report</h2><p>Source: bundled synthetic fixture. Risk score: NOT CHECKED.</p><p>DNS / RDAP / enrichment: NOT CHECKED. AI analysis: DISABLED. Billing: DISABLED.</p><button onClick={()=>{setNotice('Fixture reloaded. Live refresh is disabled.');setSelected({...selected});}}>Refresh fixture</button><button onClick={()=>{setView('tools');setNotice('AI unavailable in fixture mode. No provider was called.');}}>Check AI availability</button></section>}
   {view==='tools'&&<section><h1>Collector status</h1><p>All external collection is intentionally disconnected in this test build.</p><ul>{['Domain/DNS/RDAP','Personal-data and social collectors','AI providers','Payments and billing'].map(name=><li key={name}>{name}: DISABLED / NOT CHECKED</li>)}</ul><p>This mode tests fixture case creation, report presentation, browser storage, and explicit unavailable labels. It does not test live integrations.</p></section>}
  </main><style>{'button{background:#00d1ff;color:#152033;border:0;border-radius:6px;padding:10px 15px;cursor:pointer;margin-right:8px}h1{font-size:28px;font-weight:700;margin:16px 0}h2{font-size:21px;font-weight:600;margin:20px 0}p{margin:12px 0}li{margin:10px 0}'}</style>
 </div>;
}
