import React, { useState, useEffect, useRef, useCallback } from 'react'
import { loadAllData, saveAllData } from './supabase'



const STORAGE_KEY = "hushall-v4";
const YEAR_KEY = "hushall-year-v3";
const MONTHS_SV = ["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];

const C = {
  bg:"#faf8f3", card:"#ffffff", card2:"#f0ece0", border:"#e8e3d5",
  text:"#2c2c2c", muted:"#888880", blue:"#2c5282", green:"#276749", red:"#c53030", orange:"#c05621",
  tabBg:"#ede9de", accent:"#2c5282",
  font:"-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif",
};

const DEFAULT_EXPENSES = [
  { id:"revolut",   label:"Månadsbudget (överföring till Revolut gemensam)", amount:16000 },
  { id:"loan",      label:"Bolån",                                           amount:14500 },
  { id:"fee",       label:"Avgift (förening)",                               amount:0     },
  { id:"broadband", label:"Bredband",                                        amount:399   },
  { id:"insurance", label:"Försäkringar, totalt inkl. bilförsäkring",        amount:1296  },
  { id:"tibber",    label:"El (Tibber, elhandel)",                           amount:600   },
  { id:"boo",       label:"El (Boo Energi, distribution)",                   amount:600   },
  { id:"car",       label:"Bilkostnad",                                      amount:3957  },
  { id:"preschool", label:"Förskoleavgift",                                  amount:1574  },
  { id:"csn",       label:"CSN",                                             amount:2300  },
];
const FIXED_IDS = DEFAULT_EXPENSES.map(function(e) { return e.id; });

function fmt(n) {
  return new Intl.NumberFormat("sv-SE", {maximumFractionDigits:0}).format(n||0) + " kr";
}

function saveData(d) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
}

function loadData() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    var d = JSON.parse(raw);
    var labelMap = {};
    DEFAULT_EXPENSES.forEach(function(e) { labelMap[e.id] = e.label; });
    Object.keys(d).forEach(function(key) {
      if (!d[key] || !d[key].expenses) return;
      var ids = d[key].expenses.map(function(e) { return e.id; });
      DEFAULT_EXPENSES.forEach(function(def, di) {
        if (ids.indexOf(def.id) === -1) {
          d[key].expenses.splice(di, 0, Object.assign({}, def));
        }
      });
      d[key].expenses = d[key].expenses.map(function(e) {
        return labelMap[e.id] ? Object.assign({}, e, {label: labelMap[e.id]}) : e;
      });
      if (!d[key].note) d[key].note = "";
      if (!d[key].iskSplit) d[key].iskSplit = null;
    });
    return d;
  } catch(err) { return {}; }
}


function loadYearData() {
  try {
    var raw = localStorage.getItem(YEAR_KEY);
    if (raw) {
      var d = JSON.parse(raw);
      if (!d.extraIncome) d.extraIncome = [];
      if (!d.extraExpenses) d.extraExpenses = [];
      if (!d.accounts) d.accounts = {travel:{label:"Resekonto (Revolut)",balances:{}},transaction:{label:"Transaktionskonto",balances:{}}};
      return d;
    }
  } catch(e) {}
  return {
    income: { alexSalary:0, alexOther:0, emilieSalary:0, emilieOther:0 },
    extraIncome: [],
    expenses: {},
    extraExpenses: [],
    reserved: { travel:86000, home:84000, personal:96000, other:0 },
    iskGoal: 180000,
    accounts: {
      travel: { label:"Resekonto (Revolut)", balances:{} },
      transaction: { label:"Transaktionskonto", balances:{} },
    },
  };
}

function makeMonth(prev) {
  return {
    locked: false,
    note: "",
    iskSplit: null,
    income: prev ? Object.assign({}, prev.income) : {alexSalary:0,alexOther:0,emilieSalary:0,emilieOther:0,childBenefit:2650},
    expenses: prev ? prev.expenses.map(function(e) { return Object.assign({}, e); }) : DEFAULT_EXPENSES.map(function(e) { return Object.assign({}, e); }),
    savings: prev ? Object.assign({}, prev.savings) : {isk:12350,travel:3000,reserve:0},
  };
}

// ── NumInput ────────────────────────────────────────────────────────────────
function NumInput(props) {
  var value = props.value || 0;
  var onCommit = props.onCommit;
  var width = props.width || 120;
  var disabled = props.disabled || false;
  var onEnter = props.onEnter;

  var initialFormatted = value > 0 ? new Intl.NumberFormat("sv-SE").format(value) : "";
  var ref = useRef(null);
  var rawRef = useRef(initialFormatted);
  var [display, setDisplay] = useState(initialFormatted);
  var prevValue = useRef(value);

  useEffect(function() {
    if (prevValue.current !== value && document.activeElement !== ref.current) {
      prevValue.current = value;
      var f = value > 0 ? new Intl.NumberFormat("sv-SE").format(value) : "";
      rawRef.current = f;
      setDisplay(f);
    }
  }, [value]);

  function handleChange(e) {
    var digits = e.target.value.replace(/[^0-9]/g, "");
    rawRef.current = digits;
    setDisplay(digits);
  }

  function handleFocus(e) {
    var n = parseInt(rawRef.current.replace(/[^0-9]/g, ""), 10) || 0;
    var s = n > 0 ? String(n) : "";
    rawRef.current = s;
    setDisplay(s);
    setTimeout(function() { if(ref.current) ref.current.select(); }, 0);
  }

  function handleBlur() {
    var n = parseInt(rawRef.current.replace(/[^0-9]/g, ""), 10) || 0;
    onCommit(n);
    var f = n > 0 ? new Intl.NumberFormat("sv-SE").format(n) : "";
    rawRef.current = f;
    setDisplay(f);
  }

  function handleKey(e) {
    if (e.key === "Enter") {
      handleBlur();
      if (onEnter) onEnter(e);
    }
  }

  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <input ref={ref} type="text" inputMode="numeric" value={display} disabled={disabled}
        onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} onKeyDown={handleKey}
        placeholder="0"
        style={{width:width,padding:"8px 12px",background:disabled?"transparent":C.card2,
          border:"none",borderRadius:10,color:disabled?C.muted:C.text,fontSize:14,
          textAlign:"right",outline:"none",fontFamily:C.font,boxSizing:"border-box",
          opacity:disabled?0.6:1}} />
      <span style={{color:C.muted,fontSize:13}}>kr</span>
    </div>
  );
}

function focusNext(e) {
  var form = e.target.closest ? e.target.closest("[data-form]") : null;
  if (!form) return;
  var inputs = Array.from(form.querySelectorAll("input:not([disabled])"));
  var idx = inputs.indexOf(e.target);
  if (idx < inputs.length - 1) { e.preventDefault(); inputs[idx + 1].focus(); }
}

