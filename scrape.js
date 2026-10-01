// Runs INSIDE the iplan RSVP tab (Claude in Chrome javascript_tool). Fetches every guest, parses, and replaces the page body with the JSON
// between GUESTS_JSON_START / GUESTS_JSON_END markers, so get_page_text can read it (Chrome drops programmatic downloads from injected scripts).
const tok = document.querySelector('meta[name=csrf-token]').content;
// iplan caps a page at 300 rows (asking for more silently returns 10), so page through until every row is in
let rows = [], page = 1, total = 1, j;
while (rows.length < total && page < 10) {
  const body = {bs_grid_data_source:{paging:{curr_page:page,per_page:300,bound:null},uid:"client.event.rsvp.service.package_invitations_data_source",applied_view_id:null,sorting:[{uid:"invitation.title",direction:"asc"}],filtering:{},facet_uid:"default"},bs_grid_options:{active_layout:"list"},load_components:["table","paging","applied_filters"]};
  const r = await fetch(location.pathname + '/package_invitations',{method:'POST',headers:{'X-CSRF-Token':tok,'Content-Type':'application/json','Accept':'application/json, text/javascript, */*; q=0.01','X-Http-Method-Override':'GET','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify(body)});
  if (r.status !== 200) throw new Error('iplan returned ' + r.status);
  j = await r.json(); total = j.pagination_info.total_rows;
  const d = new DOMParser().parseFromString(j.html.table,'text/html');
  rows.push(...[...d.body.children].filter(e=>e.classList.contains('d-flex')));
  page++;
}
const T = e => e ? e.textContent.replace(/\s+/g,' ').trim() : '';
const guests = rows.map(row=>{
  const left=row.children[0];
  const name=T(left.querySelector('a')), phone=T(left.querySelector('.phone'));
  const badges=[...left.querySelectorAll('.badge')].map(T).filter(t=>t&&t!==phone);
  let invited=1; const inv=badges.find(b=>/מוזמ[נן]/.test(b)); if(inv){const m=inv.match(/\d+/); invited=m?+m[0]:1;}
  const side=badges.find(b=>/^(חתן|כלה|חתן וכלה)$/.test(b))||'';
  const group=badges.filter(b=>b!==inv&&b!==side).join(', ');
  const svc=row.querySelector('.order-3, .order-xl-2'); const service=T(svc&&svc.querySelector('.badge')); const sent=+T(svc&&svc.querySelector('.strong'))||0;
  const rs=row.querySelector('.order-4, .order-xl-3'); const rsBlock=rs&&rs.querySelector('.mt-2');
  const rsvpText=rsBlock?[...rsBlock.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).filter(Boolean).join(' '):'';
  const notes=[...row.querySelectorAll('.popover-body')].map(T).filter(Boolean).join(' | ');
  let status='pending', coming=0; const m=rsvpText.match(/(\d+)\s*מגיע/);
  if(/לא מגיע/.test(rsvpText)) status='declined'; else if(m){status='confirmed'; coming=+m[1];}
  return {name,phone,side,group,invited,service,sent,status,coming,notes};
});
if (guests.length !== j.pagination_info.total_rows) throw new Error('parsed ' + guests.length + ' of ' + j.pagination_info.total_rows);
const p=document.createElement('pre'); p.textContent='GUESTS_JSON_START\n'+JSON.stringify(guests)+'\nGUESTS_JSON_END'; document.body.innerHTML=''; document.body.appendChild(p);
`dumped ${guests.length} guests: ${guests.filter(g=>g.status==='confirmed').length} confirmed, ${guests.filter(g=>g.status==='declined').length} declined, ${guests.filter(g=>g.status==='pending').length} pending`
