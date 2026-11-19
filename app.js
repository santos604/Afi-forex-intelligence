const pairs=['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','XAUUSD'];
document.getElementById('markets').innerHTML=pairs.map((p,i)=>`<div class="market"><b>${p}</b><span>${i===7?'Gold':'Forex'} · Awaiting feed</span></div>`).join('');
document.getElementById('analyze').addEventListener('click',()=>{document.getElementById('plan-title').textContent='Example plan: EURUSD';document.getElementById('plan-copy').textContent='Illustrative only: a real signal requires broker price data, validated strategy rules and risk checks. No order has been sent.';});
document.getElementById('stop').addEventListener('click',()=>{document.getElementById('plan-title').textContent='Execution remains disabled';document.getElementById('plan-copy').textContent='No live connection exists, so there are no AFI orders to stop.';});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