function LoginForm(props) {
  var [pw, setPw] = React.useState("");
  var C = props.colors;
  return (
    <form onSubmit={function(e) { e.preventDefault(); props.onUnlock(pw); }}>
      <input
        type="password"
        value={pw}
        onChange={function(e) { setPw(e.target.value); }}
        placeholder="Lösenord"
        autoFocus
        style={{width:"100%",padding:"12px 16px",borderRadius:8,border:"1px solid "+C.border,background:C.bg,color:C.text,fontSize:16,marginBottom:16,boxSizing:"border-box",outline:"none"}}
      />
      <button type="submit" style={{width:"100%",padding:"12px",borderRadius:8,background:C.accent,color:"#fff",fontWeight:600,fontSize:16,border:"none",cursor:"pointer"}}>
        Öppna
      </button>
    </form>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────
function App() {
  var [data, setData] = useState(function() { return loadData(); });
  var [yearData, setYearData] = useState(function() { return loadYearData(); });
  var [view, setView] = useState("overview");
  var [activeKey, setActiveKey] = useState(null);
  var [step, setStep] = useState(0);
  var [collapsed, setCollapsed] = useState({});
  var [saveStatus, setSaveStatus] = useState("Laddar...");
  var [unlocked, setUnlocked] = useState(function() { return sessionStorage.getItem("hush_auth") === "ok"; });
  var fileRef = useRef(null);
  var saveTimer = useRef(null);

  useEffect(function() {
    loadAllData().then(function(result) {
      if (result.monthData && Object.keys(result.monthData).length > 0) {
        setData(result.monthData); saveData(result.monthData);
      }
      if (result.yearData) { setYearData(result.yearData); saveYearData(result.yearData); }
      setSaveStatus("");
    }).catch(function() { setSaveStatus(""); });
  }, []);

  function triggerSave(nd, ny) {
    setSaveStatus("Sparar...");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function() {
      saveAllData(nd, ny).then(function() {
        setSaveStatus("✓ Sparad");
        setTimeout(function() { setSaveStatus(""); }, 2000);
      }).catch(function() { setSaveStatus("⚠ Fel"); setTimeout(function() { setSaveStatus(""); }, 3000); });
    }, 1000);
  }

  function persist(d) { setData(d); saveData(d); triggerSave(d, yearData); }
  function persistYear(d) { setYearData(d); saveYearData(d); triggerSave(data, d); }
  function patchYear(fn) { persistYear(fn(yearData)); }



  function openMonth(key) {
    setActiveKey(key);
    setStep(data[key] && data[key].locked ? 3 : 0);
    setView("month");
  }

  function createMonth(year, mon) {
    var key = year + "-" + String(mon).padStart(2, "0");
    var sorted = Object.keys(data).sort();
    var prev = sorted.length ? data[sorted[sorted.length - 1]] : null;
    var d = Object.assign({}, data);
    d[key] = makeMonth(prev);
    persist(d);
    setActiveKey(key);
    setStep(0);
    setView("month");
  }

  function patch(key, fn) {
    var d = Object.assign({}, data);
    d[key] = fn(data[key]);
    persist(d);
  }

  function toggleYear(yr) {
    setCollapsed(function(c) {
      var next = Object.assign({}, c);
      next[yr] = !next[yr];
      return next;
    });
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify({data:data,yearData:yearData},null,2)], {type:"application/json"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hushallsbudget-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
  }

  function importJSON(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var parsed = JSON.parse(ev.target.result);
        if (parsed.data) { setData(parsed.data); saveData(parsed.data); }
        if (parsed.yearData) { setYearData(parsed.yearData); saveYearData(parsed.yearData); }
        alert("Data importerad!");
      } catch(err) { alert("Fel vid import."); }
    };
    reader.readAsText(file);
  }


  if (!unlocked) {
    return (
      <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.font}}>
        <div style={{background:C.card,borderRadius:16,padding:"48px 40px",boxShadow:"0 4px 32px rgba(0,0,0,0.08)",minWidth:320,textAlign:"center"}}>
          <p style={{color:C.muted,fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Hushållsbudget</p>
          <h1 style={{fontSize:24,fontWeight:700,marginBottom:32,color:C.text}}>Logga in</h1>
          <LoginForm onUnlock={function(pw) {
            if (pw === "Fågelstig12e") {
              sessionStorage.setItem("hush_auth", "ok");
              setUnlocked(true);
            } else {
              alert("Fel lösenord");
            }
          }} colors={C} />
        </div>
      </div>
    );
  }

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:C.font}}>
      {view === "overview" && (
        <Overview data={data} onOpen={openMonth} onCreate={createMonth}
          onYearBudget={function() { setView("year"); }}
          collapsed={collapsed} onToggleYear={toggleYear}
          onExport={exportJSON} onImport={importJSON} fileRef={fileRef}
          saveStatus={saveStatus} />
      )}

      {view === "year" && (
        <YearBudget yearData={yearData} monthData={data}
          onBack={function() { setView("overview"); }} patchYear={patchYear} />
      )}
      {view === "month" && activeKey && (
        <MonthView monthKey={activeKey} month={data[activeKey]} step={step}
          setStep={setStep} onBack={function() { setView("overview"); }}
          allData={data} onPatch={function(fn) { patch(activeKey, fn); }}
          onNavigate={function(key) { setActiveKey(key); setStep(data[key]&&data[key].locked?3:0); }}
          prevMonth={function() {
            var keys = Object.keys(data).sort();
            var i = keys.indexOf(activeKey);
            return i > 0 ? data[keys[i-1]] : null;
          }} />
      )}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview(props) {
  var data = props.data;
  var onOpen = props.onOpen;
  var onCreate = props.onCreate;
  var onYearBudget = props.onYearBudget;
  var collapsed = props.collapsed;
  var onToggleYear = props.onToggleYear;
  var onExport = props.onExport;
  var onImport = props.onImport;
  var fileRef = props.fileRef;
  var saveStatus = props.saveStatus;

  var now = new Date();
  var currentYear = now.getFullYear();
  var yearSet = {};
  yearSet[currentYear] = true;
  Object.keys(data).forEach(function(k) { yearSet[parseInt(k.split("-")[0])] = true; });
  var years = Object.keys(yearSet).map(Number).sort();

  return (
    <div style={{maxWidth:600,margin:"0 auto",padding:"32px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:32}}>
        <div>
          <p style={{color:C.muted,fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>Hushållsbudget</p>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <h1 style={{fontSize:28,fontWeight:600}}>Översikt</h1>
            {saveStatus && <span style={{fontSize:12,color:saveStatus.includes("✓")?C.green:C.muted}}>{saveStatus}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onExport} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:"8px 12px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:C.font}}>💾 Exportera</button>
          <button onClick={function() { if(fileRef.current) fileRef.current.click(); }} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:"8px 12px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:C.font}}>📂 Importera</button>
          <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={onImport} />
        </div>
      </div>

      {years.map(function(year) {
        var isCollapsed = collapsed[year];
        var isCurrent = year === currentYear;
        return (
          <div key={year} style={{marginBottom:24}}>
            <button onClick={function() { onToggleYear(year); }}
              style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",fontFamily:C.font,marginBottom:10,padding:0}}>
              <span style={{color:isCurrent?C.blue:C.muted,fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:isCurrent?700:400}}>
                {year}{isCurrent ? " — innevarande år" : ""}
              </span>
              <span style={{color:C.muted,fontSize:11,transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)",display:"inline-block",transition:"transform 0.2s"}}>▼</span>
            </button>
            {!isCollapsed && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {MONTHS_SV.map(function(name, i) {
                  var key = year + "-" + String(i+1).padStart(2,"0");
                  var m = data[key];
                  var monthDate = new Date(year, i, 1);
                  var isFuture = monthDate > now && !m;
                  var canCreate = !m && !isFuture;
                  var isCurrentMonth = year === currentYear && i === now.getMonth();
                  var fp = 0;
                  var surplus2 = 0;
                  var mISK = 0;
                  if (m) {
                    var mti = Object.values(m.income).reduce(function(a,b) { return a+(b||0); }, 0);
                    var mte = m.expenses.reduce(function(a,e) { return a+(e.amount||0); }, 0);
                    var mts = Object.values(m.savings).reduce(function(a,b) { return a+(b||0); }, 0);
                    var mcb = m.income.childBenefit || 0;
                    fp = Math.round((mti - mte - mts - mcb) / 2);
                    surplus2 = mti - mte;
                    mISK = (m.savings&&m.savings.isk||0) + mcb;
                  }
                  return (
                    <button key={key}
                      onClick={function() { if(m) onOpen(key); else if(canCreate) onCreate(year,i+1); }}
                      disabled={isFuture}
                      style={{background:m?C.card:canCreate?"transparent":"#f5f0e8",
                        border:canCreate?"1px dashed "+C.border:"1px solid "+(m?C.border:"#e8e3d5"),
                        borderRadius:14,padding:"14px 12px",textAlign:"left",
                        cursor:isFuture?"default":"pointer",opacity:isFuture?0.3:1,
                        color:C.text,fontFamily:C.font}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:m?8:0}}>
                        <span style={{fontSize:13,fontWeight:500,color:isCurrentMonth?C.blue:C.text}}>{name.slice(0,3)}</span>
                        {m && m.locked && <span style={{fontSize:9}}>🔒</span>}
                        {canCreate && <span style={{color:C.blue,fontSize:18,lineHeight:1}}>+</span>}
                      </div>
                      {m && (
                        <div>
                          <p style={{fontSize:12,fontWeight:600,color:C.blue,margin:0}}>{fmt(mISK)}</p>
                          <p style={{fontSize:10,color:C.muted,margin:"2px 0 0"}}>→ ISK</p>
      
                        </div>
                      )}
                      {canCreate && <p style={{fontSize:10,color:C.muted,margin:"4px 0 0"}}>Skapa ny</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}


      <div style={{marginTop:16}}>
        <button onClick={onYearBudget} style={{width:"100%",padding:"16px",borderRadius:16,border:"1px solid "+C.blue+"66",background:C.blue+"11",color:C.blue,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>
          📊 Årsbudget
        </button>
      </div>
    </div>
  );
}

// ── MonthView ─────────────────────────────────────────────────────────────────
function MonthView(props) {
  var monthKey = props.monthKey;
  var month = props.month;
  var step = props.step;
  var setStep = props.setStep;
  var onBack = props.onBack;
  var allData = props.allData;
  var onPatch = props.onPatch;
  var prevMonthFn = props.prevMonth;
  var onNavigate = props.onNavigate;
  var prev = typeof prevMonthFn === "function" ? prevMonthFn() : null;

  var parts = monthKey.split("-");
  var yr = parts[0];
  var mo = parts[1];
  var monthName = MONTHS_SV[parseInt(mo) - 1];
  var locked = month.locked;

  var totalIncome = Object.values(month.income).reduce(function(a,b) { return a+(b||0); }, 0);
  var totalExp = month.expenses.reduce(function(a,e) { return a+(e.amount||0); }, 0);
  var iskSav = month.savings.isk || 0;
  var travelSav = month.savings.travel || 0;
  var reserveSav = month.savings.reserve || 0;
  var totalSav = iskSav + travelSav + reserveSav;
  var childBenefit = month.income.childBenefit || 0;
  var available = totalIncome - totalExp;
  var surplus = totalIncome - totalExp - totalSav - childBenefit;
  var perPerson = Math.round(surplus / 2);

  var MIN_EMILIE = childBenefit || 2650;
  var totalISK = iskSav + childBenefit;
  var savedSplit = month.iskSplit;
  var emilieISK = (savedSplit && savedSplit.emilie != null) ? Math.max(MIN_EMILIE, savedSplit.emilie) : Math.max(MIN_EMILIE, Math.round(totalISK / 2));
  var alexISK = totalISK - emilieISK;

  function setISKSplit(emilie) {
    var clamped = Math.max(MIN_EMILIE, Math.min(emilie, totalISK));
    onPatch(function(m) { return Object.assign({}, m, {iskSplit:{emilie:clamped,alex:totalISK-clamped}}); });
  }

  function setIncome(f, v) { onPatch(function(m) { var inc = Object.assign({}, m.income); inc[f] = v; return Object.assign({}, m, {income:inc}); }); }
  function setExpAmt(id, v) { onPatch(function(m) { return Object.assign({}, m, {expenses:m.expenses.map(function(e) { return e.id===id ? Object.assign({},e,{amount:v}) : e; })}); }); }
  function setExpLbl(id, v) { onPatch(function(m) { return Object.assign({}, m, {expenses:m.expenses.map(function(e) { return e.id===id ? Object.assign({},e,{label:v}) : e; })}); }); }
  function addExp() {
    onPatch(function(m) { return Object.assign({}, m, {expenses:[...m.expenses, {id:"c_"+Date.now(),label:"",amount:0}]}); });
    setTimeout(function() {
      var inputs = document.querySelectorAll('[data-form] input[placeholder="Benämning..."]');
      if (inputs.length) inputs[inputs.length-1].focus();
    }, 50);
  }
  function removeExp(id) { onPatch(function(m) { return Object.assign({}, m, {expenses:m.expenses.filter(function(e) { return e.id!==id; })}); }); }
  function setSaving(f, v) {
    var ns = Object.assign({}, month.savings); ns[f] = v;
    var nt = Object.values(ns).reduce(function(a,b) { return a+(b||0); }, 0);
    if (nt <= available) onPatch(function(m) { return Object.assign({}, m, {savings:ns}); });
  }
  function setNote(v) { onPatch(function(m) { return Object.assign({}, m, {note:v}); }); }

  // Sparstatistik
  var allKeys = Object.keys(allData).sort();
  var currentIdx = allKeys.indexOf(monthKey);
  var monthsUpToNow = allKeys.slice(0, currentIdx + 1);
  var currentYear = monthKey.split("-")[0];
  var yearKeys = monthsUpToNow.filter(function(k) { return k.startsWith(currentYear); });
  var accISK = 0;
  monthsUpToNow.forEach(function(k) { var m=allData[k]; if(!m)return; accISK+=(m.savings&&m.savings.isk||0)+(m.income&&m.income.childBenefit||0); });
  var yearISK = 0;
  yearKeys.forEach(function(k) { var m=allData[k]; if(!m)return; yearISK+=(m.savings&&m.savings.isk||0)+(m.income&&m.income.childBenefit||0); });
  var iskAvg = yearKeys.length > 0 ? Math.round(yearISK / yearKeys.length) : 0;
  var sparkvot = totalIncome > 0 ? Math.round(((iskSav + childBenefit) / totalIncome) * 100) : 0;

  // Fickpengar snitt
  var fpTotal = 0; var fpCount = 0;
  monthsUpToNow.forEach(function(k) {
    var m = allData[k]; if(!m)return;
    var ti=Object.values(m.income).reduce(function(a,b){return a+(b||0);},0);
    var te=m.expenses.reduce(function(a,e){return a+(e.amount||0);},0);
    var ts=Object.values(m.savings).reduce(function(a,b){return a+(b||0);},0);
    var cb=m.income.childBenefit||0;
    fpTotal+=Math.round((ti-te-ts-cb)/2); fpCount++;
  });
  var fpSnitt = fpCount > 0 ? Math.round(fpTotal / fpCount) : 0;

  var prevIncome = prev ? Object.values(prev.income).reduce(function(a,b){return a+(b||0);},0) : null;
  var prevExp = prev ? prev.expenses.reduce(function(a,e){return a+(e.amount||0);},0) : null;

  var STEPS = ["Inkomster","Utgifter","Sparande","Sammanfattning"];

  function pill(label, onClick, primary) {
    return (
      <button onClick={onClick} style={{flex:1,padding:"13px",borderRadius:13,border:"none",
        cursor:"pointer",fontFamily:C.font,background:primary?C.blue:C.card2,
        color:primary?"#fff":C.muted,fontSize:13,fontWeight:500}}>{label}</button>
    );
  }

  function infoBar(label, value, color) {
    var bg = color==="green" ? "#f0faf4" : color==="red" ? "#fff5f5" : C.card;
    var col = color==="green" ? C.green : color==="red" ? C.red : C.text;
    return (
      <div style={{background:bg,borderRadius:14,padding:"13px 16px",display:"flex",
        justifyContent:"space-between",alignItems:"center",marginBottom:10,border:"1px solid "+C.border}}>
        <span style={{fontSize:14,color:C.muted}}>{label}</span>
        <span style={{fontSize:16,fontWeight:600,color:col}}>{fmt(value)}</span>
      </div>
    );
  }

  function printSummary() {
    var alexT = month.income.alexSalary + month.income.alexOther - perPerson;
    var emilieT = month.income.emilieSalary + month.income.emilieOther - perPerson;
    var noteHtml = month.note ? "<p style='margin-top:12px;padding:10px;background:#faf8f3;border-radius:6px;font-size:11px;color:#6e6e73'><strong>Anteckning:</strong> " + month.note + "</p>" : "";
    var html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Budget " + monthName + " " + yr + "</title><style>@page{size:A4;margin:18mm 16mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:#1d1d1f;background:#fff;font-size:11.5px;line-height:1.6}h1{font-size:22px;font-weight:700;margin-bottom:2px;letter-spacing:-0.3px}.subtitle{font-size:10px;color:#6e6e73;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}.section{border-radius:10px;overflow:hidden;border:1px solid #e5e5ea;margin-bottom:10px}.sh{padding:9px 14px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.row{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;border-bottom:1px solid #f2f2f7;font-size:11.5px}.row:last-child{border-bottom:none}.label{color:#6e6e73;flex:1;padding-right:8px}.value{font-weight:600;white-space:nowrap}.muted{color:#6e6e73}.green{color:#276749}.red{color:#c53030}.blue{color:#2c5282}.hl{background:#f0f8ff}.big{font-size:17px;font-weight:800}.box{background:#f0f6ff;border:1px solid #c3d9f5;border-radius:10px;padding:12px 14px;margin-bottom:10px}.box h3{font-size:9.5px;text-transform:uppercase;color:#6e6e73;margin-bottom:8px;letter-spacing:.08em;font-weight:600}.divider{border:none;border-top:2px solid #e5e5ea;margin:14px 0}.footer{margin-top:14px;text-align:center;font-size:9.5px;color:#aeaeb2;border-top:1px solid #f2f2f7;padding-top:10px;letter-spacing:.04em}</style></head><body>";
    html += "<div style='display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:12px;border-bottom:2px solid #e0e0e5'><div><p style='font-size:10px;color:#6e6e73;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px'>Hushållsbudget — Sammanfattning</p><h1>" + monthName + " " + yr + "</h1></div><span style='background:#f0f0f5;border-radius:6px;padding:3px 8px;font-size:11px;color:#6e6e73'>🔒 Låst</span></div>";
    html += "<div class='grid'><div>";
    html += "<div class='section' style='margin-bottom:10px'><div class='sh' style='background:#2c5282'>Inkomster &amp; Utgifter</div>";
    html += "<div class='row'><span class='muted'>Total inkomst</span><span class='bold'>" + fmt(totalIncome) + "</span></div>";
    html += "<div class='row'><span class='muted'>Löpande utgifter</span><span class='bold red'>− " + fmt(totalExp) + "</span></div>";
    html += "<div class='row'><span class='muted'>Transaktion (resa+reserv)</span><span class='bold red'>− " + fmt(travelSav+reserveSav) + "</span></div>";
    html += "<div class='row'><span class='muted'>ISK inkl. barnbidrag</span><span class='bold blue'>− " + fmt(totalISK) + "</span></div>";
    html += "<div class='row hl'><span class='muted'>Fickpengar / person</span><span class='big green'>" + fmt(perPerson) + "</span></div></div>";
    html += "<div class='section'><div class='sh' style='background:#276749'>ISK-statistik</div>";
    html += "<div class='row'><span class='muted'>Ackumulerat ISK</span><span class='bold blue'>" + fmt(accISK) + "</span></div>";
    html += "<div class='row'><span class='muted'>Snitt / månad " + currentYear + "</span><span class='bold " + (iskAvg>=15000?"green":"red") + "'>" + fmt(iskAvg) + "</span></div>";
    html += "<div class='row'><span class='muted'>Fickpengar snitt / mån</span><span class='bold " + (fpSnitt<=4000?"green":"red") + "'>" + fmt(fpSnitt) + "</span></div></div>";
    html += "</div><div>";
    html += "<div class='box'><h3>→ Transaktionskonto (gemensamt)</h3>";
    html += "<div class='row' style='padding:4px 0'><span>Alex</span><strong class='blue'>" + fmt(alexT - alexISK) + "</strong></div>";
    html += "<div class='row' style='padding:4px 0'><span>Emilie</span><strong class='blue'>" + fmt(emilieT - emilieISK) + "</strong></div></div>";
    html += "<div class='box'><h3>→ ISK (totalt " + fmt(totalISK) + ")</h3>";
    html += "<div class='row' style='padding:4px 0'><span>Alex ISK</span><strong class='blue'>" + fmt(alexISK) + "</strong></div>";
    html += "<div class='row' style='padding:4px 0'><span>Emilie ISK</span><strong class='blue'>" + fmt(emilieISK) + "</strong></div></div>";
    html += "<div class='box'><h3>Total överföring</h3>";
    html += "<div class='row' style='padding:4px 0'><span>Alex</span><strong>" + fmt(alexT) + "</strong></div>";
    html += "<div class='row' style='padding:4px 0'><span>Emilie</span><strong>" + fmt(emilieT) + "</strong></div></div>";
    html += "</div></div>" + noteHtml;
    html += "<div class='footer'>Hushållsbudget • " + monthName + " " + yr + " • Genererad " + new Date().toLocaleDateString("sv-SE") + "</div>";
    html += "</body></html>";
    var w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(function() { w.print(); }, 600);
  }

  return (
    <div style={{maxWidth:600,margin:"0 auto",paddingBottom:48}} data-form="">
      <div className="no-print" style={{position:"sticky",top:0,background:"rgba(250,248,243,0.97)",backdropFilter:"blur(20px)",padding:"18px 20px 0",zIndex:10,borderBottom:"1px solid "+C.border}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:C.blue,fontSize:14,cursor:"pointer",fontFamily:C.font,padding:0}}>← Översikt</button>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={function(){
              var keys=Object.keys(allData).sort();
              var i=keys.indexOf(monthKey);
              if(i>0) onNavigate(keys[i-1]);
            }} disabled={Object.keys(allData).sort().indexOf(monthKey)===0}
              style={{background:"none",border:"1px solid "+C.border,borderRadius:8,padding:"5px 10px",color:C.muted,fontSize:16,cursor:"pointer",fontFamily:C.font,opacity:Object.keys(allData).sort().indexOf(monthKey)===0?0.3:1}}>‹</button>
            <button onClick={function(){
              var keys=Object.keys(allData).sort();
              var i=keys.indexOf(monthKey);
              if(i<keys.length-1) onNavigate(keys[i+1]);
            }} disabled={Object.keys(allData).sort().indexOf(monthKey)===Object.keys(allData).length-1}
              style={{background:"none",border:"1px solid "+C.border,borderRadius:8,padding:"5px 10px",color:C.muted,fontSize:16,cursor:"pointer",fontFamily:C.font,opacity:Object.keys(allData).sort().indexOf(monthKey)===Object.keys(allData).length-1?0.3:1}}>›</button>
          </div>
          <div style={{display:"flex",gap:8}}>
            {locked
              ? <button onClick={function(){onPatch(function(m){return Object.assign({},m,{locked:false});});}} style={{background:C.card2,border:"none",borderRadius:20,padding:"6px 14px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:C.font}}>🔒 Lås upp</button>
              : step===3 && <button onClick={function(){if(window.confirm("Lås månaden? Du kan låsa upp igen om du behöver ändra.")) onPatch(function(m){return Object.assign({},m,{locked:true});});}} style={{background:C.card,border:"1px solid "+C.border,borderRadius:20,padding:"6px 14px",color:C.blue,fontSize:12,cursor:"pointer",fontFamily:C.font}}>Lås månad</button>
            }
            {locked && step===3 && <button onClick={printSummary} style={{background:C.card,border:"1px solid "+C.border,borderRadius:20,padding:"6px 14px",color:C.green,fontSize:12,cursor:"pointer",fontFamily:C.font}}>📄 PDF</button>}
          </div>
        </div>
        <p style={{color:C.muted,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",margin:0}}>{yr}</p>
        <h2 style={{fontSize:22,fontWeight:600,margin:"2px 0 14px"}}>{monthName}</h2>
        <div style={{display:"flex",gap:4,paddingBottom:14}}>
          {STEPS.map(function(s, i) {
            return (
              <button key={s} onClick={function(){setStep(i);}} style={{flex:1,padding:"10px 4px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:C.font,background:step===i?C.blue:"transparent",color:step===i?"#fff":C.muted,fontSize:11,fontWeight:step===i?700:400,position:"relative"}}>
                {s}
                {i < step && <span style={{position:"absolute",top:3,right:3,width:5,height:5,borderRadius:"50%",background:C.green}}></span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{padding:"20px"}}>

        {step === 0 && (
          <div>
            {[["Alex","alexSalary","alexOther"],["Emilie","emilieSalary","emilieOther"]].map(function(row) {
              var name=row[0], sal=row[1], oth=row[2];
              return (
                <div key={name} style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
                  <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                    <span>👤</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>{name}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",borderBottom:"1px solid "+C.border}}>
                    <div><div style={{fontSize:14}}>Lön</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>(efter skatt)</div></div>
                    {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(month.income[sal])}</span>
                      : <NumInput value={month.income[sal]} onCommit={function(v){setIncome(sal,v);}} onEnter={focusNext} />}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px"}}>
                    <div><div style={{fontSize:14}}>Övriga inkomster</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Föräldrapenning, skatteåterbäring etc (efter skatt)</div></div>
                    {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(month.income[oth])}</span>
                      : <NumInput value={month.income[oth]} onCommit={function(v){setIncome(oth,v);}} onEnter={focusNext} />}
                  </div>
                </div>
              );
            })}
            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>💰</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>Övrigt</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px"}}>
                <div><div style={{fontSize:14}}>Barnbidrag</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Går direkt till ISK</div></div>
                {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(childBenefit)}</span>
                  : <NumInput value={childBenefit} onCommit={function(v){setIncome("childBenefit",v);}} onEnter={focusNext} />}
              </div>
            </div>
            {infoBar("Summa inkomster", totalIncome, "green")}
            {prevIncome !== null && (function() {
              var diff = totalIncome - prevIncome;
              var pct = prevIncome > 0 ? Math.round((diff/prevIncome)*100) : 0;
              return <div style={{display:"flex",justifyContent:"space-between",background:C.card,borderRadius:12,padding:"10px 16px",marginTop:-6,marginBottom:10,border:"1px solid "+C.border}}>
                <span style={{fontSize:12,color:C.muted}}>vs föregående månad</span>
                <span style={{fontSize:13,fontWeight:600,color:diff>=0?C.green:C.red}}>{diff>=0?"+":""}{fmt(diff)} ({diff>=0?"+":""}{pct}%)</span>
              </div>;
            })()}
            <div style={{display:"flex",gap:8}}>{pill("Nästa: Utgifter →", function(){setStep(1);}, true)}</div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>📋</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>Löpande utgifter</span>
              </div>
              {month.expenses.map(function(e, i) {
                return (
                  <div key={e.id} style={{display:"flex",alignItems:"center",padding:"11px 16px",borderBottom:i<month.expenses.length-1?"1px solid "+C.border:"none",gap:8}}>
                    {locked || FIXED_IDS.indexOf(e.id) !== -1
                      ? <span style={{flex:1,fontSize:14}}>{e.label}</span>
                      : <input value={e.label} onChange={function(ev){setExpLbl(e.id,ev.target.value);}} placeholder="Benämning..."
                          style={{flex:1,background:"transparent",border:"none",color:C.text,fontSize:14,outline:"none",fontFamily:C.font}} />}
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(e.amount)}</span>
                        : <NumInput value={e.amount} onCommit={function(v){setExpAmt(e.id,v);}} onEnter={focusNext} />}
                      {!locked && FIXED_IDS.indexOf(e.id) === -1 &&
                        <button onClick={function(){if(window.confirm("Ta bort \""+e.label+"\"?")) removeExp(e.id);}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>}
                    </div>
                  </div>
                );
              })}
              {!locked && <div style={{padding:"10px 16px"}}>
                <button onClick={addExp} style={{background:"none",border:"none",color:C.blue,fontSize:13,cursor:"pointer",fontFamily:C.font}}>+ Lägg till post</button>
              </div>}
            </div>
            {infoBar("Summa utgifter", totalExp, "red")}
            {prevExp !== null && (function() {
              var diff = totalExp - prevExp;
              var pct = prevExp > 0 ? Math.round((diff/prevExp)*100) : 0;
              return <div style={{display:"flex",justifyContent:"space-between",background:C.card,borderRadius:12,padding:"10px 16px",marginTop:-6,marginBottom:10,border:"1px solid "+C.border}}>
                <span style={{fontSize:12,color:C.muted}}>vs föregående månad</span>
                <span style={{fontSize:13,fontWeight:600,color:diff<=0?C.green:C.red}}>{diff>=0?"+":""}{fmt(diff)} ({diff>=0?"+":""}{pct}%)</span>
              </div>;
            })()}
            {infoBar("Tillgängligt", available, available>=0?"green":"red")}
            <div style={{display:"flex",gap:8}}>
              {pill("← Inkomster", function(){setStep(0);}, false)}
              {pill("Nästa: Sparande →", function(){setStep(2);}, true)}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{background:C.card,borderRadius:16,padding:16,marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <span style={{fontSize:13,color:C.muted}}>Tillgängligt</span>
                <span style={{fontSize:16,fontWeight:600}}>{fmt(available)}</span>
              </div>
              <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",background:C.blue,borderRadius:99,width:Math.min(100,available>0?(totalSav/available)*100:0)+"%"}} />
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:C.muted}}>Kvar efter sparande</span>
                <span style={{fontSize:14,fontWeight:600,color:surplus>=0?C.green:C.red}}>{fmt(surplus)}</span>
              </div>
            </div>

            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>🏦</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>Reserverade medel & sparande</span>
              </div>
              {[["isk","ISK (aktier/fonder)","Exkl. barnbidrag — barnbidrag → barnspar"],
                ["travel","Resa","Semesterkassa"],
                ["reserve","Hem & inköp (transaktionskonto)",""]].map(function(row, i, arr) {
                var key=row[0], label=row[1], hint=row[2];
                return (
                  <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",borderBottom:i<arr.length-1?"1px solid "+C.border:"none"}}>
                    <div>
                      <div style={{fontSize:14}}>{label}</div>
                      {hint && <div style={{fontSize:11,color:C.muted,marginTop:2}}>{hint}</div>}
                    </div>
                    {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(month.savings[key]||0)}</span>
                      : <NumInput value={month.savings[key]||0} onCommit={function(v){setSaving(key,v);}} onEnter={focusNext} />}
                  </div>
                );
              })}
            </div>

            <div style={{background:perPerson>=0?"#f0faf4":"#fff5f5",borderRadius:14,padding:"16px",marginBottom:12,border:"1px solid "+(perPerson>=0?C.green:C.red)+"55"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,color:C.muted}}>Fickpengar per person</span>
                <span style={{fontSize:24,fontWeight:700,color:perPerson>=0?C.green:C.red}}>{fmt(perPerson)}</span>
              </div>
              {surplus < 0 && <p style={{color:C.red,fontSize:12,margin:"8px 0 0"}}>⚠️ Minska sparandet</p>}
            </div>

            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>📈</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>Sparstatistik</span>
              </div>
              <div style={{padding:"13px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14}}>Sparkvot (denna månad)</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>ISK inkl. barnbidrag / totala inkomster</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:16,fontWeight:700,color:sparkvot>=15?C.green:C.red}}>{sparkvot}%</span>
                    <div style={{fontSize:11,color:sparkvot>=15?C.green:C.red,marginTop:2}}>{sparkvot>=15?"✅ Stark":"⚠️ Låg"}</div>
                  </div>
                </div>
                <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",background:sparkvot>=15?C.green:C.red,borderRadius:99,width:Math.min(sparkvot*2,100)+"%"}} />
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:8}}>
              {pill("← Utgifter", function(){setStep(1);}, false)}
              {pill("Nästa: Sammanfattning →", function(){setStep(3);}, true)}
            </div>
          </div>
        )}

        {step === 3 && totalIncome === 0 && (
          <div style={{background:C.card,borderRadius:16,padding:"32px 20px",textAlign:"center",border:"1px solid "+C.border,marginBottom:12}}>
            <div style={{fontSize:32,marginBottom:12}}>💡</div>
            <div style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:8}}>Fyll i inkomster först</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Gå till inkomstfliken och fyll i löner för att se sammanfattningen.</div>
            <button onClick={function(){setStep(0);}} style={{background:C.blue,border:"none",borderRadius:12,padding:"10px 20px",color:"#fff",fontSize:13,cursor:"pointer",fontFamily:C.font}}>← Gå till inkomster</button>
          </div>
        )}
        {step === 3 && totalIncome > 0 && (
          <div style={{paddingTop:4}}>
            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,background:C.tabBg}}>
                <span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Sammanfattning — {monthName} {yr}</span>
              </div>
              {[
                ["Total inkomst", fmt(totalIncome), C.text],
                ["Totala utgifter", "− "+fmt(totalExp), C.red],
                ["Överföring transaktionskonto (resa+reserv)", "− "+fmt(travelSav+reserveSav), C.red],
                ["Totalt sparande ISK (inkl. barnbidrag)", "− "+fmt(totalISK), C.blue],
              ].map(function(row) {
                return (
                  <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"11px 16px",borderBottom:"1px solid "+C.border}}>
                    <span style={{fontSize:13,color:C.muted,flex:1,paddingRight:8}}>{row[0]}</span>
                    <span style={{fontSize:14,fontWeight:500,color:row[2],whiteSpace:"nowrap"}}>{row[1]}</span>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"14px 16px",background:C.tabBg}}>
                <span style={{fontSize:14,fontWeight:600}}>Fickpengar / person</span>
                <span style={{fontSize:20,fontWeight:700,color:perPerson>=0?C.green:C.red}}>{fmt(perPerson)}</span>
              </div>
            </div>

            {prev && (function() {
              var prevInc = Object.values(prev.income).reduce(function(a,b){return a+(b||0);},0);
              var prevExp = prev.expenses.reduce(function(a,e){return a+(e.amount||0);},0);
              var prevNet = prevInc - prevExp;
              var thisNet = totalIncome - totalExp;
              var diff = thisNet - prevNet;
              return (
                <div style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:16,border:"1px solid "+C.border}}>
                  <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>⚖️ Nettokassaflöde vs föregående månad</div>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,background:C.card2,borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Förra månaden</div>
                      <div style={{fontSize:13,fontWeight:600,color:prevNet>=0?C.green:C.red}}>{fmt(prevNet)}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>ink - utg</div>
                    </div>
                    <div style={{flex:1,background:C.card2,borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Denna månad</div>
                      <div style={{fontSize:13,fontWeight:600,color:thisNet>=0?C.green:C.red}}>{fmt(thisNet)}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>ink - utg</div>
                    </div>
                    <div style={{flex:1,background:diff>=0?"#f0faf4":"#fff5f5",borderRadius:10,padding:"10px 12px",border:"1px solid "+(diff>=0?C.green:C.red)+"44"}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Förändring</div>
                      <div style={{fontSize:13,fontWeight:700,color:diff>=0?C.green:C.red}}>{diff>=0?"+":""}{fmt(diff)}</div>
                      <div style={{fontSize:10,color:diff>=0?C.green:C.red,marginTop:2}}>{diff>=0?"▲ bättre":"▼ sämre"}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>📈</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>ISK-statistik</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid "+C.border}}>
                <div><div style={{fontSize:14}}>Ackumulerat ISK</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Inkl. barnbidrag ({monthsUpToNow.length} mån)</div></div>
                <span style={{fontSize:16,fontWeight:700,color:C.blue}}>{fmt(accISK)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid "+C.border}}>
                <div><div style={{fontSize:14}}>Snitt per månad {currentYear}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Mål: 15 000 kr/mån</div></div>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:16,fontWeight:700,color:iskAvg>=15000?C.green:C.red}}>{fmt(iskAvg)}</span>
                  <div style={{fontSize:11,color:iskAvg>=15000?C.green:C.red,marginTop:2}}>{iskAvg>=15000?"✅ Över mål":"⚠️ Under mål"}</div>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px"}}>
                <div><div style={{fontSize:14}}>Fickpengar, snitt/mån</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Snitt över alla månader</div></div>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:16,fontWeight:700,color:fpSnitt<=4000?C.green:C.red}}>{fmt(fpSnitt)}</span>
                  <div style={{fontSize:11,color:fpSnitt<=4000?C.green:C.red,marginTop:2}}>{fpSnitt<=4000?"✅ Under 4 000":"⚠️ Över 4 000"}</div>
                </div>
              </div>
            </div>

            <ISKSplitCard
              alexTransfer={month.income.alexSalary + month.income.alexOther - perPerson}
              emilieTransfer={month.income.emilieSalary + month.income.emilieOther - perPerson}
              alexISK={alexISK} emilieISK={emilieISK} totalISK={totalISK}
              childBenefit={childBenefit} minEmilie={MIN_EMILIE}
              onSetEmilieISK={setISKSplit} locked={locked} />

            <div style={{background:C.card,borderRadius:14,padding:"12px 14px",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>📝 Anteckning</div>
              {locked
                ? <div style={{fontSize:13,color:month.note?C.text:C.muted,fontStyle:month.note?"normal":"italic"}}>{month.note||"Ingen anteckning"}</div>
                : <textarea rows={2} value={month.note||""} onChange={function(e){setNote(e.target.value);}} onBlur={function(e){setNote(e.target.value);}}
                    placeholder="Noteringar för månaden..."
                    style={{width:"100%",background:"transparent",border:"none",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none",lineHeight:1.5}} />}
            </div>

            <div style={{display:"flex",gap:8}}>
              {pill("← Sparande", function(){setStep(2);}, false)}
              {!locked
                ? pill("🔒 Lås månad", function(){if(window.confirm("Lås månaden? Du kan låsa upp igen om du behöver ändra.")) onPatch(function(m){return Object.assign({},m,{locked:true});});}, true)
                : <div style={{flex:1,textAlign:"center",fontSize:13,color:C.muted,padding:14}}>Månad låst ✓</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ISKSplitCard ─────────────────────────────────────────────────────────────
function ISKSplitCard(props) {
  var alexTransfer = props.alexTransfer;
  var emilieTransfer = props.emilieTransfer;
  var alexISK = props.alexISK;
  var emilieISK = props.emilieISK;
  var totalISK = props.totalISK;
  var childBenefit = props.childBenefit;
  var minEmilie = props.minEmilie;
  var onSetEmilieISK = props.onSetEmilieISK;
  var locked = props.locked;

  var alexToTrans = alexTransfer - alexISK;
  var emilieToTrans = emilieTransfer - emilieISK;

  function copyText(text) { if(navigator.clipboard) navigator.clipboard.writeText(text); }

  function ISKIn(iprops) {
    var value = iprops.value;
    var onChange = iprops.onChange;
    var ref = useRef(null);
    var initialF = value > 0 ? new Intl.NumberFormat("sv-SE").format(value) : "0";
    var rawRef = useRef(String(value));
    var [display, setDisplay] = useState(initialF);
    var prevVal = useRef(value);
    useEffect(function() {
      if (prevVal.current !== value && document.activeElement !== ref.current) {
        prevVal.current = value;
        var f = new Intl.NumberFormat("sv-SE").format(value);
        rawRef.current = f; setDisplay(f);
      }
    }, [value]);
    return (
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <input ref={ref} type="text" inputMode="numeric" value={display} disabled={locked}
          onChange={function(e){var d=e.target.value.replace(/[^0-9]/g,"");rawRef.current=d;setDisplay(d);}}
          onFocus={function(e){var n=parseInt(rawRef.current.replace(/[^0-9]/g,""),10)||0;var s=String(n);rawRef.current=s;setDisplay(s);setTimeout(function(){if(ref.current)ref.current.select();},0);}}
          onBlur={function(){var n=parseInt(rawRef.current.replace(/[^0-9]/g,""),10)||0;onChange(n);var f=new Intl.NumberFormat("sv-SE").format(n);rawRef.current=f;setDisplay(f);}}
          style={{width:100,padding:"6px 10px",background:locked?"transparent":"#dbeafe",border:locked?"none":"1px solid #90cdf4",borderRadius:8,color:C.text,fontSize:13,textAlign:"right",outline:"none",fontFamily:C.font,opacity:locked?0.7:1}} />
        <span style={{color:C.muted,fontSize:12}}>kr</span>
      </div>
    );
  }

  return (
    <div style={{background:"#ebf4ff",border:"1px solid #90cdf4",borderRadius:16,padding:16,marginBottom:12}}>
      <p style={{fontSize:11,color:C.blue,letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 12px"}}>📋 Att föra över</p>

      <div style={{background:"#dbeafe",borderRadius:12,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",margin:0}}>Transaktionskonto (gemensamt)</p>
          <button onClick={function(){copyText("Till transaktionskonto:\nAlex: "+fmt(alexToTrans)+"\nEmilie: "+fmt(emilieToTrans));}} style={{background:"none",border:"none",color:C.blue,fontSize:11,cursor:"pointer",fontFamily:C.font}}>Kopiera</button>
        </div>
        {[["Alex",alexToTrans],["Emilie",emilieToTrans]].map(function(row) {
          return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:14}}>{row[0]}</span>
            <span style={{fontSize:14,fontWeight:700,color:C.blue}}>{fmt(row[1])}</span>
          </div>;
        })}
      </div>

      <div style={{background:"#dbeafe",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",margin:0}}>ISK (totalt {fmt(totalISK)})</p>
          <button onClick={function(){copyText("Till ISK:\nAlex ISK: "+fmt(alexISK)+"\nEmilie ISK: "+fmt(emilieISK)+" (inkl. barnbidrag "+fmt(childBenefit)+")");}} style={{background:"none",border:"none",color:C.blue,fontSize:11,cursor:"pointer",fontFamily:C.font}}>Kopiera</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:14}}>Alex ISK</span>
          <ISKIn value={alexISK} onChange={function(v){var clamped=Math.max(0,Math.min(v,totalISK-minEmilie));onSetEmilieISK(totalISK-clamped);}} />
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={{fontSize:14}}>Emilie ISK</span>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>Min {fmt(minEmilie)} (barnbidrag)</div>
          </div>
          <ISKIn value={emilieISK} onChange={onSetEmilieISK} />
        </div>
      </div>

      <div style={{borderTop:"1px solid #90cdf4",paddingTop:12}}>
        <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Total överföring (transaktion + ISK)</p>
        {[["Alex",alexTransfer],["Emilie",emilieTransfer]].map(function(row) {
          return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:14,color:C.muted}}>{row[0]}</span>
            <span style={{fontSize:14,fontWeight:600,color:C.muted}}>{fmt(row[1])}</span>
          </div>;
        })}
      </div>
    </div>
  );
}


// ── YearBudget ────────────────────────────────────────────────────────────────
function YearBudget(props) {
  var yearData = props.yearData;
  var monthData = props.monthData;
  var onBack = props.onBack;
  var patchYear = props.patchYear;
  var year = new Date().getFullYear();
  var months = Object.keys(monthData).sort();
  var nM = months.length;

  // ── Actuals from month data ──
  var actualExpTotal = {};
  var actualExpAvg = {};
  DEFAULT_EXPENSES.forEach(function(def) { actualExpTotal[def.id]=0; actualExpAvg[def.id]=0; });
  months.forEach(function(k) {
    monthData[k].expenses.forEach(function(e) {
      if (actualExpTotal[e.id]!==undefined) actualExpTotal[e.id]+=(e.amount||0);
    });
  });
  Object.keys(actualExpTotal).forEach(function(id) {
    actualExpAvg[id] = nM>0 ? Math.round(actualExpTotal[id]/nM) : 0;
  });

  var actualISKTotal = months.reduce(function(a,k){ var m=monthData[k]; return a+(m.savings&&m.savings.isk||0); },0);
  var actualBarnTotal = months.reduce(function(a,k){ return a+(monthData[k].income&&monthData[k].income.childBenefit||0); },0);
  var actualISKInclBarn = actualISKTotal + actualBarnTotal;
  var actualISKAvg = nM>0 ? Math.round(actualISKInclBarn/nM) : 0;
  var actualTravelTotal = months.reduce(function(a,k){ return a+(monthData[k].savings&&monthData[k].savings.travel||0); },0);
  var actualHomeTotal = months.reduce(function(a,k){ return a+(monthData[k].savings&&monthData[k].savings.reserve||0); },0);
  var actualRevTotal = actualExpTotal["revolut"]||0;
  var actualFixedTotal = ["loan","fee","broadband","insurance","tibber","boo","car","preschool","csn"].reduce(function(a,id){ return a+(actualExpTotal[id]||0); },0);

  var iskByMonth = {};
  months.forEach(function(k){ var m=monthData[k]; iskByMonth[k]=(m.savings&&m.savings.isk||0)+(m.income&&m.income.childBenefit||0); });

  // ── Budget values ──
  function getBudgetExp(id) {
    if (yearData.expenses&&yearData.expenses[id]!=null) return yearData.expenses[id];
    return (actualExpAvg[id]||0)*12;
  }
  function setBudgetExp(id,v) {
    patchYear(function(y){ var e=Object.assign({},y.expenses||{}); e[id]=v; return Object.assign({},y,{expenses:e}); });
  }

  var reserved = yearData.reserved||{};
  var barnbidragBudget = yearData.income.barnbidrag!=null ? yearData.income.barnbidrag : 2650*12;
  var totalIncBudget = (yearData.income.alexSalary||0)+(yearData.income.alexOther||0)+
    (yearData.income.emilieSalary||0)+(yearData.income.emilieOther||0)+
    (yearData.extraIncome||[]).reduce(function(a,r){return a+(r.amount||0);},0);

  var fixedIds = ["loan","fee","broadband","insurance","tibber","boo","car","preschool","csn"];
  var totalFixedBudget = fixedIds.reduce(function(a,id){return a+getBudgetExp(id);},0)+
    (yearData.extraExpenses||[]).reduce(function(a,r){return a+(r.amount||0);},0);
  var revolBudget = getBudgetExp("revolut");
  var travelBudget = reserved.travel||0;
  var homeBudget = reserved.home||0;
  var otherBudget = reserved.other||0;
  var totalVardagBudget = revolBudget+travelBudget+homeBudget+otherBudget;
  var iskGoal = yearData.iskGoal||180000;
  var barnGoal = barnbidragBudget;

  // Överskott = Inkomster - Fasta - Vardagsbudget - ISKmål (barnbidrag ej med, det är separat)
  var balance = totalIncBudget - totalFixedBudget - totalVardagBudget - iskGoal;

  // Actual totals
  var actualIncTotal = months.reduce(function(a,k){
    var m=monthData[k];
    return a+(m.income.alexSalary||0)+(m.income.alexOther||0)+(m.income.emilieSalary||0)+(m.income.emilieOther||0)+
      (yearData.extraIncome||[]).reduce(function(b,r){return b;},0);
  },0);
  var actualVardagTotal = actualRevTotal+actualTravelTotal+actualHomeTotal;

  // ── Status summary ──
  var iskOnTrack = actualISKAvg >= 15000;
  var iskLeft = Math.max(0, iskGoal+barnGoal-actualISKInclBarn);

  // ── Input components ──
  function NumIn(p) {
    var value=p.value||0, onChange=p.onChange, width=p.width||100;
    var ref=useRef(null);
    var [disp,setDisp]=useState(value>0?new Intl.NumberFormat("sv-SE").format(value):"");
    var pv=useRef(value);
    useEffect(function(){
      if(pv.current!==value&&document.activeElement!==ref.current){
        pv.current=value; setDisp(value>0?new Intl.NumberFormat("sv-SE").format(value):"");
      }
    },[value]);
    return <div style={{display:"flex",alignItems:"center",gap:4}}>
      <input ref={ref} type="text" inputMode="numeric" value={disp}
        onChange={function(e){setDisp(e.target.value.replace(/[^0-9]/g,""));}}
        onFocus={function(){var n=parseInt(disp.replace(/[^0-9]/g,""),10)||0;setDisp(n>0?String(n):"");setTimeout(function(){if(ref.current)ref.current.select();},0);}}
        onBlur={function(){var n=parseInt(disp.replace(/[^0-9]/g,""),10)||0;onChange(n);setDisp(n>0?new Intl.NumberFormat("sv-SE").format(n):"");}}
        placeholder="0"
        style={{width:width,padding:"6px 9px",background:C.card2,border:"none",borderRadius:8,color:C.text,fontSize:12,textAlign:"right",outline:"none",fontFamily:C.font}}/>
      <span style={{fontSize:11,color:C.muted}}>kr</span>
    </div>;
  }

  function StrIn(p) {
    var [local,setLocal]=useState(p.value||"");
    var pv=useRef(p.value||"");
    useEffect(function(){if(pv.current!==p.value){pv.current=p.value||"";setLocal(p.value||"");}},[p.value]);
    return <input type="text" value={local} onChange={function(e){setLocal(e.target.value);}}
      onBlur={function(){p.onChange(local);}} placeholder={p.placeholder||""}
      style={{flex:1,padding:"6px 8px",background:"transparent",border:"none",color:C.muted,fontSize:12,outline:"none",fontFamily:C.font,minWidth:0}}/>;
  }

  function SH(p) {
    return <div style={{background:p.color,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:14}}>{p.icon}</span>
      <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#fff"}}>{p.title}</span>
    </div>;
  }

  function ColH() {
    return <div style={{display:"flex",padding:"5px 16px",borderBottom:"1px solid "+C.border,background:C.card2,gap:8}}>
      <span style={{flex:1}}></span>
      <span style={{width:110,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Budget/år</span>
      <span style={{width:90,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Hittills</span>
      <span style={{width:100,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Prognos helår</span>
    </div>;
  }

  function Row(p) {
    var proj = nM>0&&p.actualTotal!=null ? Math.round((p.actualTotal/nM)*12) : null;
    var diff = proj!=null&&p.budget>0 ? proj-p.budget : null;
    var diffPct = diff!=null&&p.budget>0 ? Math.round(Math.abs(diff)/p.budget*100) : null;
    return <div style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+C.border,gap:8}}>
      <span style={{flex:1,fontSize:13,color:C.text}}>{p.label}</span>
      {p.input||<span style={{width:110,textAlign:"right",fontSize:12,fontWeight:500}}>{fmt(p.budget)}</span>}
      <span style={{width:90,textAlign:"right",fontSize:12,color:C.muted}}>{p.actualTotal!=null&&nM>0?fmt(p.actualTotal):"—"}</span>
      <div style={{width:100,textAlign:"right"}}>
        {proj!=null ? <div>
          <div style={{fontSize:12,fontWeight:500,color:diff===null?C.text:diff>0?C.red:C.green}}>{fmt(proj)}</div>
          {diffPct>0&&<div style={{fontSize:10,color:diff>0?C.red:C.green}}>{diff>0?"+":"-"}{diffPct}%</div>}
        </div> : <span style={{fontSize:12,color:C.muted}}>—</span>}
      </div>
    </div>;
  }


  // ── Status summary ──
  var iskOnTrack = actualISKAvg >= 15000;
  var iskLeft = Math.max(0, iskGoal+barnGoal-actualISKInclBarn);

  // ── Input components ──
  function NumIn(p) {
    var value=p.value||0, onChange=p.onChange, width=p.width||100;
    var ref=useRef(null);
    var [disp,setDisp]=useState(value>0?new Intl.NumberFormat("sv-SE").format(value):"");
    var pv=useRef(value);
    useEffect(function(){
      if(pv.current!==value&&document.activeElement!==ref.current){
        pv.current=value; setDisp(value>0?new Intl.NumberFormat("sv-SE").format(value):"");
      }
    },[value]);
    return <div style={{display:"flex",alignItems:"center",gap:4}}>
      <input ref={ref} type="text" inputMode="numeric" value={disp}
        onChange={function(e){setDisp(e.target.value.replace(/[^0-9]/g,""));}}
        onFocus={function(){var n=parseInt(disp.replace(/[^0-9]/g,""),10)||0;setDisp(n>0?String(n):"");setTimeout(function(){if(ref.current)ref.current.select();},0);}}
        onBlur={function(){var n=parseInt(disp.replace(/[^0-9]/g,""),10)||0;onChange(n);setDisp(n>0?new Intl.NumberFormat("sv-SE").format(n):"");}}
        placeholder="0"
        style={{width:width,padding:"6px 9px",background:C.card2,border:"none",borderRadius:8,color:C.text,fontSize:12,textAlign:"right",outline:"none",fontFamily:C.font}}/>
      <span style={{fontSize:11,color:C.muted}}>kr</span>
    </div>;
  }

  function StrIn(p) {
    var [local,setLocal]=useState(p.value||"");
    var pv=useRef(p.value||"");
    useEffect(function(){if(pv.current!==p.value){pv.current=p.value||"";setLocal(p.value||"");}},[p.value]);
    return <input type="text" value={local} onChange={function(e){setLocal(e.target.value);}}
      onBlur={function(){p.onChange(local);}} placeholder={p.placeholder||""}
      style={{flex:1,padding:"6px 8px",background:"transparent",border:"none",color:C.muted,fontSize:12,outline:"none",fontFamily:C.font,minWidth:0}}/>;
  }

  function SH(p) {
    return <div style={{background:p.color,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:14}}>{p.icon}</span>
      <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#fff"}}>{p.title}</span>
    </div>;
  }

  function ColH() {
    return <div style={{display:"flex",padding:"5px 16px",borderBottom:"1px solid "+C.border,background:C.card2,gap:8}}>
      <span style={{flex:1}}></span>
      <span style={{width:110,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Budget/år</span>
      <span style={{width:90,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Hittills</span>
      <span style={{width:100,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Prognos helår</span>
    </div>;
  }

  function Row(p) {
    var proj = nM>0&&p.actualTotal!=null ? Math.round((p.actualTotal/nM)*12) : null;
    var diff = proj!=null&&p.budget>0 ? proj-p.budget : null;
    var diffPct = diff!=null&&p.budget>0 ? Math.round(Math.abs(diff)/p.budget*100) : null;
    return <div style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+C.border,gap:8}}>
      <span style={{flex:1,fontSize:13,color:C.text}}>{p.label}</span>
      {p.input||<span style={{width:110,textAlign:"right",fontSize:12,fontWeight:500}}>{fmt(p.budget)}</span>}
      <span style={{width:90,textAlign:"right",fontSize:12,color:C.muted}}>{p.actualTotal!=null&&nM>0?fmt(p.actualTotal):"—"}</span>
      <div style={{width:100,textAlign:"right"}}>
        {proj!=null ? <div>
          <div style={{fontSize:12,fontWeight:500,color:diff===null?C.text:diff>0?C.red:C.green}}>{fmt(proj)}</div>
          {diffPct>0&&<div style={{fontSize:10,color:diff>0?C.red:C.green}}>{diff>0?"+":"-"}{diffPct}%</div>}
        </div> : <span style={{fontSize:12,color:C.muted}}>—</span>}
      </div>
    </div>;
  }

  // ── ISK Chart ──
  function ISKChart() {
    var [exp, setExp] = useState(false);
    var W=exp?600:340, H=exp?280:170;
    var pL=44,pR=14,pT=12,pB=26,cW=W-pL-pR,cH=H-pT-pB;
    var maxY=Math.max((iskGoal+barnGoal)*1.1,actualISKInclBarn*1.15,15000*14);

    function pts(fn) {
      var arr=[];
      for(var i=0;i<=12;i++) { var v=fn(i); arr.push((pL+(i/12)*cW)+","+(pT+cH-(v/maxY)*cH)); }
      return arr.join(" ");
    }

    var goalPts=pts(function(i){return 15000*i;});

    var actualPts=[],cumISK=0,lastX=pL,lastY=pT+cH;
    months.forEach(function(k){
      cumISK+=iskByMonth[k]||0;
      var mo=parseInt(k.split("-")[1])-1;
      var x=pL+((mo+1)/12)*cW, y=pT+cH-(cumISK/maxY)*cH;
      actualPts.push(x+","+y); lastX=x; lastY=y;
    });

    var trendPts="";
    if(nM>=1){
      var rem=12-nM;
      var projEnd=cumISK+actualISKAvg*rem;
      trendPts=lastX+","+lastY+" "+(pL+cW)+","+(pT+cH-(projEnd/maxY)*cH);
    }

    var mL=["J","F","M","A","M","J","J","A","S","O","N","D"];

    function Chart(cw,ch) {
      return <svg width={cw} height={ch} style={{overflow:"visible",maxWidth:"100%",cursor:"zoom-in"}} onClick={function(){setExp(true);}}>
        {[0,1,2,3,4].map(function(i){
          var val=(maxY/4)*i, y=pT+cH-(val/maxY)*cH;
          return <g key={i}>
            <line x1={pL} y1={y} x2={pL+cW} y2={y} stroke={C.border} strokeWidth="1"/>
            <text x={pL-5} y={y+4} fontSize="9" fill={C.muted} textAnchor="end">{val>=10000?Math.round(val/1000)+"k":val}</text>
          </g>;
        })}
        {mL.map(function(l,i){return <text key={i} x={pL+((i+0.5)/12)*cW} y={ch-pB+14} fontSize="9" fill={C.muted} textAnchor="middle">{l}</text>;})}
        <polyline points={goalPts} fill="none" stroke={C.blue} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5"/>
        {actualPts.length>0&&<polyline points={actualPts.join(" ")} fill="none" stroke={C.green} strokeWidth="2.5"/>}
        {trendPts&&<polyline points={trendPts} fill="none" stroke={C.orange} strokeWidth="1.5" strokeDasharray="5,4"/>}
        {actualPts.length>0&&(function(){var p=actualPts[actualPts.length-1].split(",");return <circle cx={parseFloat(p[0])} cy={parseFloat(p[1])} r="4" fill={C.green} stroke="#fff" strokeWidth="1.5"/>;})()}
        {trendPts&&(function(){var p=trendPts.split(" ")[1].split(",");return <circle cx={parseFloat(p[0])} cy={parseFloat(p[1])} r="3" fill={C.orange} stroke="#fff" strokeWidth="1.5"/>;})()}
      </svg>;
    }

    return <div style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:16,border:"1px solid "+C.border}}>
      {exp&&<div onClick={function(){setExp(false);}} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div onClick={function(e){e.stopPropagation();}} style={{background:C.card,borderRadius:20,padding:"22px 24px",maxWidth:680,width:"93%",position:"relative"}}>
          <button onClick={function(){setExp(false);}} style={{position:"absolute",top:12,right:16,background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.muted}}>✕</button>
          <div style={{fontSize:14,fontWeight:600,marginBottom:2}}>ISK-sparande {year}</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Ackumulerat inkl. barnbidrag — mål 15 000 kr/mån</div>
          {Chart(W,H)}
          <div style={{display:"flex",gap:16,marginTop:10}}>
            {[["Mål 15k/mån",C.blue,"4,3"],["Faktiskt",C.green,""],["Prognos",C.orange,"5,4"]].map(function(r){
              return <div key={r[0]} style={{display:"flex",alignItems:"center",gap:5}}>
                <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke={r[1]} strokeWidth="2" strokeDasharray={r[2]}/></svg>
                <span style={{fontSize:10,color:C.muted}}>{r[0]}</span>
              </div>;
            })}
          </div>
        </div>
      </div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:600}}>ISK-sparande {year}</div>
          <div style={{fontSize:11,color:C.muted}}>Ackumulerat inkl. barnbidrag</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,fontWeight:600,color:actualISKAvg>=15000?C.green:C.orange}}>{fmt(actualISKAvg)}/mån</div>
            <div style={{fontSize:10,color:C.muted}}>snitt hittills</div>
          </div>
          <button onClick={function(){setExp(true);}} title="Förstora" style={{background:C.card2,border:"1px solid "+C.border,borderRadius:8,padding:"5px 8px",cursor:"zoom-in",fontSize:14,color:C.muted,fontFamily:C.font}}>🔍</button>
        </div>
      </div>
      {Chart(340,170)}
      <div style={{display:"flex",gap:14,marginTop:6}}>
        {[["Mål 15k/mån",C.blue,"4,3"],["Faktiskt",C.green,""],["Prognos",C.orange,"5,4"]].map(function(r){
          return <div key={r[0]} style={{display:"flex",alignItems:"center",gap:4}}>
            <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={r[1]} strokeWidth="2" strokeDasharray={r[2]}/></svg>
            <span style={{fontSize:10,color:C.muted}}>{r[0]}</span>
          </div>;
        })}
      </div>
    </div>;
  }

  // ── Status summary ──
  function StatusSummary() {
    var iskColor = actualISKAvg>=15000 ? C.green : actualISKAvg>=12000 ? C.orange : C.red;
    var iskIcon = actualISKAvg>=15000 ? "🟢" : actualISKAvg>=12000 ? "🟡" : "🔴";
    var balColor = balance>=0 ? C.green : C.red;
    var iskTarget = iskGoal + barnGoal;
    var rows = [];
    if(nM>0) {
      rows.push([iskIcon+" ISK-snitt", fmt(actualISKAvg)+"/mån", actualISKAvg>=15000?"Över mål (15 000 kr/mån) ✅":"Under mål — mål: 15 000 kr/mån", iskColor]);
      rows.push(["💰 Sparat hittills", fmt(actualISKInclBarn), nM+" mån inmatade — "+Math.round((actualISKInclBarn/iskTarget)*100)+"% av årsmål", C.muted]);
    }
    rows.push(["⚖️ Budgetöverskott", fmt(balance), balance>=0?"God marginal i budgeten":"Budgeten går minus", balColor]);

    return <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"2px solid "+(iskColor)}}>
      <div style={{background:iskColor,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#fff"}}>📊 Årssammanfattning {year}</span>
      </div>
      {rows.map(function(r,i){
        return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:i<rows.length-1?"1px solid "+C.border:"none"}}>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>{r[0]}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{r[2]}</div>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:r[3]}}>{r[1]}</span>
        </div>;
      })}
    </div>;
  }

  return <div style={{maxWidth:640,margin:"0 auto",paddingBottom:48}}>
    <div style={{position:"sticky",top:0,background:"rgba(250,248,243,0.97)",backdropFilter:"blur(20px)",padding:"18px 20px 14px",zIndex:10,borderBottom:"1px solid "+C.border}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.blue,fontSize:14,cursor:"pointer",fontFamily:C.font,padding:0}}>← Översikt</button>
      <h2 style={{fontSize:22,fontWeight:600,margin:"8px 0 2px"}}>Årsbudget {year}</h2>
      <p style={{fontSize:12,color:C.muted}}>{nM>0?"Faktiskt baserat på "+nM+" månader":"Inga månader inmatade ännu"}</p>
    </div>

    <div style={{padding:"16px"}}>

      <StatusSummary/>

      <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <SH icon="💰" title="Inkomster (bedömt helår, exkl. barnbidrag)" color="#276749"/>
        <ColH/>
        {[["Alex lön","alexSalary"],["Alex övrigt","alexOther"],["Emilie lön","emilieSalary"],["Emilie övrigt","emilieOther"]].map(function(r){
          var field=r[1];
          var actTotal=nM>0?months.reduce(function(a,k){return a+(monthData[k].income[field]||0);},0):0;
          return <Row key={field} label={r[0]} budget={yearData.income[field]||0} actualTotal={nM>0?actTotal:null}
            input={<NumIn value={yearData.income[field]||0} width={100} onChange={function(v){patchYear(function(y){var inc=Object.assign({},y.income);inc[field]=v;return Object.assign({},y,{income:inc});});}}/>}/>;
        })}
        {(yearData.extraIncome||[]).map(function(row,i){
          return <div key={row.id} style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+C.border,gap:8}}>
            <StrIn value={row.label} placeholder="Benämning..." onChange={function(v){patchYear(function(y){var ei=[...y.extraIncome];ei[i]=Object.assign({},ei[i],{label:v});return Object.assign({},y,{extraIncome:ei});});}}/>
            <NumIn value={row.amount||0} width={100} onChange={function(v){patchYear(function(y){var ei=[...y.extraIncome];ei[i]=Object.assign({},ei[i],{amount:v});return Object.assign({},y,{extraIncome:ei});});}}/>
            <span style={{width:90}}></span><span style={{width:100}}></span>
            <button onClick={function(){patchYear(function(y){return Object.assign({},y,{extraIncome:y.extraIncome.filter(function(_,j){return j!==i;})});});}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:13,padding:0}}>✕</button>
          </div>;
        })}
        <div style={{padding:"8px 16px",borderBottom:"1px solid "+C.border}}>
          <button onClick={function(){patchYear(function(y){return Object.assign({},y,{extraIncome:[...(y.extraIncome||[]),{id:"ei_"+Date.now(),label:"",amount:0}]});});}} style={{background:"none",border:"none",color:C.blue,fontSize:12,cursor:"pointer",fontFamily:C.font}}>+ Lägg till inkomst</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",background:"#f0faf4"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.green}}>Totala inkomster</span>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.green}}>{fmt(totalIncBudget)}</div>
            {nM>0&&<div style={{fontSize:11,color:C.muted}}>Hittills: {fmt(actualIncTotal)}</div>}
          </div>
        </div>
      </div>

      <div style={{background:C.card,borderRadius:14,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <div style={{display:"flex",padding:"5px 16px",borderBottom:"1px solid "+C.border,background:C.card2,gap:8}}>
          <span style={{flex:1,fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Barnbidrag → barnspar (öronmärkt till ISK)</span>
          <span style={{width:110,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Budget/år</span>
          <span style={{width:90,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Hittills</span>
          <span style={{width:100,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Prognos helår</span>
        </div>
        <div style={{display:"flex",alignItems:"center",padding:"9px 16px",gap:8}}>
          <span style={{flex:1,fontSize:13,color:C.text}}>Barnbidrag</span>
          <NumIn value={barnbidragBudget} width={100} onChange={function(v){patchYear(function(y){var inc=Object.assign({},y.income);inc.barnbidrag=v;return Object.assign({},y,{income:inc});});}}/>
          <span style={{width:90,textAlign:"right",fontSize:12,color:C.muted}}>{nM>0?fmt(actualBarnTotal):"—"}</span>
          <span style={{width:100,textAlign:"right",fontSize:12,fontWeight:500,color:C.green}}>{nM>0?fmt(Math.round((actualBarnTotal/nM)*12)):"—"}</span>
        </div>
      </div>

      <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <SH icon="📋" title="Fasta utgifter" color="#9b2c2c"/>
        <ColH/>
        {fixedIds.map(function(id){
          var def=DEFAULT_EXPENSES.find(function(e){return e.id===id;});
          if(!def)return null;
          return <Row key={id} label={def.label} budget={getBudgetExp(id)}
            actualTotal={nM>0?actualExpTotal[id]||0:null}
            input={<NumIn value={getBudgetExp(id)} width={100} onChange={function(v){setBudgetExp(id,v);}}/>}/>;
        })}
        {(yearData.extraExpenses||[]).map(function(row,i){
          return <div key={row.id} style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+C.border,gap:8}}>
            <StrIn value={row.label} placeholder="Benämning..." onChange={function(v){patchYear(function(y){var ee=[...y.extraExpenses];ee[i]=Object.assign({},ee[i],{label:v});return Object.assign({},y,{extraExpenses:ee});});}}/>
            <NumIn value={row.amount||0} width={100} onChange={function(v){patchYear(function(y){var ee=[...y.extraExpenses];ee[i]=Object.assign({},ee[i],{amount:v});return Object.assign({},y,{extraExpenses:ee});});}}/>
            <span style={{width:90}}></span><span style={{width:100}}></span>
            <button onClick={function(){patchYear(function(y){return Object.assign({},y,{extraExpenses:y.extraExpenses.filter(function(_,j){return j!==i;})});});}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:13,padding:0}}>✕</button>
          </div>;
        })}
        <div style={{padding:"8px 16px",borderBottom:"1px solid "+C.border}}>
          <button onClick={function(){patchYear(function(y){return Object.assign({},y,{extraExpenses:[...(y.extraExpenses||[]),{id:"ee_"+Date.now(),label:"",amount:0}]});});}} style={{background:"none",border:"none",color:C.blue,fontSize:12,cursor:"pointer",fontFamily:C.font}}>+ Lägg till utgift</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"#fff5f5"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.red}}>Summa fasta utgifter</span>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.red}}>{fmt(totalFixedBudget)}</div>
            {nM>0&&<div style={{fontSize:11,color:C.muted}}>Hittills: {fmt(actualFixedTotal)}</div>}
          </div>
        </div>
      </div>

      <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <SH icon="🛒" title="Vardagsbudget & rörliga utgifter" color="#744210"/>
        <ColH/>
        <Row label="Fickpengar" budget={revolBudget} actualTotal={nM>0?actualRevTotal:null}
          input={<NumIn value={revolBudget} width={100} onChange={function(v){setBudgetExp("revolut",v);}}/>}/>
        <Row label="Resor (resekonto)" budget={travelBudget} actualTotal={nM>0?actualTravelTotal:null}
          input={<NumIn value={travelBudget} width={100} onChange={function(v){patchYear(function(y){var r=Object.assign({},y.reserved||{});r.travel=v;return Object.assign({},y,{reserved:r});});}}/>}/>
        <Row label="Hem & inköp (transaktionskonto)" budget={homeBudget} actualTotal={nM>0?actualHomeTotal:null}
          input={<NumIn value={homeBudget} width={100} onChange={function(v){patchYear(function(y){var r=Object.assign({},y.reserved||{});r.home=v;return Object.assign({},y,{reserved:r});});}}/>}/>
        <Row label="Övrigt" budget={otherBudget} actualTotal={null}
          input={<NumIn value={otherBudget} width={100} onChange={function(v){patchYear(function(y){var r=Object.assign({},y.reserved||{});r.other=v;return Object.assign({},y,{reserved:r});});}}/>}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"#fffbeb"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.orange}}>Summa vardagsbudget</span>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.orange}}>{fmt(totalVardagBudget)}</div>
            {nM>0&&<div style={{fontSize:11,color:C.muted}}>Hittills: {fmt(actualVardagTotal)}</div>}
          </div>
        </div>
      </div>

      <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <SH icon="🏦" title="Sparande (ISK)" color="#1a5c32"/>
        <div style={{padding:"13px 16px",borderBottom:"1px solid "+C.border}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:nM>0?10:0}}>
            <div>
              <div style={{fontSize:13}}>ISK-mål per år (exkl. barnbidrag)</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>Totalt mål inkl. barnbidrag: {fmt(iskGoal+barnGoal)}</div>
            </div>
            <NumIn value={iskGoal} width={110} onChange={function(v){patchYear(function(y){return Object.assign({},y,{iskGoal:v});});}}/>
          </div>
          {nM>0&&<div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:11,color:C.muted}}>Faktiskt sparat inkl. barnbidrag ({nM} mån)</span>
              <span style={{fontSize:12,fontWeight:600,color:C.green}}>{fmt(actualISKInclBarn)}</span>
            </div>
            <div style={{height:5,background:C.border,borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",background:C.green,borderRadius:99,width:Math.min(100,Math.round((actualISKInclBarn/(iskGoal+barnGoal))*100))+"%"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:10,color:C.muted}}>{Math.round((actualISKInclBarn/(iskGoal+barnGoal))*100)}% av totalt mål</span>
              <span style={{fontSize:10,color:C.muted}}>{iskLeft>0?fmt(iskLeft)+" kvar":"Mål uppnått ✅"}</span>
            </div>
          </div>}
        </div>
      </div>


      <div style={{background:balance>=0?"#f0faf4":"#fff5f5",borderRadius:16,padding:"18px 20px",marginBottom:16,border:"2px solid "+(balance>=0?C.green:C.red)}}>
        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>📊 Årskalkyl</div>
        {[
          ["Totala inkomster (exkl. barnbidrag)",totalIncBudget,C.green,true],
          ["Fasta utgifter",totalFixedBudget,C.red,false],
          ["Vardagsbudget & rörliga",totalVardagBudget,C.orange,false],
          ["ISK-sparande (mål exkl. barnbidrag)",iskGoal,C.blue,false],
        ].map(function(r){
          return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,color:C.muted}}>{r[0]}</span>
            <span style={{fontSize:13,fontWeight:500,color:r[2]}}>{r[3]?"+":"-"} {fmt(r[1])}</span>
          </div>;
        })}
        <div style={{borderTop:"2px solid "+(balance>=0?C.green:C.red),paddingTop:12,marginTop:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700}}>Överskott / underskott</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>Barnbidrag ({fmt(barnGoal)}/år) hanteras separat</div>
          </div>
          <span style={{fontSize:22,fontWeight:800,color:balance>=0?C.green:C.red}}>{balance>=0?"+":""}{fmt(balance)}</span>
        </div>
        {balance<0&&<p style={{fontSize:12,color:C.red,marginTop:8}}>⚠️ Budgeten går minus — justera inkomster eller minska utgifter.</p>}
        {balance>=0&&balance<10000&&<p style={{fontSize:12,color:C.orange,marginTop:8}}>⚠️ Litet överskott — begränsad buffert.</p>}
        {balance>=10000&&<p style={{fontSize:12,color:C.green,marginTop:8}}>✅ God marginal i budgeten.</p>}
      </div>

    </div>
  </div>;
}



export default App
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { loadAllData, saveAllData } from './supabase'



const STORAGE_KEY = "hushall-v4";
const YEAR_KEY = "hushall-year-v3";
const MONTHS_SV = ["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];

const C = {
  bg:"#faf8f3", card:"#ffffff", card2:"#f0ece0", border:"#e8e3d5",
  text:"#2c2c2c", muted:"#888880", blue:"#2c5282", green:"#276749", red:"#c53030", orange:"#c05621",
  tabBg:"#ede9de", accent:"#2c5282",
  font:"-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif",
};

const DEFAULT_EXPENSES = [
  { id:"revolut",   label:"Månadsbudget (överföring till Revolut gemensam)", amount:16000 },
  { id:"loan",      label:"Bolån",                                           amount:14500 },
  { id:"fee",       label:"Avgift (förening)",                               amount:0     },
  { id:"broadband", label:"Bredband",                                        amount:399   },
  { id:"insurance", label:"Försäkringar, totalt inkl. bilförsäkring",        amount:1296  },
  { id:"tibber",    label:"El (Tibber, elhandel)",                           amount:600   },
  { id:"boo",       label:"El (Boo Energi, distribution)",                   amount:600   },
  { id:"car",       label:"Bilkostnad",                                      amount:3957  },
  { id:"preschool", label:"Förskoleavgift",                                  amount:1574  },
  { id:"csn",       label:"CSN",                                             amount:2300  },
];
const FIXED_IDS = DEFAULT_EXPENSES.map(function(e) { return e.id; });

function fmt(n) {
  return new Intl.NumberFormat("sv-SE", {maximumFractionDigits:0}).format(n||0) + " kr";
}

function saveData(d) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
}

function loadData() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    var d = JSON.parse(raw);
    var labelMap = {};
    DEFAULT_EXPENSES.forEach(function(e) { labelMap[e.id] = e.label; });
    Object.keys(d).forEach(function(key) {
      if (!d[key] || !d[key].expenses) return;
      var ids = d[key].expenses.map(function(e) { return e.id; });
      DEFAULT_EXPENSES.forEach(function(def, di) {
        if (ids.indexOf(def.id) === -1) {
          d[key].expenses.splice(di, 0, Object.assign({}, def));
        }
      });
      d[key].expenses = d[key].expenses.map(function(e) {
        return labelMap[e.id] ? Object.assign({}, e, {label: labelMap[e.id]}) : e;
      });
      if (!d[key].note) d[key].note = "";
      if (!d[key].iskSplit) d[key].iskSplit = null;
    });
    return d;
  } catch(err) { return {}; }
}


function loadYearData() {
  try {
    var raw = localStorage.getItem(YEAR_KEY);
    if (raw) {
      var d = JSON.parse(raw);
      if (!d.extraIncome) d.extraIncome = [];
      if (!d.extraExpenses) d.extraExpenses = [];
      if (!d.accounts) d.accounts = {travel:{label:"Resekonto (Revolut)",balances:{}},transaction:{label:"Transaktionskonto",balances:{}}};
      return d;
    }
  } catch(e) {}
  return {
    income: { alexSalary:0, alexOther:0, emilieSalary:0, emilieOther:0 },
    extraIncome: [],
    expenses: {},
    extraExpenses: [],
    reserved: { travel:86000, home:84000, personal:96000, other:0 },
    iskGoal: 180000,
    accounts: {
      travel: { label:"Resekonto (Revolut)", balances:{} },
      transaction: { label:"Transaktionskonto", balances:{} },
    },
  };
}

function makeMonth(prev) {
  return {
    locked: false,
    note: "",
    iskSplit: null,
    income: prev ? Object.assign({}, prev.income) : {alexSalary:0,alexOther:0,emilieSalary:0,emilieOther:0,childBenefit:2650},
    expenses: prev ? prev.expenses.map(function(e) { return Object.assign({}, e); }) : DEFAULT_EXPENSES.map(function(e) { return Object.assign({}, e); }),
    savings: prev ? Object.assign({}, prev.savings) : {isk:12350,travel:3000,reserve:0},
  };
}

// ── NumInput ────────────────────────────────────────────────────────────────
function NumInput(props) {
  var value = props.value || 0;
  var onCommit = props.onCommit;
  var width = props.width || 120;
  var disabled = props.disabled || false;
  var onEnter = props.onEnter;

  var initialFormatted = value > 0 ? new Intl.NumberFormat("sv-SE").format(value) : "";
  var ref = useRef(null);
  var rawRef = useRef(initialFormatted);
  var [display, setDisplay] = useState(initialFormatted);
  var prevValue = useRef(value);

  useEffect(function() {
    if (prevValue.current !== value && document.activeElement !== ref.current) {
      prevValue.current = value;
      var f = value > 0 ? new Intl.NumberFormat("sv-SE").format(value) : "";
      rawRef.current = f;
      setDisplay(f);
    }
  }, [value]);

  function handleChange(e) {
    var digits = e.target.value.replace(/[^0-9]/g, "");
    rawRef.current = digits;
    setDisplay(digits);
  }

  function handleFocus(e) {
    var n = parseInt(rawRef.current.replace(/[^0-9]/g, ""), 10) || 0;
    var s = n > 0 ? String(n) : "";
    rawRef.current = s;
    setDisplay(s);
    setTimeout(function() { if(ref.current) ref.current.select(); }, 0);
  }

  function handleBlur() {
    var n = parseInt(rawRef.current.replace(/[^0-9]/g, ""), 10) || 0;
    onCommit(n);
    var f = n > 0 ? new Intl.NumberFormat("sv-SE").format(n) : "";
    rawRef.current = f;
    setDisplay(f);
  }

  function handleKey(e) {
    if (e.key === "Enter") {
      handleBlur();
      if (onEnter) onEnter(e);
    }
  }

  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <input ref={ref} type="text" inputMode="numeric" value={display} disabled={disabled}
        onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} onKeyDown={handleKey}
        placeholder="0"
        style={{width:width,padding:"8px 12px",background:disabled?"transparent":C.card2,
          border:"none",borderRadius:10,color:disabled?C.muted:C.text,fontSize:14,
          textAlign:"right",outline:"none",fontFamily:C.font,boxSizing:"border-box",
          opacity:disabled?0.6:1}} />
      <span style={{color:C.muted,fontSize:13}}>kr</span>
    </div>
  );
}

function focusNext(e) {
  var form = e.target.closest ? e.target.closest("[data-form]") : null;
  if (!form) return;
  var inputs = Array.from(form.querySelectorAll("input:not([disabled])"));
  var idx = inputs.indexOf(e.target);
  if (idx < inputs.length - 1) { e.preventDefault(); inputs[idx + 1].focus(); }
}

// ── App ─────────────────────────────────────────────────────────────────────
function App() {
  var [data, setData] = useState(function() { return loadData(); });
  var [yearData, setYearData] = useState(function() { return loadYearData(); });
  var [view, setView] = useState("overview");
  var [activeKey, setActiveKey] = useState(null);
  var [step, setStep] = useState(0);
  var [collapsed, setCollapsed] = useState({});
  var [saveStatus, setSaveStatus] = useState("Laddar...");
  var fileRef = useRef(null);
  var saveTimer = useRef(null);

  useEffect(function() {
    loadAllData().then(function(result) {
      if (result.monthData && Object.keys(result.monthData).length > 0) {
        setData(result.monthData); saveData(result.monthData);
      }
      if (result.yearData) { setYearData(result.yearData); saveYearData(result.yearData); }
      setSaveStatus("");
    }).catch(function() { setSaveStatus(""); });
  }, []);

  function triggerSave(nd, ny) {
    setSaveStatus("Sparar...");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function() {
      saveAllData(nd, ny).then(function() {
        setSaveStatus("✓ Sparad");
        setTimeout(function() { setSaveStatus(""); }, 2000);
      }).catch(function() { setSaveStatus("⚠ Fel"); setTimeout(function() { setSaveStatus(""); }, 3000); });
    }, 1000);
  }

  function persist(d) { setData(d); saveData(d); triggerSave(d, yearData); }
  function persistYear(d) { setYearData(d); saveYearData(d); triggerSave(data, d); }
  function patchYear(fn) { persistYear(fn(yearData)); }



  function openMonth(key) {
    setActiveKey(key);
    setStep(data[key] && data[key].locked ? 3 : 0);
    setView("month");
  }

  function createMonth(year, mon) {
    var key = year + "-" + String(mon).padStart(2, "0");
    var sorted = Object.keys(data).sort();
    var prev = sorted.length ? data[sorted[sorted.length - 1]] : null;
    var d = Object.assign({}, data);
    d[key] = makeMonth(prev);
    persist(d);
    setActiveKey(key);
    setStep(0);
    setView("month");
  }

  function patch(key, fn) {
    var d = Object.assign({}, data);
    d[key] = fn(data[key]);
    persist(d);
  }

  function toggleYear(yr) {
    setCollapsed(function(c) {
      var next = Object.assign({}, c);
      next[yr] = !next[yr];
      return next;
    });
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify({data:data,yearData:yearData},null,2)], {type:"application/json"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hushallsbudget-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
  }

  function importJSON(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var parsed = JSON.parse(ev.target.result);
        if (parsed.data) { setData(parsed.data); saveData(parsed.data); }
        if (parsed.yearData) { setYearData(parsed.yearData); saveYearData(parsed.yearData); }
        alert("Data importerad!");
      } catch(err) { alert("Fel vid import."); }
    };
    reader.readAsText(file);
  }

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:C.font}}>
      {view === "overview" && (
        <Overview data={data} onOpen={openMonth} onCreate={createMonth}
          onYearBudget={function() { setView("year"); }}
          collapsed={collapsed} onToggleYear={toggleYear}
          onExport={exportJSON} onImport={importJSON} fileRef={fileRef}
          saveStatus={saveStatus} />
      )}

      {view === "year" && (
        <YearBudget yearData={yearData} monthData={data}
          onBack={function() { setView("overview"); }} patchYear={patchYear} />
      )}
      {view === "month" && activeKey && (
        <MonthView monthKey={activeKey} month={data[activeKey]} step={step}
          setStep={setStep} onBack={function() { setView("overview"); }}
          allData={data} onPatch={function(fn) { patch(activeKey, fn); }}
          onNavigate={function(key) { setActiveKey(key); setStep(data[key]&&data[key].locked?3:0); }}
          prevMonth={function() {
            var keys = Object.keys(data).sort();
            var i = keys.indexOf(activeKey);
            return i > 0 ? data[keys[i-1]] : null;
          }} />
      )}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview(props) {
  var data = props.data;
  var onOpen = props.onOpen;
  var onCreate = props.onCreate;
  var onYearBudget = props.onYearBudget;
  var collapsed = props.collapsed;
  var onToggleYear = props.onToggleYear;
  var onExport = props.onExport;
  var onImport = props.onImport;
  var fileRef = props.fileRef;
  var saveStatus = props.saveStatus;

  var now = new Date();
  var currentYear = now.getFullYear();
  var yearSet = {};
  yearSet[currentYear] = true;
  Object.keys(data).forEach(function(k) { yearSet[parseInt(k.split("-")[0])] = true; });
  var years = Object.keys(yearSet).map(Number).sort();

  return (
    <div style={{maxWidth:600,margin:"0 auto",padding:"32px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:32}}>
        <div>
          <p style={{color:C.muted,fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>Hushållsbudget</p>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <h1 style={{fontSize:28,fontWeight:600}}>Översikt</h1>
            {saveStatus && <span style={{fontSize:12,color:saveStatus.includes("✓")?C.green:C.muted}}>{saveStatus}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onExport} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:"8px 12px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:C.font}}>💾 Exportera</button>
          <button onClick={function() { if(fileRef.current) fileRef.current.click(); }} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:"8px 12px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:C.font}}>📂 Importera</button>
          <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={onImport} />
        </div>
      </div>

      {years.map(function(year) {
        var isCollapsed = collapsed[year];
        var isCurrent = year === currentYear;
        return (
          <div key={year} style={{marginBottom:24}}>
            <button onClick={function() { onToggleYear(year); }}
              style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",fontFamily:C.font,marginBottom:10,padding:0}}>
              <span style={{color:isCurrent?C.blue:C.muted,fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:isCurrent?700:400}}>
                {year}{isCurrent ? " — innevarande år" : ""}
              </span>
              <span style={{color:C.muted,fontSize:11,transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)",display:"inline-block",transition:"transform 0.2s"}}>▼</span>
            </button>
            {!isCollapsed && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {MONTHS_SV.map(function(name, i) {
                  var key = year + "-" + String(i+1).padStart(2,"0");
                  var m = data[key];
                  var monthDate = new Date(year, i, 1);
                  var isFuture = monthDate > now && !m;
                  var canCreate = !m && !isFuture;
                  var isCurrentMonth = year === currentYear && i === now.getMonth();
                  var fp = 0;
                  var surplus2 = 0;
                  var mISK = 0;
                  if (m) {
                    var mti = Object.values(m.income).reduce(function(a,b) { return a+(b||0); }, 0);
                    var mte = m.expenses.reduce(function(a,e) { return a+(e.amount||0); }, 0);
                    var mts = Object.values(m.savings).reduce(function(a,b) { return a+(b||0); }, 0);
                    var mcb = m.income.childBenefit || 0;
                    fp = Math.round((mti - mte - mts - mcb) / 2);
                    surplus2 = mti - mte;
                    mISK = (m.savings&&m.savings.isk||0) + mcb;
                  }
                  return (
                    <button key={key}
                      onClick={function() { if(m) onOpen(key); else if(canCreate) onCreate(year,i+1); }}
                      disabled={isFuture}
                      style={{background:m?C.card:canCreate?"transparent":"#f5f0e8",
                        border:canCreate?"1px dashed "+C.border:"1px solid "+(m?C.border:"#e8e3d5"),
                        borderRadius:14,padding:"14px 12px",textAlign:"left",
                        cursor:isFuture?"default":"pointer",opacity:isFuture?0.3:1,
                        color:C.text,fontFamily:C.font}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:m?8:0}}>
                        <span style={{fontSize:13,fontWeight:500,color:isCurrentMonth?C.blue:C.text}}>{name.slice(0,3)}</span>
                        {m && m.locked && <span style={{fontSize:9}}>🔒</span>}
                        {canCreate && <span style={{color:C.blue,fontSize:18,lineHeight:1}}>+</span>}
                      </div>
                      {m && (
                        <div>
                          <p style={{fontSize:12,fontWeight:600,color:C.blue,margin:0}}>{fmt(mISK)}</p>
                          <p style={{fontSize:10,color:C.muted,margin:"2px 0 0"}}>→ ISK</p>
      
                        </div>
                      )}
                      {canCreate && <p style={{fontSize:10,color:C.muted,margin:"4px 0 0"}}>Skapa ny</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}


      <div style={{marginTop:16}}>
        <button onClick={onYearBudget} style={{width:"100%",padding:"16px",borderRadius:16,border:"1px solid "+C.blue+"66",background:C.blue+"11",color:C.blue,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>
          📊 Årsbudget
        </button>
      </div>
    </div>
  );
}

// ── MonthView ─────────────────────────────────────────────────────────────────
function MonthView(props) {
  var monthKey = props.monthKey;
  var month = props.month;
  var step = props.step;
  var setStep = props.setStep;
  var onBack = props.onBack;
  var allData = props.allData;
  var onPatch = props.onPatch;
  var prevMonthFn = props.prevMonth;
  var onNavigate = props.onNavigate;
  var prev = typeof prevMonthFn === "function" ? prevMonthFn() : null;

  var parts = monthKey.split("-");
  var yr = parts[0];
  var mo = parts[1];
  var monthName = MONTHS_SV[parseInt(mo) - 1];
  var locked = month.locked;

  var totalIncome = Object.values(month.income).reduce(function(a,b) { return a+(b||0); }, 0);
  var totalExp = month.expenses.reduce(function(a,e) { return a+(e.amount||0); }, 0);
  var iskSav = month.savings.isk || 0;
  var travelSav = month.savings.travel || 0;
  var reserveSav = month.savings.reserve || 0;
  var totalSav = iskSav + travelSav + reserveSav;
  var childBenefit = month.income.childBenefit || 0;
  var available = totalIncome - totalExp;
  var surplus = totalIncome - totalExp - totalSav - childBenefit;
  var perPerson = Math.round(surplus / 2);

  var MIN_EMILIE = childBenefit || 2650;
  var totalISK = iskSav + childBenefit;
  var savedSplit = month.iskSplit;
  var emilieISK = (savedSplit && savedSplit.emilie != null) ? Math.max(MIN_EMILIE, savedSplit.emilie) : Math.max(MIN_EMILIE, Math.round(totalISK / 2));
  var alexISK = totalISK - emilieISK;

  function setISKSplit(emilie) {
    var clamped = Math.max(MIN_EMILIE, Math.min(emilie, totalISK));
    onPatch(function(m) { return Object.assign({}, m, {iskSplit:{emilie:clamped,alex:totalISK-clamped}}); });
  }

  function setIncome(f, v) { onPatch(function(m) { var inc = Object.assign({}, m.income); inc[f] = v; return Object.assign({}, m, {income:inc}); }); }
  function setExpAmt(id, v) { onPatch(function(m) { return Object.assign({}, m, {expenses:m.expenses.map(function(e) { return e.id===id ? Object.assign({},e,{amount:v}) : e; })}); }); }
  function setExpLbl(id, v) { onPatch(function(m) { return Object.assign({}, m, {expenses:m.expenses.map(function(e) { return e.id===id ? Object.assign({},e,{label:v}) : e; })}); }); }
  function addExp() {
    onPatch(function(m) { return Object.assign({}, m, {expenses:[...m.expenses, {id:"c_"+Date.now(),label:"",amount:0}]}); });
    setTimeout(function() {
      var inputs = document.querySelectorAll('[data-form] input[placeholder="Benämning..."]');
      if (inputs.length) inputs[inputs.length-1].focus();
    }, 50);
  }
  function removeExp(id) { onPatch(function(m) { return Object.assign({}, m, {expenses:m.expenses.filter(function(e) { return e.id!==id; })}); }); }
  function setSaving(f, v) {
    var ns = Object.assign({}, month.savings); ns[f] = v;
    var nt = Object.values(ns).reduce(function(a,b) { return a+(b||0); }, 0);
    if (nt <= available) onPatch(function(m) { return Object.assign({}, m, {savings:ns}); });
  }
  function setNote(v) { onPatch(function(m) { return Object.assign({}, m, {note:v}); }); }

  // Sparstatistik
  var allKeys = Object.keys(allData).sort();
  var currentIdx = allKeys.indexOf(monthKey);
  var monthsUpToNow = allKeys.slice(0, currentIdx + 1);
  var currentYear = monthKey.split("-")[0];
  var yearKeys = monthsUpToNow.filter(function(k) { return k.startsWith(currentYear); });
  var accISK = 0;
  monthsUpToNow.forEach(function(k) { var m=allData[k]; if(!m)return; accISK+=(m.savings&&m.savings.isk||0)+(m.income&&m.income.childBenefit||0); });
  var yearISK = 0;
  yearKeys.forEach(function(k) { var m=allData[k]; if(!m)return; yearISK+=(m.savings&&m.savings.isk||0)+(m.income&&m.income.childBenefit||0); });
  var iskAvg = yearKeys.length > 0 ? Math.round(yearISK / yearKeys.length) : 0;
  var sparkvot = totalIncome > 0 ? Math.round(((iskSav + childBenefit) / totalIncome) * 100) : 0;

  // Fickpengar snitt
  var fpTotal = 0; var fpCount = 0;
  monthsUpToNow.forEach(function(k) {
    var m = allData[k]; if(!m)return;
    var ti=Object.values(m.income).reduce(function(a,b){return a+(b||0);},0);
    var te=m.expenses.reduce(function(a,e){return a+(e.amount||0);},0);
    var ts=Object.values(m.savings).reduce(function(a,b){return a+(b||0);},0);
    var cb=m.income.childBenefit||0;
    fpTotal+=Math.round((ti-te-ts-cb)/2); fpCount++;
  });
  var fpSnitt = fpCount > 0 ? Math.round(fpTotal / fpCount) : 0;

  var prevIncome = prev ? Object.values(prev.income).reduce(function(a,b){return a+(b||0);},0) : null;
  var prevExp = prev ? prev.expenses.reduce(function(a,e){return a+(e.amount||0);},0) : null;

  var STEPS = ["Inkomster","Utgifter","Sparande","Sammanfattning"];

  function pill(label, onClick, primary) {
    return (
      <button onClick={onClick} style={{flex:1,padding:"13px",borderRadius:13,border:"none",
        cursor:"pointer",fontFamily:C.font,background:primary?C.blue:C.card2,
        color:primary?"#fff":C.muted,fontSize:13,fontWeight:500}}>{label}</button>
    );
  }

  function infoBar(label, value, color) {
    var bg = color==="green" ? "#f0faf4" : color==="red" ? "#fff5f5" : C.card;
    var col = color==="green" ? C.green : color==="red" ? C.red : C.text;
    return (
      <div style={{background:bg,borderRadius:14,padding:"13px 16px",display:"flex",
        justifyContent:"space-between",alignItems:"center",marginBottom:10,border:"1px solid "+C.border}}>
        <span style={{fontSize:14,color:C.muted}}>{label}</span>
        <span style={{fontSize:16,fontWeight:600,color:col}}>{fmt(value)}</span>
      </div>
    );
  }

  function printSummary() {
    var alexT = month.income.alexSalary + month.income.alexOther - perPerson;
    var emilieT = month.income.emilieSalary + month.income.emilieOther - perPerson;
    var noteHtml = month.note ? "<p style='margin-top:12px;padding:10px;background:#faf8f3;border-radius:6px;font-size:11px;color:#6e6e73'><strong>Anteckning:</strong> " + month.note + "</p>" : "";
    var html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Budget " + monthName + " " + yr + "</title><style>@page{size:A4;margin:18mm 16mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:#1d1d1f;background:#fff;font-size:11.5px;line-height:1.6}h1{font-size:22px;font-weight:700;margin-bottom:2px;letter-spacing:-0.3px}.subtitle{font-size:10px;color:#6e6e73;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}.section{border-radius:10px;overflow:hidden;border:1px solid #e5e5ea;margin-bottom:10px}.sh{padding:9px 14px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.row{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;border-bottom:1px solid #f2f2f7;font-size:11.5px}.row:last-child{border-bottom:none}.label{color:#6e6e73;flex:1;padding-right:8px}.value{font-weight:600;white-space:nowrap}.muted{color:#6e6e73}.green{color:#276749}.red{color:#c53030}.blue{color:#2c5282}.hl{background:#f0f8ff}.big{font-size:17px;font-weight:800}.box{background:#f0f6ff;border:1px solid #c3d9f5;border-radius:10px;padding:12px 14px;margin-bottom:10px}.box h3{font-size:9.5px;text-transform:uppercase;color:#6e6e73;margin-bottom:8px;letter-spacing:.08em;font-weight:600}.divider{border:none;border-top:2px solid #e5e5ea;margin:14px 0}.footer{margin-top:14px;text-align:center;font-size:9.5px;color:#aeaeb2;border-top:1px solid #f2f2f7;padding-top:10px;letter-spacing:.04em}</style></head><body>";
    html += "<div style='display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:12px;border-bottom:2px solid #e0e0e5'><div><p style='font-size:10px;color:#6e6e73;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px'>Hushållsbudget — Sammanfattning</p><h1>" + monthName + " " + yr + "</h1></div><span style='background:#f0f0f5;border-radius:6px;padding:3px 8px;font-size:11px;color:#6e6e73'>🔒 Låst</span></div>";
    html += "<div class='grid'><div>";
    html += "<div class='section' style='margin-bottom:10px'><div class='sh' style='background:#2c5282'>Inkomster &amp; Utgifter</div>";
    html += "<div class='row'><span class='muted'>Total inkomst</span><span class='bold'>" + fmt(totalIncome) + "</span></div>";
    html += "<div class='row'><span class='muted'>Löpande utgifter</span><span class='bold red'>− " + fmt(totalExp) + "</span></div>";
    html += "<div class='row'><span class='muted'>Transaktion (resa+reserv)</span><span class='bold red'>− " + fmt(travelSav+reserveSav) + "</span></div>";
    html += "<div class='row'><span class='muted'>ISK inkl. barnbidrag</span><span class='bold blue'>− " + fmt(totalISK) + "</span></div>";
    html += "<div class='row hl'><span class='muted'>Fickpengar / person</span><span class='big green'>" + fmt(perPerson) + "</span></div></div>";
    html += "<div class='section'><div class='sh' style='background:#276749'>ISK-statistik</div>";
    html += "<div class='row'><span class='muted'>Ackumulerat ISK</span><span class='bold blue'>" + fmt(accISK) + "</span></div>";
    html += "<div class='row'><span class='muted'>Snitt / månad " + currentYear + "</span><span class='bold " + (iskAvg>=15000?"green":"red") + "'>" + fmt(iskAvg) + "</span></div>";
    html += "<div class='row'><span class='muted'>Fickpengar snitt / mån</span><span class='bold " + (fpSnitt<=4000?"green":"red") + "'>" + fmt(fpSnitt) + "</span></div></div>";
    html += "</div><div>";
    html += "<div class='box'><h3>→ Transaktionskonto (gemensamt)</h3>";
    html += "<div class='row' style='padding:4px 0'><span>Alex</span><strong class='blue'>" + fmt(alexT - alexISK) + "</strong></div>";
    html += "<div class='row' style='padding:4px 0'><span>Emilie</span><strong class='blue'>" + fmt(emilieT - emilieISK) + "</strong></div></div>";
    html += "<div class='box'><h3>→ ISK (totalt " + fmt(totalISK) + ")</h3>";
    html += "<div class='row' style='padding:4px 0'><span>Alex ISK</span><strong class='blue'>" + fmt(alexISK) + "</strong></div>";
    html += "<div class='row' style='padding:4px 0'><span>Emilie ISK</span><strong class='blue'>" + fmt(emilieISK) + "</strong></div></div>";
    html += "<div class='box'><h3>Total överföring</h3>";
    html += "<div class='row' style='padding:4px 0'><span>Alex</span><strong>" + fmt(alexT) + "</strong></div>";
    html += "<div class='row' style='padding:4px 0'><span>Emilie</span><strong>" + fmt(emilieT) + "</strong></div></div>";
    html += "</div></div>" + noteHtml;
    html += "<div class='footer'>Hushållsbudget • " + monthName + " " + yr + " • Genererad " + new Date().toLocaleDateString("sv-SE") + "</div>";
    html += "</body></html>";
    var w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(function() { w.print(); }, 600);
  }

  return (
    <div style={{maxWidth:600,margin:"0 auto",paddingBottom:48}} data-form="">
      <div className="no-print" style={{position:"sticky",top:0,background:"rgba(250,248,243,0.97)",backdropFilter:"blur(20px)",padding:"18px 20px 0",zIndex:10,borderBottom:"1px solid "+C.border}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:C.blue,fontSize:14,cursor:"pointer",fontFamily:C.font,padding:0}}>← Översikt</button>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={function(){
              var keys=Object.keys(allData).sort();
              var i=keys.indexOf(monthKey);
              if(i>0) onNavigate(keys[i-1]);
            }} disabled={Object.keys(allData).sort().indexOf(monthKey)===0}
              style={{background:"none",border:"1px solid "+C.border,borderRadius:8,padding:"5px 10px",color:C.muted,fontSize:16,cursor:"pointer",fontFamily:C.font,opacity:Object.keys(allData).sort().indexOf(monthKey)===0?0.3:1}}>‹</button>
            <button onClick={function(){
              var keys=Object.keys(allData).sort();
              var i=keys.indexOf(monthKey);
              if(i<keys.length-1) onNavigate(keys[i+1]);
            }} disabled={Object.keys(allData).sort().indexOf(monthKey)===Object.keys(allData).length-1}
              style={{background:"none",border:"1px solid "+C.border,borderRadius:8,padding:"5px 10px",color:C.muted,fontSize:16,cursor:"pointer",fontFamily:C.font,opacity:Object.keys(allData).sort().indexOf(monthKey)===Object.keys(allData).length-1?0.3:1}}>›</button>
          </div>
          <div style={{display:"flex",gap:8}}>
            {locked
              ? <button onClick={function(){onPatch(function(m){return Object.assign({},m,{locked:false});});}} style={{background:C.card2,border:"none",borderRadius:20,padding:"6px 14px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:C.font}}>🔒 Lås upp</button>
              : step===3 && <button onClick={function(){if(window.confirm("Lås månaden? Du kan låsa upp igen om du behöver ändra.")) onPatch(function(m){return Object.assign({},m,{locked:true});});}} style={{background:C.card,border:"1px solid "+C.border,borderRadius:20,padding:"6px 14px",color:C.blue,fontSize:12,cursor:"pointer",fontFamily:C.font}}>Lås månad</button>
            }
            {locked && step===3 && <button onClick={printSummary} style={{background:C.card,border:"1px solid "+C.border,borderRadius:20,padding:"6px 14px",color:C.green,fontSize:12,cursor:"pointer",fontFamily:C.font}}>📄 PDF</button>}
          </div>
        </div>
        <p style={{color:C.muted,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",margin:0}}>{yr}</p>
        <h2 style={{fontSize:22,fontWeight:600,margin:"2px 0 14px"}}>{monthName}</h2>
        <div style={{display:"flex",gap:4,paddingBottom:14}}>
          {STEPS.map(function(s, i) {
            return (
              <button key={s} onClick={function(){setStep(i);}} style={{flex:1,padding:"10px 4px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:C.font,background:step===i?C.blue:"transparent",color:step===i?"#fff":C.muted,fontSize:11,fontWeight:step===i?700:400,position:"relative"}}>
                {s}
                {i < step && <span style={{position:"absolute",top:3,right:3,width:5,height:5,borderRadius:"50%",background:C.green}}></span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{padding:"20px"}}>

        {step === 0 && (
          <div>
            {[["Alex","alexSalary","alexOther"],["Emilie","emilieSalary","emilieOther"]].map(function(row) {
              var name=row[0], sal=row[1], oth=row[2];
              return (
                <div key={name} style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
                  <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                    <span>👤</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>{name}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",borderBottom:"1px solid "+C.border}}>
                    <div><div style={{fontSize:14}}>Lön</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>(efter skatt)</div></div>
                    {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(month.income[sal])}</span>
                      : <NumInput value={month.income[sal]} onCommit={function(v){setIncome(sal,v);}} onEnter={focusNext} />}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px"}}>
                    <div><div style={{fontSize:14}}>Övriga inkomster</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Föräldrapenning, skatteåterbäring etc (efter skatt)</div></div>
                    {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(month.income[oth])}</span>
                      : <NumInput value={month.income[oth]} onCommit={function(v){setIncome(oth,v);}} onEnter={focusNext} />}
                  </div>
                </div>
              );
            })}
            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>💰</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>Övrigt</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px"}}>
                <div><div style={{fontSize:14}}>Barnbidrag</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Går direkt till ISK</div></div>
                {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(childBenefit)}</span>
                  : <NumInput value={childBenefit} onCommit={function(v){setIncome("childBenefit",v);}} onEnter={focusNext} />}
              </div>
            </div>
            {infoBar("Summa inkomster", totalIncome, "green")}
            {prevIncome !== null && (function() {
              var diff = totalIncome - prevIncome;
              var pct = prevIncome > 0 ? Math.round((diff/prevIncome)*100) : 0;
              return <div style={{display:"flex",justifyContent:"space-between",background:C.card,borderRadius:12,padding:"10px 16px",marginTop:-6,marginBottom:10,border:"1px solid "+C.border}}>
                <span style={{fontSize:12,color:C.muted}}>vs föregående månad</span>
                <span style={{fontSize:13,fontWeight:600,color:diff>=0?C.green:C.red}}>{diff>=0?"+":""}{fmt(diff)} ({diff>=0?"+":""}{pct}%)</span>
              </div>;
            })()}
            <div style={{display:"flex",gap:8}}>{pill("Nästa: Utgifter →", function(){setStep(1);}, true)}</div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>📋</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>Löpande utgifter</span>
              </div>
              {month.expenses.map(function(e, i) {
                return (
                  <div key={e.id} style={{display:"flex",alignItems:"center",padding:"11px 16px",borderBottom:i<month.expenses.length-1?"1px solid "+C.border:"none",gap:8}}>
                    {locked || FIXED_IDS.indexOf(e.id) !== -1
                      ? <span style={{flex:1,fontSize:14}}>{e.label}</span>
                      : <input value={e.label} onChange={function(ev){setExpLbl(e.id,ev.target.value);}} placeholder="Benämning..."
                          style={{flex:1,background:"transparent",border:"none",color:C.text,fontSize:14,outline:"none",fontFamily:C.font}} />}
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(e.amount)}</span>
                        : <NumInput value={e.amount} onCommit={function(v){setExpAmt(e.id,v);}} onEnter={focusNext} />}
                      {!locked && FIXED_IDS.indexOf(e.id) === -1 &&
                        <button onClick={function(){if(window.confirm("Ta bort \""+e.label+"\"?")) removeExp(e.id);}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>}
                    </div>
                  </div>
                );
              })}
              {!locked && <div style={{padding:"10px 16px"}}>
                <button onClick={addExp} style={{background:"none",border:"none",color:C.blue,fontSize:13,cursor:"pointer",fontFamily:C.font}}>+ Lägg till post</button>
              </div>}
            </div>
            {infoBar("Summa utgifter", totalExp, "red")}
            {prevExp !== null && (function() {
              var diff = totalExp - prevExp;
              var pct = prevExp > 0 ? Math.round((diff/prevExp)*100) : 0;
              return <div style={{display:"flex",justifyContent:"space-between",background:C.card,borderRadius:12,padding:"10px 16px",marginTop:-6,marginBottom:10,border:"1px solid "+C.border}}>
                <span style={{fontSize:12,color:C.muted}}>vs föregående månad</span>
                <span style={{fontSize:13,fontWeight:600,color:diff<=0?C.green:C.red}}>{diff>=0?"+":""}{fmt(diff)} ({diff>=0?"+":""}{pct}%)</span>
              </div>;
            })()}
            {infoBar("Tillgängligt", available, available>=0?"green":"red")}
            <div style={{display:"flex",gap:8}}>
              {pill("← Inkomster", function(){setStep(0);}, false)}
              {pill("Nästa: Sparande →", function(){setStep(2);}, true)}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{background:C.card,borderRadius:16,padding:16,marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <span style={{fontSize:13,color:C.muted}}>Tillgängligt</span>
                <span style={{fontSize:16,fontWeight:600}}>{fmt(available)}</span>
              </div>
              <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",background:C.blue,borderRadius:99,width:Math.min(100,available>0?(totalSav/available)*100:0)+"%"}} />
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:C.muted}}>Kvar efter sparande</span>
                <span style={{fontSize:14,fontWeight:600,color:surplus>=0?C.green:C.red}}>{fmt(surplus)}</span>
              </div>
            </div>

            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>🏦</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>Reserverade medel & sparande</span>
              </div>
              {[["isk","ISK (aktier/fonder)","Exkl. barnbidrag — barnbidrag → barnspar"],
                ["travel","Resa","Semesterkassa"],
                ["reserve","Hem & inköp (transaktionskonto)",""]].map(function(row, i, arr) {
                var key=row[0], label=row[1], hint=row[2];
                return (
                  <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",borderBottom:i<arr.length-1?"1px solid "+C.border:"none"}}>
                    <div>
                      <div style={{fontSize:14}}>{label}</div>
                      {hint && <div style={{fontSize:11,color:C.muted,marginTop:2}}>{hint}</div>}
                    </div>
                    {locked ? <span style={{fontSize:14,fontWeight:500}}>{fmt(month.savings[key]||0)}</span>
                      : <NumInput value={month.savings[key]||0} onCommit={function(v){setSaving(key,v);}} onEnter={focusNext} />}
                  </div>
                );
              })}
            </div>

            <div style={{background:perPerson>=0?"#f0faf4":"#fff5f5",borderRadius:14,padding:"16px",marginBottom:12,border:"1px solid "+(perPerson>=0?C.green:C.red)+"55"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,color:C.muted}}>Fickpengar per person</span>
                <span style={{fontSize:24,fontWeight:700,color:perPerson>=0?C.green:C.red}}>{fmt(perPerson)}</span>
              </div>
              {surplus < 0 && <p style={{color:C.red,fontSize:12,margin:"8px 0 0"}}>⚠️ Minska sparandet</p>}
            </div>

            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>📈</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>Sparstatistik</span>
              </div>
              <div style={{padding:"13px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14}}>Sparkvot (denna månad)</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>ISK inkl. barnbidrag / totala inkomster</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:16,fontWeight:700,color:sparkvot>=15?C.green:C.red}}>{sparkvot}%</span>
                    <div style={{fontSize:11,color:sparkvot>=15?C.green:C.red,marginTop:2}}>{sparkvot>=15?"✅ Stark":"⚠️ Låg"}</div>
                  </div>
                </div>
                <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",background:sparkvot>=15?C.green:C.red,borderRadius:99,width:Math.min(sparkvot*2,100)+"%"}} />
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:8}}>
              {pill("← Utgifter", function(){setStep(1);}, false)}
              {pill("Nästa: Sammanfattning →", function(){setStep(3);}, true)}
            </div>
          </div>
        )}

        {step === 3 && totalIncome === 0 && (
          <div style={{background:C.card,borderRadius:16,padding:"32px 20px",textAlign:"center",border:"1px solid "+C.border,marginBottom:12}}>
            <div style={{fontSize:32,marginBottom:12}}>💡</div>
            <div style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:8}}>Fyll i inkomster först</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Gå till inkomstfliken och fyll i löner för att se sammanfattningen.</div>
            <button onClick={function(){setStep(0);}} style={{background:C.blue,border:"none",borderRadius:12,padding:"10px 20px",color:"#fff",fontSize:13,cursor:"pointer",fontFamily:C.font}}>← Gå till inkomster</button>
          </div>
        )}
        {step === 3 && totalIncome > 0 && (
          <div style={{paddingTop:4}}>
            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,background:C.tabBg}}>
                <span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Sammanfattning — {monthName} {yr}</span>
              </div>
              {[
                ["Total inkomst", fmt(totalIncome), C.text],
                ["Totala utgifter", "− "+fmt(totalExp), C.red],
                ["Överföring transaktionskonto (resa+reserv)", "− "+fmt(travelSav+reserveSav), C.red],
                ["Totalt sparande ISK (inkl. barnbidrag)", "− "+fmt(totalISK), C.blue],
              ].map(function(row) {
                return (
                  <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"11px 16px",borderBottom:"1px solid "+C.border}}>
                    <span style={{fontSize:13,color:C.muted,flex:1,paddingRight:8}}>{row[0]}</span>
                    <span style={{fontSize:14,fontWeight:500,color:row[2],whiteSpace:"nowrap"}}>{row[1]}</span>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"14px 16px",background:C.tabBg}}>
                <span style={{fontSize:14,fontWeight:600}}>Fickpengar / person</span>
                <span style={{fontSize:20,fontWeight:700,color:perPerson>=0?C.green:C.red}}>{fmt(perPerson)}</span>
              </div>
            </div>

            {prev && (function() {
              var prevInc = Object.values(prev.income).reduce(function(a,b){return a+(b||0);},0);
              var prevExp = prev.expenses.reduce(function(a,e){return a+(e.amount||0);},0);
              var prevNet = prevInc - prevExp;
              var thisNet = totalIncome - totalExp;
              var diff = thisNet - prevNet;
              return (
                <div style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:16,border:"1px solid "+C.border}}>
                  <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>⚖️ Nettokassaflöde vs föregående månad</div>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,background:C.card2,borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Förra månaden</div>
                      <div style={{fontSize:13,fontWeight:600,color:prevNet>=0?C.green:C.red}}>{fmt(prevNet)}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>ink - utg</div>
                    </div>
                    <div style={{flex:1,background:C.card2,borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Denna månad</div>
                      <div style={{fontSize:13,fontWeight:600,color:thisNet>=0?C.green:C.red}}>{fmt(thisNet)}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>ink - utg</div>
                    </div>
                    <div style={{flex:1,background:diff>=0?"#f0faf4":"#fff5f5",borderRadius:10,padding:"10px 12px",border:"1px solid "+(diff>=0?C.green:C.red)+"44"}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Förändring</div>
                      <div style={{fontSize:13,fontWeight:700,color:diff>=0?C.green:C.red}}>{diff>=0?"+":""}{fmt(diff)}</div>
                      <div style={{fontSize:10,color:diff>=0?C.green:C.red,marginTop:2}}>{diff>=0?"▲ bättre":"▼ sämre"}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,background:C.tabBg}}>
                <span>📈</span><span style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>ISK-statistik</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid "+C.border}}>
                <div><div style={{fontSize:14}}>Ackumulerat ISK</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Inkl. barnbidrag ({monthsUpToNow.length} mån)</div></div>
                <span style={{fontSize:16,fontWeight:700,color:C.blue}}>{fmt(accISK)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid "+C.border}}>
                <div><div style={{fontSize:14}}>Snitt per månad {currentYear}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Mål: 15 000 kr/mån</div></div>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:16,fontWeight:700,color:iskAvg>=15000?C.green:C.red}}>{fmt(iskAvg)}</span>
                  <div style={{fontSize:11,color:iskAvg>=15000?C.green:C.red,marginTop:2}}>{iskAvg>=15000?"✅ Över mål":"⚠️ Under mål"}</div>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px"}}>
                <div><div style={{fontSize:14}}>Fickpengar, snitt/mån</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Snitt över alla månader</div></div>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:16,fontWeight:700,color:fpSnitt<=4000?C.green:C.red}}>{fmt(fpSnitt)}</span>
                  <div style={{fontSize:11,color:fpSnitt<=4000?C.green:C.red,marginTop:2}}>{fpSnitt<=4000?"✅ Under 4 000":"⚠️ Över 4 000"}</div>
                </div>
              </div>
            </div>

            <ISKSplitCard
              alexTransfer={month.income.alexSalary + month.income.alexOther - perPerson}
              emilieTransfer={month.income.emilieSalary + month.income.emilieOther - perPerson}
              alexISK={alexISK} emilieISK={emilieISK} totalISK={totalISK}
              childBenefit={childBenefit} minEmilie={MIN_EMILIE}
              onSetEmilieISK={setISKSplit} locked={locked} />

            <div style={{background:C.card,borderRadius:14,padding:"12px 14px",marginBottom:12,border:"1px solid "+C.border}}>
              <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>📝 Anteckning</div>
              {locked
                ? <div style={{fontSize:13,color:month.note?C.text:C.muted,fontStyle:month.note?"normal":"italic"}}>{month.note||"Ingen anteckning"}</div>
                : <textarea rows={2} value={month.note||""} onChange={function(e){setNote(e.target.value);}} onBlur={function(e){setNote(e.target.value);}}
                    placeholder="Noteringar för månaden..."
                    style={{width:"100%",background:"transparent",border:"none",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none",lineHeight:1.5}} />}
            </div>

            <div style={{display:"flex",gap:8}}>
              {pill("← Sparande", function(){setStep(2);}, false)}
              {!locked
                ? pill("🔒 Lås månad", function(){if(window.confirm("Lås månaden? Du kan låsa upp igen om du behöver ändra.")) onPatch(function(m){return Object.assign({},m,{locked:true});});}, true)
                : <div style={{flex:1,textAlign:"center",fontSize:13,color:C.muted,padding:14}}>Månad låst ✓</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ISKSplitCard ─────────────────────────────────────────────────────────────
function ISKSplitCard(props) {
  var alexTransfer = props.alexTransfer;
  var emilieTransfer = props.emilieTransfer;
  var alexISK = props.alexISK;
  var emilieISK = props.emilieISK;
  var totalISK = props.totalISK;
  var childBenefit = props.childBenefit;
  var minEmilie = props.minEmilie;
  var onSetEmilieISK = props.onSetEmilieISK;
  var locked = props.locked;

  var alexToTrans = alexTransfer - alexISK;
  var emilieToTrans = emilieTransfer - emilieISK;

  function copyText(text) { if(navigator.clipboard) navigator.clipboard.writeText(text); }

  function ISKIn(iprops) {
    var value = iprops.value;
    var onChange = iprops.onChange;
    var ref = useRef(null);
    var initialF = value > 0 ? new Intl.NumberFormat("sv-SE").format(value) : "0";
    var rawRef = useRef(String(value));
    var [display, setDisplay] = useState(initialF);
    var prevVal = useRef(value);
    useEffect(function() {
      if (prevVal.current !== value && document.activeElement !== ref.current) {
        prevVal.current = value;
        var f = new Intl.NumberFormat("sv-SE").format(value);
        rawRef.current = f; setDisplay(f);
      }
    }, [value]);
    return (
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <input ref={ref} type="text" inputMode="numeric" value={display} disabled={locked}
          onChange={function(e){var d=e.target.value.replace(/[^0-9]/g,"");rawRef.current=d;setDisplay(d);}}
          onFocus={function(e){var n=parseInt(rawRef.current.replace(/[^0-9]/g,""),10)||0;var s=String(n);rawRef.current=s;setDisplay(s);setTimeout(function(){if(ref.current)ref.current.select();},0);}}
          onBlur={function(){var n=parseInt(rawRef.current.replace(/[^0-9]/g,""),10)||0;onChange(n);var f=new Intl.NumberFormat("sv-SE").format(n);rawRef.current=f;setDisplay(f);}}
          style={{width:100,padding:"6px 10px",background:locked?"transparent":"#dbeafe",border:locked?"none":"1px solid #90cdf4",borderRadius:8,color:C.text,fontSize:13,textAlign:"right",outline:"none",fontFamily:C.font,opacity:locked?0.7:1}} />
        <span style={{color:C.muted,fontSize:12}}>kr</span>
      </div>
    );
  }

  return (
    <div style={{background:"#ebf4ff",border:"1px solid #90cdf4",borderRadius:16,padding:16,marginBottom:12}}>
      <p style={{fontSize:11,color:C.blue,letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 12px"}}>📋 Att föra över</p>

      <div style={{background:"#dbeafe",borderRadius:12,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",margin:0}}>Transaktionskonto (gemensamt)</p>
          <button onClick={function(){copyText("Till transaktionskonto:\nAlex: "+fmt(alexToTrans)+"\nEmilie: "+fmt(emilieToTrans));}} style={{background:"none",border:"none",color:C.blue,fontSize:11,cursor:"pointer",fontFamily:C.font}}>Kopiera</button>
        </div>
        {[["Alex",alexToTrans],["Emilie",emilieToTrans]].map(function(row) {
          return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:14}}>{row[0]}</span>
            <span style={{fontSize:14,fontWeight:700,color:C.blue}}>{fmt(row[1])}</span>
          </div>;
        })}
      </div>

      <div style={{background:"#dbeafe",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",margin:0}}>ISK (totalt {fmt(totalISK)})</p>
          <button onClick={function(){copyText("Till ISK:\nAlex ISK: "+fmt(alexISK)+"\nEmilie ISK: "+fmt(emilieISK)+" (inkl. barnbidrag "+fmt(childBenefit)+")");}} style={{background:"none",border:"none",color:C.blue,fontSize:11,cursor:"pointer",fontFamily:C.font}}>Kopiera</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:14}}>Alex ISK</span>
          <ISKIn value={alexISK} onChange={function(v){var clamped=Math.max(0,Math.min(v,totalISK-minEmilie));onSetEmilieISK(totalISK-clamped);}} />
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={{fontSize:14}}>Emilie ISK</span>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>Min {fmt(minEmilie)} (barnbidrag)</div>
          </div>
          <ISKIn value={emilieISK} onChange={onSetEmilieISK} />
        </div>
      </div>

      <div style={{borderTop:"1px solid #90cdf4",paddingTop:12}}>
        <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Total överföring (transaktion + ISK)</p>
        {[["Alex",alexTransfer],["Emilie",emilieTransfer]].map(function(row) {
          return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:14,color:C.muted}}>{row[0]}</span>
            <span style={{fontSize:14,fontWeight:600,color:C.muted}}>{fmt(row[1])}</span>
          </div>;
        })}
      </div>
    </div>
  );
}


// ── YearBudget ────────────────────────────────────────────────────────────────
function YearBudget(props) {
  var yearData = props.yearData;
  var monthData = props.monthData;
  var onBack = props.onBack;
  var patchYear = props.patchYear;
  var year = new Date().getFullYear();
  var months = Object.keys(monthData).sort();
  var nM = months.length;

  // ── Actuals from month data ──
  var actualExpTotal = {};
  var actualExpAvg = {};
  DEFAULT_EXPENSES.forEach(function(def) { actualExpTotal[def.id]=0; actualExpAvg[def.id]=0; });
  months.forEach(function(k) {
    monthData[k].expenses.forEach(function(e) {
      if (actualExpTotal[e.id]!==undefined) actualExpTotal[e.id]+=(e.amount||0);
    });
  });
  Object.keys(actualExpTotal).forEach(function(id) {
    actualExpAvg[id] = nM>0 ? Math.round(actualExpTotal[id]/nM) : 0;
  });

  var actualISKTotal = months.reduce(function(a,k){ var m=monthData[k]; return a+(m.savings&&m.savings.isk||0); },0);
  var actualBarnTotal = months.reduce(function(a,k){ return a+(monthData[k].income&&monthData[k].income.childBenefit||0); },0);
  var actualISKInclBarn = actualISKTotal + actualBarnTotal;
  var actualISKAvg = nM>0 ? Math.round(actualISKInclBarn/nM) : 0;
  var actualTravelTotal = months.reduce(function(a,k){ return a+(monthData[k].savings&&monthData[k].savings.travel||0); },0);
  var actualHomeTotal = months.reduce(function(a,k){ return a+(monthData[k].savings&&monthData[k].savings.reserve||0); },0);
  var actualRevTotal = actualExpTotal["revolut"]||0;
  var actualFixedTotal = ["loan","fee","broadband","insurance","tibber","boo","car","preschool","csn"].reduce(function(a,id){ return a+(actualExpTotal[id]||0); },0);

  var iskByMonth = {};
  months.forEach(function(k){ var m=monthData[k]; iskByMonth[k]=(m.savings&&m.savings.isk||0)+(m.income&&m.income.childBenefit||0); });

  // ── Budget values ──
  function getBudgetExp(id) {
    if (yearData.expenses&&yearData.expenses[id]!=null) return yearData.expenses[id];
    return (actualExpAvg[id]||0)*12;
  }
  function setBudgetExp(id,v) {
    patchYear(function(y){ var e=Object.assign({},y.expenses||{}); e[id]=v; return Object.assign({},y,{expenses:e}); });
  }

  var reserved = yearData.reserved||{};
  var barnbidragBudget = yearData.income.barnbidrag!=null ? yearData.income.barnbidrag : 2650*12;
  var totalIncBudget = (yearData.income.alexSalary||0)+(yearData.income.alexOther||0)+
    (yearData.income.emilieSalary||0)+(yearData.income.emilieOther||0)+
    (yearData.extraIncome||[]).reduce(function(a,r){return a+(r.amount||0);},0);

  var fixedIds = ["loan","fee","broadband","insurance","tibber","boo","car","preschool","csn"];
  var totalFixedBudget = fixedIds.reduce(function(a,id){return a+getBudgetExp(id);},0)+
    (yearData.extraExpenses||[]).reduce(function(a,r){return a+(r.amount||0);},0);
  var revolBudget = getBudgetExp("revolut");
  var travelBudget = reserved.travel||0;
  var homeBudget = reserved.home||0;
  var otherBudget = reserved.other||0;
  var totalVardagBudget = revolBudget+travelBudget+homeBudget+otherBudget;
  var iskGoal = yearData.iskGoal||180000;
  var barnGoal = barnbidragBudget;

  // Överskott = Inkomster - Fasta - Vardagsbudget - ISKmål (barnbidrag ej med, det är separat)
  var balance = totalIncBudget - totalFixedBudget - totalVardagBudget - iskGoal;

  // Actual totals
  var actualIncTotal = months.reduce(function(a,k){
    var m=monthData[k];
    return a+(m.income.alexSalary||0)+(m.income.alexOther||0)+(m.income.emilieSalary||0)+(m.income.emilieOther||0)+
      (yearData.extraIncome||[]).reduce(function(b,r){return b;},0);
  },0);
  var actualVardagTotal = actualRevTotal+actualTravelTotal+actualHomeTotal;

  // ── Status summary ──
  var iskOnTrack = actualISKAvg >= 15000;
  var iskLeft = Math.max(0, iskGoal+barnGoal-actualISKInclBarn);

  // ── Input components ──
  function NumIn(p) {
    var value=p.value||0, onChange=p.onChange, width=p.width||100;
    var ref=useRef(null);
    var [disp,setDisp]=useState(value>0?new Intl.NumberFormat("sv-SE").format(value):"");
    var pv=useRef(value);
    useEffect(function(){
      if(pv.current!==value&&document.activeElement!==ref.current){
        pv.current=value; setDisp(value>0?new Intl.NumberFormat("sv-SE").format(value):"");
      }
    },[value]);
    return <div style={{display:"flex",alignItems:"center",gap:4}}>
      <input ref={ref} type="text" inputMode="numeric" value={disp}
        onChange={function(e){setDisp(e.target.value.replace(/[^0-9]/g,""));}}
        onFocus={function(){var n=parseInt(disp.replace(/[^0-9]/g,""),10)||0;setDisp(n>0?String(n):"");setTimeout(function(){if(ref.current)ref.current.select();},0);}}
        onBlur={function(){var n=parseInt(disp.replace(/[^0-9]/g,""),10)||0;onChange(n);setDisp(n>0?new Intl.NumberFormat("sv-SE").format(n):"");}}
        placeholder="0"
        style={{width:width,padding:"6px 9px",background:C.card2,border:"none",borderRadius:8,color:C.text,fontSize:12,textAlign:"right",outline:"none",fontFamily:C.font}}/>
      <span style={{fontSize:11,color:C.muted}}>kr</span>
    </div>;
  }

  function StrIn(p) {
    var [local,setLocal]=useState(p.value||"");
    var pv=useRef(p.value||"");
    useEffect(function(){if(pv.current!==p.value){pv.current=p.value||"";setLocal(p.value||"");}},[p.value]);
    return <input type="text" value={local} onChange={function(e){setLocal(e.target.value);}}
      onBlur={function(){p.onChange(local);}} placeholder={p.placeholder||""}
      style={{flex:1,padding:"6px 8px",background:"transparent",border:"none",color:C.muted,fontSize:12,outline:"none",fontFamily:C.font,minWidth:0}}/>;
  }

  function SH(p) {
    return <div style={{background:p.color,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:14}}>{p.icon}</span>
      <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#fff"}}>{p.title}</span>
    </div>;
  }

  function ColH() {
    return <div style={{display:"flex",padding:"5px 16px",borderBottom:"1px solid "+C.border,background:C.card2,gap:8}}>
      <span style={{flex:1}}></span>
      <span style={{width:110,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Budget/år</span>
      <span style={{width:90,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Hittills</span>
      <span style={{width:100,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Prognos helår</span>
    </div>;
  }

  function Row(p) {
    var proj = nM>0&&p.actualTotal!=null ? Math.round((p.actualTotal/nM)*12) : null;
    var diff = proj!=null&&p.budget>0 ? proj-p.budget : null;
    var diffPct = diff!=null&&p.budget>0 ? Math.round(Math.abs(diff)/p.budget*100) : null;
    return <div style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+C.border,gap:8}}>
      <span style={{flex:1,fontSize:13,color:C.text}}>{p.label}</span>
      {p.input||<span style={{width:110,textAlign:"right",fontSize:12,fontWeight:500}}>{fmt(p.budget)}</span>}
      <span style={{width:90,textAlign:"right",fontSize:12,color:C.muted}}>{p.actualTotal!=null&&nM>0?fmt(p.actualTotal):"—"}</span>
      <div style={{width:100,textAlign:"right"}}>
        {proj!=null ? <div>
          <div style={{fontSize:12,fontWeight:500,color:diff===null?C.text:diff>0?C.red:C.green}}>{fmt(proj)}</div>
          {diffPct>0&&<div style={{fontSize:10,color:diff>0?C.red:C.green}}>{diff>0?"+":"-"}{diffPct}%</div>}
        </div> : <span style={{fontSize:12,color:C.muted}}>—</span>}
      </div>
    </div>;
  }


  // ── Status summary ──
  var iskOnTrack = actualISKAvg >= 15000;
  var iskLeft = Math.max(0, iskGoal+barnGoal-actualISKInclBarn);

  // ── Input components ──
  function NumIn(p) {
    var value=p.value||0, onChange=p.onChange, width=p.width||100;
    var ref=useRef(null);
    var [disp,setDisp]=useState(value>0?new Intl.NumberFormat("sv-SE").format(value):"");
    var pv=useRef(value);
    useEffect(function(){
      if(pv.current!==value&&document.activeElement!==ref.current){
        pv.current=value; setDisp(value>0?new Intl.NumberFormat("sv-SE").format(value):"");
      }
    },[value]);
    return <div style={{display:"flex",alignItems:"center",gap:4}}>
      <input ref={ref} type="text" inputMode="numeric" value={disp}
        onChange={function(e){setDisp(e.target.value.replace(/[^0-9]/g,""));}}
        onFocus={function(){var n=parseInt(disp.replace(/[^0-9]/g,""),10)||0;setDisp(n>0?String(n):"");setTimeout(function(){if(ref.current)ref.current.select();},0);}}
        onBlur={function(){var n=parseInt(disp.replace(/[^0-9]/g,""),10)||0;onChange(n);setDisp(n>0?new Intl.NumberFormat("sv-SE").format(n):"");}}
        placeholder="0"
        style={{width:width,padding:"6px 9px",background:C.card2,border:"none",borderRadius:8,color:C.text,fontSize:12,textAlign:"right",outline:"none",fontFamily:C.font}}/>
      <span style={{fontSize:11,color:C.muted}}>kr</span>
    </div>;
  }

  function StrIn(p) {
    var [local,setLocal]=useState(p.value||"");
    var pv=useRef(p.value||"");
    useEffect(function(){if(pv.current!==p.value){pv.current=p.value||"";setLocal(p.value||"");}},[p.value]);
    return <input type="text" value={local} onChange={function(e){setLocal(e.target.value);}}
      onBlur={function(){p.onChange(local);}} placeholder={p.placeholder||""}
      style={{flex:1,padding:"6px 8px",background:"transparent",border:"none",color:C.muted,fontSize:12,outline:"none",fontFamily:C.font,minWidth:0}}/>;
  }

  function SH(p) {
    return <div style={{background:p.color,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:14}}>{p.icon}</span>
      <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#fff"}}>{p.title}</span>
    </div>;
  }

  function ColH() {
    return <div style={{display:"flex",padding:"5px 16px",borderBottom:"1px solid "+C.border,background:C.card2,gap:8}}>
      <span style={{flex:1}}></span>
      <span style={{width:110,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Budget/år</span>
      <span style={{width:90,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Hittills</span>
      <span style={{width:100,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Prognos helår</span>
    </div>;
  }

  function Row(p) {
    var proj = nM>0&&p.actualTotal!=null ? Math.round((p.actualTotal/nM)*12) : null;
    var diff = proj!=null&&p.budget>0 ? proj-p.budget : null;
    var diffPct = diff!=null&&p.budget>0 ? Math.round(Math.abs(diff)/p.budget*100) : null;
    return <div style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+C.border,gap:8}}>
      <span style={{flex:1,fontSize:13,color:C.text}}>{p.label}</span>
      {p.input||<span style={{width:110,textAlign:"right",fontSize:12,fontWeight:500}}>{fmt(p.budget)}</span>}
      <span style={{width:90,textAlign:"right",fontSize:12,color:C.muted}}>{p.actualTotal!=null&&nM>0?fmt(p.actualTotal):"—"}</span>
      <div style={{width:100,textAlign:"right"}}>
        {proj!=null ? <div>
          <div style={{fontSize:12,fontWeight:500,color:diff===null?C.text:diff>0?C.red:C.green}}>{fmt(proj)}</div>
          {diffPct>0&&<div style={{fontSize:10,color:diff>0?C.red:C.green}}>{diff>0?"+":"-"}{diffPct}%</div>}
        </div> : <span style={{fontSize:12,color:C.muted}}>—</span>}
      </div>
    </div>;
  }

  // ── ISK Chart ──
  function ISKChart() {
    var [exp, setExp] = useState(false);
    var W=exp?600:340, H=exp?280:170;
    var pL=44,pR=14,pT=12,pB=26,cW=W-pL-pR,cH=H-pT-pB;
    var maxY=Math.max((iskGoal+barnGoal)*1.1,actualISKInclBarn*1.15,15000*14);

    function pts(fn) {
      var arr=[];
      for(var i=0;i<=12;i++) { var v=fn(i); arr.push((pL+(i/12)*cW)+","+(pT+cH-(v/maxY)*cH)); }
      return arr.join(" ");
    }

    var goalPts=pts(function(i){return 15000*i;});

    var actualPts=[],cumISK=0,lastX=pL,lastY=pT+cH;
    months.forEach(function(k){
      cumISK+=iskByMonth[k]||0;
      var mo=parseInt(k.split("-")[1])-1;
      var x=pL+((mo+1)/12)*cW, y=pT+cH-(cumISK/maxY)*cH;
      actualPts.push(x+","+y); lastX=x; lastY=y;
    });

    var trendPts="";
    if(nM>=1){
      var rem=12-nM;
      var projEnd=cumISK+actualISKAvg*rem;
      trendPts=lastX+","+lastY+" "+(pL+cW)+","+(pT+cH-(projEnd/maxY)*cH);
    }

    var mL=["J","F","M","A","M","J","J","A","S","O","N","D"];

    function Chart(cw,ch) {
      return <svg width={cw} height={ch} style={{overflow:"visible",maxWidth:"100%",cursor:"zoom-in"}} onClick={function(){setExp(true);}}>
        {[0,1,2,3,4].map(function(i){
          var val=(maxY/4)*i, y=pT+cH-(val/maxY)*cH;
          return <g key={i}>
            <line x1={pL} y1={y} x2={pL+cW} y2={y} stroke={C.border} strokeWidth="1"/>
            <text x={pL-5} y={y+4} fontSize="9" fill={C.muted} textAnchor="end">{val>=10000?Math.round(val/1000)+"k":val}</text>
          </g>;
        })}
        {mL.map(function(l,i){return <text key={i} x={pL+((i+0.5)/12)*cW} y={ch-pB+14} fontSize="9" fill={C.muted} textAnchor="middle">{l}</text>;})}
        <polyline points={goalPts} fill="none" stroke={C.blue} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5"/>
        {actualPts.length>0&&<polyline points={actualPts.join(" ")} fill="none" stroke={C.green} strokeWidth="2.5"/>}
        {trendPts&&<polyline points={trendPts} fill="none" stroke={C.orange} strokeWidth="1.5" strokeDasharray="5,4"/>}
        {actualPts.length>0&&(function(){var p=actualPts[actualPts.length-1].split(",");return <circle cx={parseFloat(p[0])} cy={parseFloat(p[1])} r="4" fill={C.green} stroke="#fff" strokeWidth="1.5"/>;})()}
        {trendPts&&(function(){var p=trendPts.split(" ")[1].split(",");return <circle cx={parseFloat(p[0])} cy={parseFloat(p[1])} r="3" fill={C.orange} stroke="#fff" strokeWidth="1.5"/>;})()}
      </svg>;
    }

    return <div style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:16,border:"1px solid "+C.border}}>
      {exp&&<div onClick={function(){setExp(false);}} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div onClick={function(e){e.stopPropagation();}} style={{background:C.card,borderRadius:20,padding:"22px 24px",maxWidth:680,width:"93%",position:"relative"}}>
          <button onClick={function(){setExp(false);}} style={{position:"absolute",top:12,right:16,background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.muted}}>✕</button>
          <div style={{fontSize:14,fontWeight:600,marginBottom:2}}>ISK-sparande {year}</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Ackumulerat inkl. barnbidrag — mål 15 000 kr/mån</div>
          {Chart(W,H)}
          <div style={{display:"flex",gap:16,marginTop:10}}>
            {[["Mål 15k/mån",C.blue,"4,3"],["Faktiskt",C.green,""],["Prognos",C.orange,"5,4"]].map(function(r){
              return <div key={r[0]} style={{display:"flex",alignItems:"center",gap:5}}>
                <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke={r[1]} strokeWidth="2" strokeDasharray={r[2]}/></svg>
                <span style={{fontSize:10,color:C.muted}}>{r[0]}</span>
              </div>;
            })}
          </div>
        </div>
      </div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:600}}>ISK-sparande {year}</div>
          <div style={{fontSize:11,color:C.muted}}>Ackumulerat inkl. barnbidrag</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,fontWeight:600,color:actualISKAvg>=15000?C.green:C.orange}}>{fmt(actualISKAvg)}/mån</div>
            <div style={{fontSize:10,color:C.muted}}>snitt hittills</div>
          </div>
          <button onClick={function(){setExp(true);}} title="Förstora" style={{background:C.card2,border:"1px solid "+C.border,borderRadius:8,padding:"5px 8px",cursor:"zoom-in",fontSize:14,color:C.muted,fontFamily:C.font}}>🔍</button>
        </div>
      </div>
      {Chart(340,170)}
      <div style={{display:"flex",gap:14,marginTop:6}}>
        {[["Mål 15k/mån",C.blue,"4,3"],["Faktiskt",C.green,""],["Prognos",C.orange,"5,4"]].map(function(r){
          return <div key={r[0]} style={{display:"flex",alignItems:"center",gap:4}}>
            <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={r[1]} strokeWidth="2" strokeDasharray={r[2]}/></svg>
            <span style={{fontSize:10,color:C.muted}}>{r[0]}</span>
          </div>;
        })}
      </div>
    </div>;
  }

  // ── Status summary ──
  function StatusSummary() {
    var iskColor = actualISKAvg>=15000 ? C.green : actualISKAvg>=12000 ? C.orange : C.red;
    var iskIcon = actualISKAvg>=15000 ? "🟢" : actualISKAvg>=12000 ? "🟡" : "🔴";
    var balColor = balance>=0 ? C.green : C.red;
    var iskTarget = iskGoal + barnGoal;
    var rows = [];
    if(nM>0) {
      rows.push([iskIcon+" ISK-snitt", fmt(actualISKAvg)+"/mån", actualISKAvg>=15000?"Över mål (15 000 kr/mån) ✅":"Under mål — mål: 15 000 kr/mån", iskColor]);
      rows.push(["💰 Sparat hittills", fmt(actualISKInclBarn), nM+" mån inmatade — "+Math.round((actualISKInclBarn/iskTarget)*100)+"% av årsmål", C.muted]);
    }
    rows.push(["⚖️ Budgetöverskott", fmt(balance), balance>=0?"God marginal i budgeten":"Budgeten går minus", balColor]);

    return <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"2px solid "+(iskColor)}}>
      <div style={{background:iskColor,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#fff"}}>📊 Årssammanfattning {year}</span>
      </div>
      {rows.map(function(r,i){
        return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:i<rows.length-1?"1px solid "+C.border:"none"}}>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>{r[0]}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{r[2]}</div>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:r[3]}}>{r[1]}</span>
        </div>;
      })}
    </div>;
  }

  return <div style={{maxWidth:640,margin:"0 auto",paddingBottom:48}}>
    <div style={{position:"sticky",top:0,background:"rgba(250,248,243,0.97)",backdropFilter:"blur(20px)",padding:"18px 20px 14px",zIndex:10,borderBottom:"1px solid "+C.border}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.blue,fontSize:14,cursor:"pointer",fontFamily:C.font,padding:0}}>← Översikt</button>
      <h2 style={{fontSize:22,fontWeight:600,margin:"8px 0 2px"}}>Årsbudget {year}</h2>
      <p style={{fontSize:12,color:C.muted}}>{nM>0?"Faktiskt baserat på "+nM+" månader":"Inga månader inmatade ännu"}</p>
    </div>

    <div style={{padding:"16px"}}>

      <StatusSummary/>

      <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <SH icon="💰" title="Inkomster (bedömt helår, exkl. barnbidrag)" color="#276749"/>
        <ColH/>
        {[["Alex lön","alexSalary"],["Alex övrigt","alexOther"],["Emilie lön","emilieSalary"],["Emilie övrigt","emilieOther"]].map(function(r){
          var field=r[1];
          var actTotal=nM>0?months.reduce(function(a,k){return a+(monthData[k].income[field]||0);},0):0;
          return <Row key={field} label={r[0]} budget={yearData.income[field]||0} actualTotal={nM>0?actTotal:null}
            input={<NumIn value={yearData.income[field]||0} width={100} onChange={function(v){patchYear(function(y){var inc=Object.assign({},y.income);inc[field]=v;return Object.assign({},y,{income:inc});});}}/>}/>;
        })}
        {(yearData.extraIncome||[]).map(function(row,i){
          return <div key={row.id} style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+C.border,gap:8}}>
            <StrIn value={row.label} placeholder="Benämning..." onChange={function(v){patchYear(function(y){var ei=[...y.extraIncome];ei[i]=Object.assign({},ei[i],{label:v});return Object.assign({},y,{extraIncome:ei});});}}/>
            <NumIn value={row.amount||0} width={100} onChange={function(v){patchYear(function(y){var ei=[...y.extraIncome];ei[i]=Object.assign({},ei[i],{amount:v});return Object.assign({},y,{extraIncome:ei});});}}/>
            <span style={{width:90}}></span><span style={{width:100}}></span>
            <button onClick={function(){patchYear(function(y){return Object.assign({},y,{extraIncome:y.extraIncome.filter(function(_,j){return j!==i;})});});}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:13,padding:0}}>✕</button>
          </div>;
        })}
        <div style={{padding:"8px 16px",borderBottom:"1px solid "+C.border}}>
          <button onClick={function(){patchYear(function(y){return Object.assign({},y,{extraIncome:[...(y.extraIncome||[]),{id:"ei_"+Date.now(),label:"",amount:0}]});});}} style={{background:"none",border:"none",color:C.blue,fontSize:12,cursor:"pointer",fontFamily:C.font}}>+ Lägg till inkomst</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",background:"#f0faf4"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.green}}>Totala inkomster</span>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.green}}>{fmt(totalIncBudget)}</div>
            {nM>0&&<div style={{fontSize:11,color:C.muted}}>Hittills: {fmt(actualIncTotal)}</div>}
          </div>
        </div>
      </div>

      <div style={{background:C.card,borderRadius:14,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <div style={{display:"flex",padding:"5px 16px",borderBottom:"1px solid "+C.border,background:C.card2,gap:8}}>
          <span style={{flex:1,fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Barnbidrag → barnspar (öronmärkt till ISK)</span>
          <span style={{width:110,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Budget/år</span>
          <span style={{width:90,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Hittills</span>
          <span style={{width:100,textAlign:"right",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Prognos helår</span>
        </div>
        <div style={{display:"flex",alignItems:"center",padding:"9px 16px",gap:8}}>
          <span style={{flex:1,fontSize:13,color:C.text}}>Barnbidrag</span>
          <NumIn value={barnbidragBudget} width={100} onChange={function(v){patchYear(function(y){var inc=Object.assign({},y.income);inc.barnbidrag=v;return Object.assign({},y,{income:inc});});}}/>
          <span style={{width:90,textAlign:"right",fontSize:12,color:C.muted}}>{nM>0?fmt(actualBarnTotal):"—"}</span>
          <span style={{width:100,textAlign:"right",fontSize:12,fontWeight:500,color:C.green}}>{nM>0?fmt(Math.round((actualBarnTotal/nM)*12)):"—"}</span>
        </div>
      </div>

      <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <SH icon="📋" title="Fasta utgifter" color="#9b2c2c"/>
        <ColH/>
        {fixedIds.map(function(id){
          var def=DEFAULT_EXPENSES.find(function(e){return e.id===id;});
          if(!def)return null;
          return <Row key={id} label={def.label} budget={getBudgetExp(id)}
            actualTotal={nM>0?actualExpTotal[id]||0:null}
            input={<NumIn value={getBudgetExp(id)} width={100} onChange={function(v){setBudgetExp(id,v);}}/>}/>;
        })}
        {(yearData.extraExpenses||[]).map(function(row,i){
          return <div key={row.id} style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+C.border,gap:8}}>
            <StrIn value={row.label} placeholder="Benämning..." onChange={function(v){patchYear(function(y){var ee=[...y.extraExpenses];ee[i]=Object.assign({},ee[i],{label:v});return Object.assign({},y,{extraExpenses:ee});});}}/>
            <NumIn value={row.amount||0} width={100} onChange={function(v){patchYear(function(y){var ee=[...y.extraExpenses];ee[i]=Object.assign({},ee[i],{amount:v});return Object.assign({},y,{extraExpenses:ee});});}}/>
            <span style={{width:90}}></span><span style={{width:100}}></span>
            <button onClick={function(){patchYear(function(y){return Object.assign({},y,{extraExpenses:y.extraExpenses.filter(function(_,j){return j!==i;})});});}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:13,padding:0}}>✕</button>
          </div>;
        })}
        <div style={{padding:"8px 16px",borderBottom:"1px solid "+C.border}}>
          <button onClick={function(){patchYear(function(y){return Object.assign({},y,{extraExpenses:[...(y.extraExpenses||[]),{id:"ee_"+Date.now(),label:"",amount:0}]});});}} style={{background:"none",border:"none",color:C.blue,fontSize:12,cursor:"pointer",fontFamily:C.font}}>+ Lägg till utgift</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"#fff5f5"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.red}}>Summa fasta utgifter</span>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.red}}>{fmt(totalFixedBudget)}</div>
            {nM>0&&<div style={{fontSize:11,color:C.muted}}>Hittills: {fmt(actualFixedTotal)}</div>}
          </div>
        </div>
      </div>

      <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <SH icon="🛒" title="Vardagsbudget & rörliga utgifter" color="#744210"/>
        <ColH/>
        <Row label="Fickpengar" budget={revolBudget} actualTotal={nM>0?actualRevTotal:null}
          input={<NumIn value={revolBudget} width={100} onChange={function(v){setBudgetExp("revolut",v);}}/>}/>
        <Row label="Resor (resekonto)" budget={travelBudget} actualTotal={nM>0?actualTravelTotal:null}
          input={<NumIn value={travelBudget} width={100} onChange={function(v){patchYear(function(y){var r=Object.assign({},y.reserved||{});r.travel=v;return Object.assign({},y,{reserved:r});});}}/>}/>
        <Row label="Hem & inköp (transaktionskonto)" budget={homeBudget} actualTotal={nM>0?actualHomeTotal:null}
          input={<NumIn value={homeBudget} width={100} onChange={function(v){patchYear(function(y){var r=Object.assign({},y.reserved||{});r.home=v;return Object.assign({},y,{reserved:r});});}}/>}/>
        <Row label="Övrigt" budget={otherBudget} actualTotal={null}
          input={<NumIn value={otherBudget} width={100} onChange={function(v){patchYear(function(y){var r=Object.assign({},y.reserved||{});r.other=v;return Object.assign({},y,{reserved:r});});}}/>}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"#fffbeb"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.orange}}>Summa vardagsbudget</span>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.orange}}>{fmt(totalVardagBudget)}</div>
            {nM>0&&<div style={{fontSize:11,color:C.muted}}>Hittills: {fmt(actualVardagTotal)}</div>}
          </div>
        </div>
      </div>

      <div style={{background:C.card,borderRadius:16,overflow:"hidden",marginBottom:16,border:"1px solid "+C.border}}>
        <SH icon="🏦" title="Sparande (ISK)" color="#1a5c32"/>
        <div style={{padding:"13px 16px",borderBottom:"1px solid "+C.border}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:nM>0?10:0}}>
            <div>
              <div style={{fontSize:13}}>ISK-mål per år (exkl. barnbidrag)</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>Totalt mål inkl. barnbidrag: {fmt(iskGoal+barnGoal)}</div>
            </div>
            <NumIn value={iskGoal} width={110} onChange={function(v){patchYear(function(y){return Object.assign({},y,{iskGoal:v});});}}/>
          </div>
          {nM>0&&<div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:11,color:C.muted}}>Faktiskt sparat inkl. barnbidrag ({nM} mån)</span>
              <span style={{fontSize:12,fontWeight:600,color:C.green}}>{fmt(actualISKInclBarn)}</span>
            </div>
            <div style={{height:5,background:C.border,borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",background:C.green,borderRadius:99,width:Math.min(100,Math.round((actualISKInclBarn/(iskGoal+barnGoal))*100))+"%"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:10,color:C.muted}}>{Math.round((actualISKInclBarn/(iskGoal+barnGoal))*100)}% av totalt mål</span>
              <span style={{fontSize:10,color:C.muted}}>{iskLeft>0?fmt(iskLeft)+" kvar":"Mål uppnått ✅"}</span>
            </div>
          </div>}
        </div>
      </div>


      <div style={{background:balance>=0?"#f0faf4":"#fff5f5",borderRadius:16,padding:"18px 20px",marginBottom:16,border:"2px solid "+(balance>=0?C.green:C.red)}}>
        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>📊 Årskalkyl</div>
        {[
          ["Totala inkomster (exkl. barnbidrag)",totalIncBudget,C.green,true],
          ["Fasta utgifter",totalFixedBudget,C.red,false],
          ["Vardagsbudget & rörliga",totalVardagBudget,C.orange,false],
          ["ISK-sparande (mål exkl. barnbidrag)",iskGoal,C.blue,false],
        ].map(function(r){
          return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,color:C.muted}}>{r[0]}</span>
            <span style={{fontSize:13,fontWeight:500,color:r[2]}}>{r[3]?"+":"-"} {fmt(r[1])}</span>
          </div>;
        })}
        <div style={{borderTop:"2px solid "+(balance>=0?C.green:C.red),paddingTop:12,marginTop:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700}}>Överskott / underskott</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>Barnbidrag ({fmt(barnGoal)}/år) hanteras separat</div>
          </div>
          <span style={{fontSize:22,fontWeight:800,color:balance>=0?C.green:C.red}}>{balance>=0?"+":""}{fmt(balance)}</span>
        </div>
        {balance<0&&<p style={{fontSize:12,color:C.red,marginTop:8}}>⚠️ Budgeten går minus — justera inkomster eller minska utgifter.</p>}
        {balance>=0&&balance<10000&&<p style={{fontSize:12,color:C.orange,marginTop:8}}>⚠️ Litet överskott — begränsad buffert.</p>}
        {balance>=10000&&<p style={{fontSize:12,color:C.green,marginTop:8}}>✅ God marginal i budgeten.</p>}
      </div>

    </div>
  </div>;
}



export default App
