// js/app.js
// Full app logic with built-in login (no Firebase Auth).
(function(){
  // CONFIG: built-in credentials
  const BUILTIN_EMAIL = "hotline@tbk.com";
  const BUILTIN_PASSWORD = "TBK123*@";
  const BUILTIN_UID = "local-hotline-user"; // used for uid fields in documents

  // DOM helpers
  const $ = id => document.getElementById(id);
  const escapeHtml = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const shorten = (s,n)=> s && s.length>n ? s.slice(0,n-1) + '…' : (s||'');
  const debounce = (fn,ms)=>{ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; };

  // Elements
  const emailEl = $('email'), passEl = $('password'), btnLogin = $('btnLogin'), btnForgot = $('btnForgot'), loginCard = $('loginCard');
  const btnSignOut = $('btnSignOut'), userArea = $('userArea');
  const appArea = $('appArea');
  const dateEl = $('date'), sourceEl = $('source'), phoneEl = $('phone'), incidentEl = $('incident'), procedureEl = $('procedure'), descriptionEl = $('description'), fileInput = $('fileInput');
  const btnSubmit = $('btnSubmit'), btnClear = $('btnClear');
  const recordsTableBody = document.querySelector('#recordsTable tbody');
  const searchInput = $('searchInput'), filterStatus = $('filterStatus'), filterPeriod = $('filterPeriod');
  const btnSummary = $('btnSummary'), summaryCard = $('summaryCard');
  const weekCount = $('weekCount'), monthCount = $('monthCount'), yearCount = $('yearCount');
  const btnExportXlsx = $('btnExportXlsx'), btnExportPdf = $('btnExportPdf'), selectAll = $('selectAll'), btnDeleteSelected = $('btnDeleteSelected');

  // currentUser local (after built-in login)
  let currentUser = null;

  // ---------- Built-in login ----------
  btnLogin.addEventListener('click', ()=>{
    const email = (emailEl.value || '').trim();
    const pass = (passEl.value || '').trim();
    if(!email || !pass){ alert('សូមបញ្ចូលអ៊ីមែល និង លេខសម្ងាត់'); return; }

    if(email === BUILTIN_EMAIL && pass === BUILTIN_PASSWORD){
      // set local logged-in flag and currentUser object
      localStorage.setItem('hotline_logged_in', '1');
      currentUser = { email: BUILTIN_EMAIL, uid: BUILTIN_UID, displayName: BUILTIN_EMAIL };
      showAppAfterLogin();
    } else {
      alert('ចូលមិនបាន: អ៊ីមែល ឬ លេខសម្ងាត់មិនត្រឹមត្រូវទេ។');
    }
  });

  // Forgot password: simple message (no reset since not using Firebase Auth)
  btnForgot.addEventListener('click', ()=>{
    alert('This is a local login. To change the password, edit the client config or contact the administrator.');
  });

  // Sign out
  btnSignOut.addEventListener('click', ()=>{
    localStorage.removeItem('hotline_logged_in');
    currentUser = null;
    loginCard.style.display = 'block';
    appArea.style.display = 'none';
    userArea.textContent = '';
  });

  // Auto-check login on load
  window.addEventListener('load', ()=>{
    if(localStorage.getItem('hotline_logged_in') === '1'){
      currentUser = { email: BUILTIN_EMAIL, uid: BUILTIN_UID, displayName: BUILTIN_EMAIL };
      showAppAfterLogin();
    } else {
      loginCard.style.display = 'block';
      appArea.style.display = 'none';
    }
  });

  function showAppAfterLogin(){
    loginCard.style.display = 'none';
    appArea.style.display = 'block';
    userArea.textContent = `សួស្តី, ${currentUser.displayName}`;
    loadRecords();
  }

  // ---------- Submit report (Firestore + Storage) ----------
  btnSubmit.addEventListener('click', async ()=>{
    if(!currentUser) return alert('សូមចូលមុន');
    const date = dateEl.value;
    if(!date) return alert('សូមបញ្ចូលកាលបរិច្ឆេទ');
    const id = 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);

    const data = {
      date,
      source: sourceEl.value || '',
      phone: phoneEl.value || '',
      incident: incidentEl.value || '',
      procedure: procedureEl.value || '',
      description: descriptionEl.value || '',
      status: 'open',
      uid: currentUser.uid,
      uploadedBy: currentUser.displayName || currentUser.email || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // file upload
    if(fileInput.files.length){
      const f = fileInput.files[0];
      const storagePath = `attachments/${id}/${f.name}`;
      const ref = storage.ref().child(storagePath);
      try{
        const snap = await ref.put(f, { customMetadata: { uploadedByUid: currentUser.uid, docId: id } });
        const url = await snap.ref.getDownloadURL();
        data.fileUrl = url; data.fileName = f.name; data.storagePath = storagePath;
      } catch(e){
        console.error('Upload failed', e);
        alert('ទាញឯកសារមិនបាន: ' + e.message);
        return;
      }
    }

    try{
      await db.collection('hotline117').doc(id).set(data);
      alert('បានរក្សារួច');
      clearForm();
      loadRecords();
    } catch(err){
      console.error(err);
      alert('Failed to save: ' + err.message);
    }
  });

  btnClear.addEventListener('click', clearForm);
  function clearForm(){
    ['date','source','phone','incident','procedure','description'].forEach(k => { const el = $(k); if(el) el.value = ''; });
    if(fileInput) fileInput.value = '';
  }

  // ---------- Load records ----------
  async function loadRecords(){
    recordsTableBody.innerHTML = '';
    try{
      const snapshot = await db.collection('hotline117').orderBy('date','desc').get();
      snapshot.forEach(doc=>{
        const d = doc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="checkbox" class="sel" data-id="${doc.id}" /></td>
          <td>${escapeHtml(d.date||'')}</td>
          <td>${escapeHtml(d.source||'')}</td>
          <td>${escapeHtml(d.phone||'')}</td>
          <td>${shorten(escapeHtml(d.incident||''), 80)}</td>
          <td>${escapeHtml(d.uploadedBy||'')}</td>
          <td>${d.status||'open'}</td>
          <td>
            <button class="btn btn-sm btn-muted" data-id="${doc.id}" data-action="view">លម្អិត</button>
            <button class="btn btn-sm btn-primary" data-id="${doc.id}" data-action="pdf">PDF</button>
            <button class="btn btn-sm btn-muted" data-id="${doc.id}" data-action="download" ${!d.fileUrl ? 'disabled' : ''}>ទាញយក</button>
            <button class="btn btn-sm btn-primary" data-id="${doc.id}" data-action="edit">កែ</button>
            <button class="btn btn-sm btn-danger" data-id="${doc.id}" data-action="delete">លុប</button>
          </td>
        `;
        recordsTableBody.appendChild(tr);
      });
    } catch(e){
      console.error('Load records fail', e);
      recordsTableBody.innerHTML = '<tr><td colspan="8">មិនអាចផ្ទុកកំណត់ហេតុក៏បាន: ' + e.message + '</td></tr>';
    }
  }

  // ---------- Table action delegation ----------
  document.querySelector('#recordsTable').addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const id = btn.dataset.id, action = btn.dataset.action;
    if(action === 'view'){
      const doc = await db.collection('hotline117').doc(id).get();
      if(!doc.exists) return alert('រកមិនឃើញ');
      const d = doc.data();
      alert(`Date: ${d.date}\nSource: ${d.source}\nPhone: ${d.phone}\n\n${d.incident}\n\n${d.description}`);
    } else if(action === 'pdf'){
      await generatePdfForId(id);
    } else if(action === 'download'){
      const d = (await db.collection('hotline117').doc(id).get()).data();
      if(d && d.fileUrl) window.open(d.fileUrl, '_blank');
    } else if(action === 'edit'){
      await startEdit(id);
    } else if(action === 'delete'){
      if(!confirm('តើអ្នកចង់លុបមែនទេ?')) return;
      await tryDelete(id);
    }
  });

  // ---------- Edit ----------
  async function startEdit(id){
    const docRef = db.collection('hotline117').doc(id);
    const doc = await docRef.get();
    if(!doc.exists) return alert('Not found');
    const d = doc.data();

    // permission check (client-side)
    if(!canModifyClient(d)) return alert('មិនអាចកែបាន (ក្រៅពេល 2 ថ្ងៃ ឬ សិទ្ធិ)');
    // populate
    dateEl.value = d.date || '';
    sourceEl.value = d.source || '';
    phoneEl.value = d.phone || '';
    incidentEl.value = d.incident || '';
    procedureEl.value = d.procedure || '';
    descriptionEl.value = d.description || '';

    if(!confirm('ចុច OK ដើម្បីរក្សាការ​កែប្រែ')) return;
    const updates = {
      date: dateEl.value, source: sourceEl.value, phone: phoneEl.value,
      incident: incidentEl.value, procedure: procedureEl.value, description: descriptionEl.value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await docRef.update(updates);
    alert('បានកែប្រែ');
    clearForm();
    loadRecords();
  }

  function canModifyClient(docData){
    if(!currentUser) return false;
    if(currentUser.uid === OWNER_UID) return true;
    if(docData.uid !== currentUser.uid) return false;
    const createdAt = docData.createdAt ? (docData.createdAt.toDate ? docData.createdAt.toDate() : new Date(docData.createdAt)) : null;
    if(!createdAt) return false;
    return (Date.now() - createdAt.getTime()) <= 2*24*3600*1000;
  }

  // ---------- Delete ----------
  async function tryDelete(id){
    const docRef = db.collection('hotline117').doc(id);
    const doc = await docRef.get();
    if(!doc.exists) return alert('Not found');
    const d = doc.data();
    if(!canModifyClient(d)) return alert('មិនអាចលុប (ក្រៅពេល 2 ថ្ងៃ នោះមិនមែន OWNER)');
    if(d.storagePath){
      try{ await storage.ref().child(d.storagePath).delete(); } catch(e){ console.warn('Failed to delete storage', e); }
    }
    await docRef.delete();
    alert('បានលុប');
    loadRecords();
  }

  // ---------- Exports ----------
  btnExportXlsx.addEventListener('click', async ()=>{
    try{
      const snapshot = await db.collection('hotline117').orderBy('date','desc').get();
      const rows = [['ID','Date','Source','Phone','Incident','Procedure','Description','Status','UploadedBy','FileName','FileUrl']];
      snapshot.forEach(doc => {
        const d = doc.data();
        rows.push([doc.id, d.date, d.source, d.phone, d.incident, d.procedure, d.description, d.status, d.uploadedBy||'', d.fileName||'', d.fileUrl||'']);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'hotline');
      const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
      const blob = new Blob([wbout], {type:'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'hotline117_records.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch(e){
      alert('Export failed: ' + e.message);
    }
  });

  // export selected to PDF
  btnExportPdf.addEventListener('click', async ()=>{
    const ids = Array.from(document.querySelectorAll('.sel:checked')).map(cb => cb.dataset.id);
    if(ids.length===0){ alert('មិនមានកំណត់ហេតុខ្ទង់ជ្រើស'); return; }
    for(const id of ids) await generatePdfForId(id);
  });

  async function generatePdfForId(id){
    const docSnap = await db.collection('hotline117').doc(id).get();
    if(!docSnap.exists) return;
    const d = docSnap.data();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:'pt', format:'a4' });
    let y = 40;
    pdf.setFontSize(14); pdf.text('កំណត់ហេតុ HOTLINE 117', 40, y); y+=24;
    pdf.setFontSize(11);
    pdf.text('ID: ' + id, 40, y); y+=16;
    pdf.text('Date: ' + (d.date||''), 40, y); y+=14;
    pdf.text('Source: ' + (d.source||''), 40, y); y+=14;
    pdf.text('Phone: ' + (d.phone||''), 40, y); y+=18;
    pdf.text('Incident:', 40, y); y+=12;
    const lines = pdf.splitTextToSize(d.incident||'', 500);
    pdf.text(lines, 40, y); y += lines.length*12 + 8;
    pdf.text('Procedure:', 40, y); y+=12;
    const lines2 = pdf.splitTextToSize(d.procedure||'', 500);
    pdf.text(lines2, 40, y); y += lines2.length*12 + 8;
    pdf.text('Description:', 40, y); y+=12;
    const lines3 = pdf.splitTextToSize(d.description||'', 500);
    pdf.text(lines3, 40, y); y += lines3.length*12 + 8;
    pdf.save('hotline_' + id + '.pdf');
  }

  // ---------- Search / filter ----------
  searchInput.addEventListener('input', debounce(applyFilters, 300));
  filterStatus.addEventListener('change', applyFilters);
  filterPeriod.addEventListener('change', applyFilters);

  async function applyFilters(){
    const q = (searchInput.value || '').toLowerCase();
    const status = filterStatus.value;
    const period = filterPeriod.value;
    recordsTableBody.innerHTML = '';
    const snapshot = await db.collection('hotline117').orderBy('date','desc').get();
    snapshot.forEach(doc=>{
      const d = doc.data();
      const text = [d.source,d.phone,d.incident,d.description,d.uploadedBy].filter(Boolean).join(' ').toLowerCase();
      const matchesQ = q ? text.includes(q) : true;
      const matchesStatus = status==='all' ? true : (d.status === status);
      let matchesPeriod = true;
      if(period!=='all'){
        const days = period==='7d'?7: period==='30d'?30:365;
        const recDate = new Date(d.date);
        const cutoff = Date.now() - days*24*3600*1000;
        matchesPeriod = recDate.getTime() >= cutoff;
      }
      if(matchesQ && matchesStatus && matchesPeriod){
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="checkbox" class="sel" data-id="${doc.id}" /></td>
          <td>${d.date||''}</td>
          <td>${escapeHtml(d.source||'')}</td>
          <td>${escapeHtml(d.phone||'')}</td>
          <td>${shorten(escapeHtml(d.incident||''),80)}</td>
          <td>${escapeHtml(d.uploadedBy||'')}</td>
          <td>${d.status||'open'}</td>
          <td>
            <button class="btn btn-sm btn-muted" data-id="${doc.id}" data-action="view">លម្អិត</button>
            <button class="btn btn-sm btn-primary" data-id="${doc.id}" data-action="pdf">PDF</button>
            <button class="btn btn-sm btn-muted" data-id="${doc.id}" data-action="download" ${!d.fileUrl ? 'disabled' : ''}>ទាញយក</button>
            <button class="btn btn-sm btn-primary" data-id="${doc.id}" data-action="edit">កែ</button>
            <button class="btn btn-sm btn-danger" data-id="${doc.id}" data-action="delete">លុប</button>
          </td>`;
        recordsTableBody.appendChild(tr);
      }
    });
  }

  // ---------- Summary ----------
  btnSummary.addEventListener('click', async ()=>{
    const snapshot = await db.collection('hotline117').get();
    const now = Date.now(); let w=0,m=0,y=0;
    snapshot.forEach(doc => {
      const d = doc.data();
      const t = d.date ? new Date(d.date).getTime() : null;
      if(!t) return;
      if(t >= now - 7*24*3600*1000) w++;
      if(t >= now - 30*24*3600*1000) m++;
      if(t >= now - 365*24*3600*1000) y++;
    });
    weekCount.textContent = w; monthCount.textContent = m; yearCount.textContent = y;
    summaryCard.style.display = 'block';
  });

})();
