const $ = id => document.getElementById(id);
const storageKey = 'spikta.baseline.v1';
function status(text,error=false) {
  $('status').textContent=text;
  if(error) $('status').dataset.error='true';
  else $('status').removeAttribute('data-error');
}
function render(baseline) {
  $('current-baseline').textContent=baseline.text;
  $('baseline').value=baseline.text;
  $('progress-state').textContent='Recorded';
  $('updated').textContent=new Date(baseline.updatedAt).toLocaleDateString();
}
$('clock').textContent=new Date().toLocaleDateString([],{month:'short',day:'numeric'}).toUpperCase();
try {
  const raw=localStorage.getItem(storageKey);
  if(raw) {
    const saved=JSON.parse(raw);
    if(!saved||typeof saved.text!=='string'||!saved.text.trim()||saved.text.length>500||!Number.isFinite(Date.parse(saved.updatedAt))) throw Error('Invalid baseline');
    render(saved);
  }
} catch {status('Your saved starting point could not be loaded. You can enter it again below.',true);}
$('baseline-form').onsubmit=event=>{
  event.preventDefault();
  const text=$('baseline').value.trim();
  if(!text||text.length>500) return status('Enter your current baseline using up to 500 characters.',true);
  const saved={text,updatedAt:new Date().toISOString()};
  try {
    localStorage.setItem(storageKey,JSON.stringify(saved));
    render(saved);
    status('Starting Point saved. Your dashboard is up to date.');
  } catch {status('This browser could not save your starting point. Check browser storage settings and try again.',true);}
};
