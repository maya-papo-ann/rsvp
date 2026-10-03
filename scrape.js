// Runs INSIDE an iplan tab (Claude in Chrome javascript_tool). Source of truth = the invitations list (all invitations, people counts
// exactly as iplan's own summary). Dietary notes come from the RSVP-service page and are merged by name. Replaces the page body
// with the JSON between GUESTS_JSON_START / GUESTS_JSON_END so get_page_text can read it (Chrome drops downloads from injected scripts).
const base = '/he-IL/client/events/266844';
const T = e => e ? e.textContent.replace(/\s+/g,' ').trim() : '';
const r = await fetch(base + '/invitations?paging_page_size=1000&filter_rsvp_status=all&filter_side=all', {credentials:'include'});
if (r.status !== 200) throw new Error('iplan invitations returned ' + r.status);
const d = new DOMParser().parseFromString(await r.text(), 'text/html');
const tbl = [...d.querySelectorAll('table')].find(x => x.querySelector('tbody tr td'));
const rows = [...tbl.querySelectorAll('tbody tr')].filter(tr => !/template/.test(tr.getAttribute('class') || ''));
const guests = rows.map(tr => {
  const c = [...tr.children], rs = c[7];
  const cnt = +T(rs && rs.querySelector('.count')) || 0, label = T(rs && rs.querySelector('.arriving_guests_count span:not(.count)'));
  const status = label === 'מגיעים' ? 'confirmed' : label === 'לא מגיעים' ? 'declined' : 'pending';
  return {name:T(c[1]), phone:T(c[5]), side:T(c[3]), group:T(c[4]), invited:+T(c[2])||0, status, coming:status==='confirmed'?cnt:0, notes:T(c[9])};
});
if (guests.length < 100 || guests.some(g => !g.name)) throw new Error('parsed ' + guests.length + ' rows, some without a name');
// dietary answers live only on the RSVP-service page (one JSON call, pages of 300)
try {
  const tok = document.querySelector('meta[name=csrf-token]').content; const notes = new Map(); let page = 1, total = 1, got = 0;
  while (got < total && page < 10) {
    const body = {bs_grid_data_source:{paging:{curr_page:page,per_page:300,bound:null},uid:"client.event.rsvp.service.package_invitations_data_source",applied_view_id:null,sorting:[{uid:"invitation.title",direction:"asc"}],filtering:{},facet_uid:"default"},bs_grid_options:{active_layout:"list"},load_components:["table","paging","applied_filters"]};
    const s = await fetch(base + '/rsvp/service/package_invitations',{method:'POST',headers:{'X-CSRF-Token':tok,'Content-Type':'application/json','Accept':'application/json, text/javascript, */*; q=0.01','X-Http-Method-Override':'GET','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify(body)});
    const j = await s.json(); total = j.pagination_info.total_rows;
    const sd = new DOMParser().parseFromString(j.html.table,'text/html');
    for (const row of [...sd.body.children].filter(e => e.classList.contains('d-flex'))) { got++; const n = [...row.querySelectorAll('.popover-body')].map(T).filter(Boolean).join(' | '); if (n) notes.set(T(row.children[0].querySelector('a')), n); }
    page++;
  }
  for (const g of guests) { const n = notes.get(g.name); if (n) g.notes = g.notes ? g.notes + ' | ' + n : n; }
} catch (e) { console.warn('notes merge skipped: ' + e.message); }
const p = document.createElement('pre'); p.textContent = 'GUESTS_JSON_START\n' + JSON.stringify(guests) + '\nGUESTS_JSON_END'; document.body.innerHTML = ''; document.body.appendChild(p);
const sum = (a, f) => a.reduce((n, x) => n + f(x), 0), yes = guests.filter(g => g.status === 'confirmed');
`${guests.length} invitations, ${sum(guests, g => g.invited)} people invited, ${sum(yes, g => g.coming)} coming, ${guests.filter(g => g.status === 'declined').length} declined invitations, ${guests.filter(g => g.status === 'pending').length} pending invitations`
